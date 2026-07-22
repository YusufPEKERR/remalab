import sys
import os
from PySide6.QtCore import QCoreApplication, QObject
from PySide6.QtWebChannel import QWebChannel
from PySide6.QtWebSockets import QWebSocketServer
from PySide6.QtNetwork import QHostAddress
import json

from config.database import init_database_schema, register_db_error_listener
from core.web_bridge import WebBridge
from core.main_window import WebSocketTransport

class HeadlessServer(QObject):
    """Penceresiz (headless) sunucu modu için arka plan servislerini yönetir."""
    def __init__(self):
        super().__init__()
        self.channel = QWebChannel()
        self.web_bridge = WebBridge()
        self.channel.registerObject("backend", self.web_bridge)

        self.transports = []
        self.websocket_server = QWebSocketServer(
            "RemaLab WMS WebSocket Server",
            QWebSocketServer.NonSecureMode,
            self
        )
        if self.websocket_server.listen(QHostAddress.Any, 5174):
            print("[INFO] QWebChannel WebSocket sunucusu 5174 portunda baslatildi (HEADLESS).")
            self.websocket_server.newConnection.connect(self.on_new_websocket_connection)
        else:
            print("[ERROR] QWebChannel WebSocket sunucusu baslatilamadi!")

        self._dev_process = None
        if os.getenv("DEV_MODE", "1") == "1":
            import socket
            def _is_port_in_use(host, port):
                try:
                    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                        s.settimeout(0.5)
                        return s.connect_ex((host, port)) == 0
                except Exception:
                    return False

            if not _is_port_in_use("127.0.0.1", 5173):
                base_dir = os.path.dirname(os.path.abspath(__file__))
                frontend_dir = os.path.join(base_dir, "frontend")
                import subprocess

                cmd = "npm run dev"
                try:
                    creationflags = 0
                    if sys.platform == "win32":
                        creationflags = subprocess.CREATE_NO_WINDOW

                    self._dev_process = subprocess.Popen(
                        cmd,
                        shell=True,
                        cwd=frontend_dir,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        creationflags=creationflags
                    )
                    print("[INFO] React Vite dev sunucusu otomatik baslatiliyor...")
                except Exception as e:
                    print(f"[ERROR] React dev sunucusu baslatilamadi: {e}")

    def on_new_websocket_connection(self):
        socket = self.websocket_server.nextPendingConnection()
        transport = WebSocketTransport(socket)
        self.channel.connectTo(transport)
        self.transports.append(transport)
        socket.disconnected.connect(lambda: self.transports.remove(transport) if transport in self.transports else None)

    def stop(self):
        if self._dev_process:
            try:
                import subprocess
                if sys.platform == "win32":
                    subprocess.run(
                        ["taskkill", "/F", "/T", "/PID", str(self._dev_process.pid)],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        creationflags=subprocess.CREATE_NO_WINDOW
                    )
                else:
                    self._dev_process.terminate()
                print("[INFO] React Vite dev sunucusu durduruldu.")
            except Exception as e:
                print(f"[WARN] React dev sunucusu kapatilamadi: {e}")

def main():
    print("[INFO] Veritabani semasi kontrol ediliyor...")
    try:
        init_database_schema()
        register_db_error_listener()
    except Exception as db_err:
        print(f"[WARN] Veritabani tablolari baslatilamadi: {db_err}")

    # QApplication yerine sadece QCoreApplication (ekran gerektirmeyen) baslatiyoruz
    app = QCoreApplication(sys.argv)
    server = HeadlessServer()
    app.aboutToQuit.connect(server.stop)
    
    print("[SUCCESS] RemaLab Headless Server basariyla calisiyor. Kapatmak icin CTRL+C yapabilirsiniz.")
    sys.exit(app.exec())

if __name__ == "__main__":
    main()
