"""
RemaLab WMS - Main Window (React Embedded via QWebChannel)
"""

from PySide6.QtWidgets import QMainWindow, QVBoxLayout, QWidget
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWebChannel import QWebChannel
from PySide6.QtCore import QUrl
import os
import functools
import http.server
import socketserver
import threading

from core.web_bridge import WebBridge

from PySide6.QtWebEngineCore import QWebEnginePage


def _start_static_server(directory):
    """dist/ klasörünü 127.0.0.1'de servis eder (ES module script'leri file:// üzerinden
    Chromium'un CORS politikası yüzünden yüklenemiyor, bu yüzden diskten değil localhost'tan okunur)."""
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=directory)
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
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
        from PySide6.QtWebEngineCore import QWebEngineProfile
        self.profile = QWebEngineProfile("remalab_persistent_profile", self)
        
        # Windows/Linux/Mac için standart veri yoluna kaydet
        storage_path = os.path.join(os.path.expanduser("~"), ".remalab", "webengine_data")
        self.profile.setPersistentStoragePath(storage_path)
        self.profile.setCachePath(storage_path)
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

