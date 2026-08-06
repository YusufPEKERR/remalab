import sys
import os
import json
import threading
import functools
import signal
import time

from PySide6.QtCore import QCoreApplication, QObject, QTimer
from PySide6.QtWebChannel import QWebChannel
from PySide6.QtWebSockets import QWebSocketServer
from PySide6.QtNetwork import QHostAddress

from config.database import init_database_schema, register_db_error_listener
from core.web_bridge import WebBridge
from core.main_window import WebSocketTransport, CustomRequestHandler, _ThreadingHTTPServer

# Windows konsolunda Ctrl+C'nin Qt event loop'u tarafindan kilitlenmesini engeller
signal.signal(signal.SIGINT, signal.SIG_DFL)

def _start_frontend_http_server(directory, preferred_port=80):
    """dist/ klasörünü tüm ağda (0.0.0.0) web tarayıcıları için servis eder (Port 80 öncelikli)."""
    handler = functools.partial(CustomRequestHandler, directory=directory)
    ports_to_try = [preferred_port, 5175, 5176, 5177]
    for port in ports_to_try:
        try:
            httpd = _ThreadingHTTPServer(("0.0.0.0", port), handler)
            thread = threading.Thread(target=httpd.serve_forever, daemon=True)
            thread.start()
            if port == 80:
                print(f"[INFO] Frontend Web Sunucusu http://0.0.0.0 (Port 80) adresinde baslatildi.")
            else:
                print(f"[INFO] Frontend Web Sunucusu http://0.0.0.0:{port} adresinde baslatildi.")
            return httpd, port
        except OSError:
            continue
    httpd = _ThreadingHTTPServer(("0.0.0.0", 0), handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    actual_port = httpd.server_address[1]
    print(f"[INFO] Frontend Web Sunucusu http://0.0.0.0:{actual_port} adresinde baslatildi.")
    return httpd, actual_port

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
        self.websocket_server.setMaxPendingConnections(200)
        if not self.websocket_server.listen(QHostAddress.Any, 5174):
            print("[WARN] Port 5174 meşgul. Arka plandaki eski sunucu süreçleri temizleniyor...")
            try:
                import subprocess
                subprocess.run("taskkill /F /FI \"COMMANDLINE eq *server.py*\" >nul 2>&1", shell=True)
                time.sleep(1)
            except Exception:
                pass
            self.websocket_server.listen(QHostAddress.Any, 5174)

        if self.websocket_server.isListening():
            print("[INFO] WebSocket Arka Plan Sunucusu 5174 portunda (100+ Eşzamanlı Kullanıcı Kapasiteli) baslatildi.")
            self.websocket_server.newConnection.connect(self.on_new_websocket_connection)
        else:
            print("[ERROR] WebSocket sunucusu 5174 portunda başlatılamadı! Lütfen Görev Yöneticisi'nden eski python süreçlerini sonlandırın.")

        # Frontend dist dizinini kontrol et, eksik/uyumsuz paket varsa otomatik onar ve Web Sunucusunu başlat
        from core.main_window import ensure_frontend_dist_integrity
        ensure_frontend_dist_integrity()

        base_dir = os.path.dirname(os.path.abspath(__file__))
        dist_dir = os.path.join(base_dir, "frontend", "dist")

        if os.path.exists(dist_dir):
            self.http_server, self.http_port = _start_frontend_http_server(dist_dir, 80)
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

def _console_key_listener(app):
    """Windows konsolunda 'R' (restart), 'Q' (quit) tuşlarını anlık dinler."""
    try:
        import msvcrt
        while True:
            if msvcrt.kbhit():
                key = msvcrt.getch()
                if key in (b'r', b'R'):
                    print("\n[RESTART] 'R' tusuna basildi. Sunucu yeniden baslatiliyor...")
                    app.exit(42)
                    break
                elif key in (b'q', b'Q'):
                    print("\n[EXIT] 'Q' tusuna basildi. Sunucu kapatiliyor...")
                    app.exit(0)
                    break
            time.sleep(0.15)
    except Exception:
        pass

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

    # Qt event loop'un Python sinyallerini (SIGINT / Ctrl+C) islemesi icin periyodik timer
    timer = QTimer()
    timer.start(500)
    timer.timeout.connect(lambda: None)

    # Konsol tuş dinleyicisini başlat (R = Restart, Q = Quit)
    threading.Thread(target=_console_key_listener, args=(app,), daemon=True).start()
    
    port_str = f":{server.http_port}" if getattr(server, 'http_port', 80) != 80 else ""
    print("\n===================================================")
    print("[SUCCESS] RemaLab Sunucusu basariyla calisiyor.")
    print(f"  -> Frontend Arayuzu: http://localhost{port_str} veya http://<SUNUCU-IP>{port_str}")
    print("  -> WebSocket Servisi: ws://<SUNUCU-IP>:5174")
    print("===================================================")
    print("  [R] -> Sunucuyu Aninda Yeniden Baslat (Restart)")
    print("  [Q] -> Sunucuyu Kapat (Quit)")
    print("  [CTRL+C] -> Sunucuyu Durdur")
    print("===================================================\n")
    
    sys.exit(app.exec())

if __name__ == "__main__":
    main()
