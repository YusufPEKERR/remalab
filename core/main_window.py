"""
RemaLab WMS - Main Window (React Embedded via QWebChannel)
"""

from PySide6.QtWidgets import QMainWindow, QVBoxLayout, QWidget
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWebChannel import QWebChannel, QWebChannelAbstractTransport
from PySide6.QtWebSockets import QWebSocketServer
from PySide6.QtNetwork import QHostAddress
from PySide6.QtCore import QUrl
import os
import functools
import http.server
import socketserver
import threading
import json

from core.web_bridge import WebBridge

from PySide6.QtWebEngineCore import QWebEnginePage


class WebSocketTransport(QWebChannelAbstractTransport):
    def __init__(self, socket):
        super().__init__(socket)
        self.socket = socket
        self.socket.textMessageReceived.connect(self.on_text_message_received)
        self.socket.disconnected.connect(self.deleteLater)

    def sendMessage(self, message):
        json_str = json.dumps(message)
        self.socket.sendTextMessage(json_str)

    def on_text_message_received(self, text):
        try:
            message = json.loads(text)
            self.messageReceived.emit(message, self)
        except Exception as e:
            print(f"[ERROR] WebSocket transport parse error: {e}")


class CustomRequestHandler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def handle(self):
        # Socket zaman aşımını 5 saniye olarak ayarla ki atıl kalmış TCP bağlantıları
        # sunucu thread'lerini sonsuza kadar tıkamasın (port 80 kilitlenmelerini önler)
        try:
            self.request.settimeout(5.0)
            super().handle()
        except (Exception, socket.timeout, ConnectionResetError, BrokenPipeError):
            pass

    def end_headers(self):
        # index.html ASLA onbellege alinmamali. Statik sunucu sabit bir portta calisiyor
        # (localStorage origin tutarliligi icin), yani origin restart'lar arasinda ayni
        # kaliyor ve QtWebEngine'in KALICI disk onbellegi devrede. Cache-Control
        # gondermezsek QtWebEngine index.html'i sezgisel olarak onbellekten servis edip
        # ESKI hash'li bundle'lari yukluyor; yeni derleme yapilmis olsa bile ekranda
        # hicbir sey degismiyor (bu hata canli olarak yasandi).
        # /assets/ altindaki dosyalarin adinda hash var, icerik degisince ad da degisir -
        # onlar guvenle uzun sure onbelleklenebilir.
        if self.path.startswith('/assets/'):
            self.send_header('Cache-Control', 'public, max-age=31536000, immutable')
        else:
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
        super().end_headers()

    def translate_path(self, path):
        if path.startswith('/api_cache/'):
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            cache_dir = os.path.join(base_dir, 'api_cache')
            rel_path = path[len('/api_cache/'):]
            return os.path.join(cache_dir, rel_path)
        if path.endswith('/favicon.svg') and path != '/favicon.svg':
            path = '/favicon.svg'
        return super().translate_path(path)

    def do_GET(self):
        target_file = self.translate_path(self.path)
        if not os.path.exists(target_file) and not self.path.startswith('/api_cache/'):
            if not self.path.startswith('/assets/'):
                self.path = '/index.html'
        super().do_GET()

    def end_headers(self):
        # Statik sunucu cevaplarına Connection: close ekle ki tarayıcı TCP bağlantılarını
        # serbest bıraksın ve sunucu thread'leri saatler sonra bile kilitlenmesin
        self.send_header("Connection", "close")
        if self.path.startswith('/api_cache/'):
            self.send_header('Cache-Control', 'no-store')
        elif self.path.startswith('/assets/'):
            self.send_header('Cache-Control', 'public, max-age=31536000, immutable')
        super().end_headers()


class _ThreadingHTTPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True
    request_queue_size = 512  # 100+ Eşzamanlı Kullanıcı için Soket Bağlantı Kuyruğu Kapasitesi (512)


