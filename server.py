import sys
import os
import json
import threading
import functools

from PySide6.QtCore import QCoreApplication, QObject
from PySide6.QtWebChannel import QWebChannel
from PySide6.QtWebSockets import QWebSocketServer
from PySide6.QtNetwork import QHostAddress

from config.database import init_database_schema, register_db_error_listener
from core.web_bridge import WebBridge
from core.main_window import WebSocketTransport, CustomRequestHandler, _ThreadingHTTPServer

def _start_frontend_http_server(directory, preferred_port=5175):
    """dist/ klasörünü tüm ağda (0.0.0.0:5175) web tarayıcıları için servis eder."""
    handler = functools.partial(CustomRequestHandler, directory=directory)
    for port in range(preferred_port, preferred_port + 20):
        try:
            httpd = _ThreadingHTTPServer(("0.0.0.0", port), handler)
            thread = threading.Thread(target=httpd.serve_forever, daemon=True)
            thread.start()
            print(f"[INFO] Frontend Web Sunucusu http://0.0.0.0:{port} adresinde baslatildi.")
            return httpd
        except OSError:
            continue
    httpd = _ThreadingHTTPServer(("0.0.0.0", 0), handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    print("[INFO] Frontend Web Sunucusu rastgele bir portta baslatildi.")
    return httpd

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
            print("[INFO] WebSocket Arka Plan Sunucusu 5174 portunda baslatildi.")
            self.websocket_server.newConnection.connect(self.on_new_websocket_connection)
        else:
            print("[ERROR] WebSocket sunucusu baslatilamadi!")

        # Frontend dist dizinini kontrol et ve Web Sunucusunu başlat
        base_dir = os.path.dirname(os.path.abspath(__file__))
        dist_dir = os.path.join(base_dir, "frontend", "dist")

        if not os.path.exists(dist_dir):
            print("[INFO] Frontend dist klasoru bulunamadi, otomatik derleniyor...")
            import subprocess
            frontend_dir = os.path.join(base_dir, "frontend")
            subprocess.run("npm run build", shell=True, cwd=frontend_dir)

        if os.path.exists(dist_dir):
            self.http_server = _start_frontend_http_server(dist_dir, 5175)
        else:
            print("[WARN] Frontend dist klasoru bulunamadi! Web sunucusu baslatilamadi.")

    def on_new_websocket_connection(self):
        socket = self.websocket_server.nextPendingConnection()
        transport = WebSocketTransport(socket)
        self.channel.connectTo(transport)
        self.transports.append(transport)
        socket.disconnected.connect(lambda: self.transports.remove(transport) if transport in self.transports else None)

    def stop(self):
        print("[INFO] RemaLab Headless Sunucusu durduruluyor...")

def main():
    print("[INFO] Veritabani semasi kontrol ediliyor...")
    try:
        init_database_schema()
        register_db_error_listener()
    except Exception as db_err:
        print(f"[WARN] Veritabani tablolari baslatilamadi: {db_err}")

    # QApplication yerine ekran gerektirmeyen QCoreApplication baslatiyoruz
    app = QCoreApplication(sys.argv)
    server = HeadlessServer()
    app.aboutToQuit.connect(server.stop)
    
    print("[SUCCESS] RemaLab Sunucusu basariyla calisiyor.")
    print("  -> Frontend Arayuzu: http://localhost:5175 veya http://<SUNUCU-IP>:5175")
    print("  -> WebSocket Servisi: ws://<SUNUCU-IP>:5174")
    print("Kapatmak icin CTRL+C yapabilirsiniz.")
    sys.exit(app.exec())

if __name__ == "__main__":
    main()