def _start_static_server(directory, preferred_port=5175):
    """dist/ klasörünü 127.0.0.1'de sabit bir portta servis eder (localStorage origin tutarlılığı için)."""
    handler = functools.partial(CustomRequestHandler, directory=directory)
    for port in range(preferred_port, preferred_port + 20):
        try:
            httpd = _ThreadingHTTPServer(("127.0.0.1", port), handler)
            thread = threading.Thread(target=httpd.serve_forever, daemon=True)
            thread.start()
            print(f"[INFO] Statik sunucu {port} portunda başlatıldı.")
            return httpd
        except OSError:
            continue
    httpd = _ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return httpd


def _is_port_in_use(host, port):
    """Portun kullanımda olup olmadığını kontrol eder."""
    import socket
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            return s.connect_ex((host, port)) == 0
    except Exception:
        return False

class WebPage(QWebEnginePage):
    def __init__(self, profile, parent=None):
        super().__init__(profile, parent)
        self.featurePermissionRequested.connect(self.on_feature_permission_requested)

    def on_feature_permission_requested(self, url, feature):
        self.setFeaturePermission(url, feature, QWebEnginePage.PermissionPolicy.PermissionGrantedByUser)

    def javaScriptConsoleMessage(self, level, message, lineNumber, sourceID):
        print(f"[JS] {message} (line: {lineNumber}, source: {sourceID})")

    def chooseFiles(self, mode, oldFiles, acceptedMimeTypes):
        from PySide6.QtWidgets import QFileDialog
        dialog = QFileDialog()
        if mode == QWebEnginePage.FileSelectionMode.FileSelectOpenMultiple:
            dialog.setFileMode(QFileDialog.FileMode.ExistingFiles)
        else:
            dialog.setFileMode(QFileDialog.FileMode.ExistingFile)
            
        if dialog.exec():
            return dialog.selectedFiles()
        return []

class MainWindow(QMainWindow):
    """Ana uygulama penceresi."""

    def __init__(self):
        super().__init__()
        self.setWindowTitle("RemaLab WMS - React UI")
        self.setMinimumSize(1280, 800)
        self.resize(1440, 900)

        self._central_widget = QWidget()
        self.setCentralWidget(self._central_widget)
        self._layout = QVBoxLayout(self._central_widget)
        self._layout.setContentsMargins(0, 0, 0, 0)
        self._layout.setSpacing(0)

        # WebEngineView oluştur
        self.web_view = QWebEngineView()
        # QWebEngineProfile Kurulumu (Kalıcı Profil)
        from PySide6.QtWebEngineCore import QWebEngineProfile, QWebEngineSettings
        self.profile = QWebEngineProfile("remalab_persistent_profile", self)
        
        # Windows/Linux/Mac için standart veri yoluna kaydet
        storage_path = os.path.join(os.path.expanduser("~"), ".remalab", "webengine_data")
        os.makedirs(storage_path, exist_ok=True)
        self.profile.setPersistentStoragePath(storage_path)
        self.profile.setCachePath(storage_path)
        self.profile.setPersistentCookiesPolicy(QWebEngineProfile.PersistentCookiesPolicy.AllowPersistentCookies)
        self.profile.settings().setAttribute(QWebEngineSettings.WebAttribute.LocalStorageEnabled, True)
        self.profile.settings().setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, True)
        self.profile.settings().setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessFileUrls, True)
        # Disk hatası almamak ama performansı artırmak için RAM'e önbellekle
        self.profile.setHttpCacheType(QWebEngineProfile.HttpCacheType.MemoryHttpCache)

        # Custom page for JS logs (Kalıcı profili kullanarak)
        self.web_page = WebPage(self.profile, self.web_view)
        
        # Siyah arkaplan ayarla (Beyaz ekran parlamasını önlemek için)
        from PySide6.QtGui import QColor
        self.web_page.setBackgroundColor(QColor("#0f1219"))
        
        self.web_view.setPage(self.web_page)
        
        self._layout.addWidget(self.web_view)

        # QWebChannel Kurulumu
        self.channel = QWebChannel()
        self.web_bridge = WebBridge()
        self.channel.registerObject("backend", self.web_bridge)
        self.web_view.page().setWebChannel(self.channel)

        # WebSocket Server Kurulumu (Web tarayıcılarından gelen QWebChannel bağlantıları için)
        self.transports = []
        self.websocket_server = QWebSocketServer(
            "RemaLab WMS WebSocket Server",
            QWebSocketServer.NonSecureMode,
            self
        )
        if self.websocket_server.listen(QHostAddress.Any, 5174):
            print("[INFO] QWebChannel WebSocket sunucusu 5174 portunda başlatıldı.")
            self.websocket_server.newConnection.connect(self.on_new_websocket_connection)
        else:
            print("[ERROR] QWebChannel WebSocket sunucusu başlatılamadı!")

        # Varsayılan: Vite dev sunucusuna bağlan (DEV_MODE .env'de "0" ise
        # Ayarlar > Dev Mode'dan kapatılmıştır, derlenmiş sürüm yerel bir statik
        # sunucudan yüklenir).
        self._dev_process = None
        self._static_httpd = None

        if os.getenv("DEV_MODE", "1") == "1":
            frontend_dev_url = "http://127.0.0.1:5173"
            if not _is_port_in_use("127.0.0.1", 5173):
                # React/Vite dev sunucusunu otomatik başlat
                base_dir = os.path.dirname(os.path.dirname(__file__))
                frontend_dir = os.path.join(base_dir, "frontend")
                import subprocess
                import sys

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
                    print("[INFO] React Vite dev sunucusu otomatik başlatılıyor...")
                except Exception as e:
                    print(f"[ERROR] React dev sunucusu başlatılamadı: {e}")

            # Sunucu hazır olana kadar bekle (max 5 sn)
            if self._dev_process:
                import time
                from PySide6.QtCore import QCoreApplication
                start_time = time.time()
                while time.time() - start_time < 5:
                    if _is_port_in_use("127.0.0.1", 5173):
                        break
                    QCoreApplication.processEvents()
                    time.sleep(0.1)

            self.web_view.load(QUrl(frontend_dev_url))
        else:
            base_dir = os.path.dirname(os.path.dirname(__file__))
            dist_dir = os.path.join(base_dir, "frontend", "dist")
            self._static_httpd = _start_static_server(dist_dir)
            port = self._static_httpd.server_address[1]
            self.web_view.load(QUrl(f"http://127.0.0.1:{port}/"))

    def closeEvent(self, event):
        # Uygulama kapatılırken arka planda başlatılan Vite dev sunucusunu sonlandır
        if hasattr(self, "_dev_process") and self._dev_process:
            try:
                import subprocess
                import sys
                if sys.platform == "win32":
                    subprocess.run(
                        ["taskkill", "/F", "/T", "/PID", str(self._dev_process.pid)],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        creationflags=subprocess.CREATE_NO_WINDOW
                    )
                else:
                    self._dev_process.terminate()
                    self._dev_process.wait(timeout=2)
                print("[INFO] React Vite dev sunucusu durduruldu.")
            except Exception as e:
                print(f"[WARN] React dev sunucusu kapatılamadı: {e}")

        # Statik sunucuyu temizle
        if hasattr(self, "_static_httpd") and self._static_httpd:
            try:
                self._static_httpd.shutdown()
                print("[INFO] Statik sunucu durduruldu.")
            except Exception as e:
                print(f"[WARN] Statik sunucu kapatılamadı: {e}")

        event.accept()

    def on_new_websocket_connection(self):
        socket = self.websocket_server.nextPendingConnection()
        transport = WebSocketTransport(socket)
        self.channel.connectTo(transport)
        self.transports.append(transport)
        socket.disconnected.connect(lambda: self.transports.remove(transport) if transport in self.transports else None)

