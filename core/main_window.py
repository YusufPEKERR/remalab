"""
RemaLab WMS - Main Window (React Embedded via QWebChannel)
"""

from PySide6.QtWidgets import QMainWindow, QVBoxLayout, QWidget
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWebChannel import QWebChannel, QWebChannelAbstractTransport
from PySide6.QtWebSockets import QWebSocketServer
from PySide6.QtNetwork import QHostAddress
from PySide6.QtCore import QUrl, QTimer
import socket
import os
import functools
import http.server
import socketserver
import threading
import json
import gzip

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


import re
import shutil
import subprocess

def ensure_frontend_dist_integrity():
    """frontend/dist/index.html dosyasının ve içerisinde referans gösterilen
    /assets/*.js ve /assets/*.css derleme paketlerinin diskte var olduğunu doğrular.
    Eğer index.html yoksa veya referans gösterdiği paketler diskte yoksa (ör. git pull sonrası
    mismatch), npm run build çalıştırarak veya index.html referanslarını diskteki mevcut
    asset'ler ile eşleştirerek uygulamayı otomatik onarır (self-healing)."""
    try:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        frontend_dir = os.path.join(base_dir, "frontend")
        dist_dir = os.path.join(frontend_dir, "dist")
        index_html_path = os.path.join(dist_dir, "index.html")

        needs_rebuild = False

        if not os.path.exists(index_html_path):
            print("[WARN] frontend/dist/index.html bulunamadı! Otomatik derleme gerekiyor.")
            needs_rebuild = True
        else:
            with open(index_html_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()

            referenced_assets = re.findall(r'assets/([a-zA-Z0-9_\-\.]+)', content)
            missing_assets = []
            for asset_name in referenced_assets:
                asset_file = os.path.join(dist_dir, "assets", asset_name)
                if not os.path.exists(asset_file):
                    missing_assets.append(asset_name)

            if missing_assets:
                print(f"[WARN] frontend/dist/index.html referans verdiği {missing_assets} dosyaları diskte eksik! Otomatik onarım başlatılıyor.")
                needs_rebuild = True

        if needs_rebuild:
            npm_path = shutil.which("npm") or shutil.which("npm.cmd")
            if npm_path:
                print("[INFO] Node.js/npm tespit edildi. Frontend derlemesi başlatılıyor (npm run build)...")
                res = subprocess.run("npm run build", shell=True, cwd=frontend_dir)
                if res.returncode == 0:
                    print("[SUCCESS] Frontend arayüzü başarıyla derlendi ve onarıldı.")
                    return True
                else:
                    print("[ERROR] npm run build hata ile sonuçlandı.")
            else:
                print("[WARN] Sunucuda npm bulunamadı. Diskteki mevcut asset'ler ile index.html onarılmaya çalışılıyor...")
                assets_dir = os.path.join(dist_dir, "assets")
                if os.path.exists(assets_dir) and os.path.exists(index_html_path):
                    js_files = [f for f in os.listdir(assets_dir) if f.startswith("index-") and f.endswith(".js")]
                    css_files = [f for f in os.listdir(assets_dir) if f.startswith("index-") and f.endswith(".css")]
                    if js_files:
                        actual_js = js_files[0]
                        with open(index_html_path, "r", encoding="utf-8") as f:
                            html_text = f.read()
                        new_html = re.sub(r'assets/index-[a-zA-Z0-9_\-]+\.js', f'assets/{actual_js}', html_text)
                        if css_files:
                            new_html = re.sub(r'assets/index-[a-zA-Z0-9_\-]+\.css', f'assets/{css_files[0]}', new_html)
                        with open(index_html_path, "w", encoding="utf-8") as f:
                            f.write(new_html)
                        print(f"[SUCCESS] index.html referansı diskteki {actual_js} ile eşleştirilerek onarıldı.")
                        return True
    except Exception as e:
        print(f"[WARN] ensure_frontend_dist_integrity hatası: {e}")
    return False


_STATIC_RAM_CACHE = {}  # {filepath: (mtime, compressed_bytes, mime_type)}


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

    def log_error(self, format, *args):
        # Boştaki HTTP Keep-Alive bağlantıları zaman aşımına uğradığında
        # konsolda kirlilik oluşturan zararsız TimeoutError / socket.timeout uyarılarını gizle
        if args and ("timed out" in str(args[0]) or "TimeoutError" in str(args[0]) or "timeout" in str(args[0])):
            return
        super().log_error(format, *args)

    def translate_path(self, path):
        if path.endswith('/qwebchannel.js') and path != '/qwebchannel.js':
            path = '/qwebchannel.js'
        if path.startswith('/api_cache/'):
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            cache_dir = os.path.join(base_dir, 'api_cache')
            rel_path = path[len('/api_cache/'):]
            return os.path.join(cache_dir, rel_path)
        if path.endswith('/favicon.svg') and path != '/favicon.svg':
            path = '/favicon.svg'

        translated = super().translate_path(path)

        # Eğer istenen dosya /assets/ altında bir .js veya .css ise ve diskte YOKSA,
        # aynı klasördeki eşleşen mevcut .js/.css dosyasını servis et (404 / 'Uygulama başlatılıyor' kilitlenmelerini önler)
        if not os.path.exists(translated) and '/assets/' in path:
            filename = os.path.basename(path)
            parent_dir = os.path.dirname(translated)
            if os.path.exists(parent_dir):
                if filename.startswith('index-') and filename.endswith('.js'):
                    matches = [f for f in os.listdir(parent_dir) if f.startswith('index-') and f.endswith('.js')]
                    if matches:
                        return os.path.join(parent_dir, matches[0])
                elif filename.startswith('index-') and filename.endswith('.css'):
                    matches = [f for f in os.listdir(parent_dir) if f.startswith('index-') and f.endswith('.css')]
                    if matches:
                        return os.path.join(parent_dir, matches[0])

        return translated

    def do_GET(self):
        target_file = self.translate_path(self.path)
        if not os.path.exists(target_file) and not self.path.startswith('/api_cache/'):
            if not self.path.startswith('/assets/') and not self.path.endswith('.js') and not self.path.endswith('.css') and not self.path.endswith('.png') and not self.path.endswith('.svg'):
                self.path = '/index.html'
                target_file = self.translate_path(self.path)

        # Ağ üzerinden IP ile bağlanan kullanıcılar için statik paketleri (JS/CSS/JSON)
        # doğrudan Python RAM önbelleğinden servis et - 0 disk okuma, 0 ms yanıt süresi
        accept_encoding = self.headers.get("Accept-Encoding", "")
        if "gzip" in accept_encoding and os.path.isfile(target_file):
            ext = os.path.splitext(target_file)[1].lower()
            if ext in [".js", ".css", ".json", ".html", ".svg", ".txt"]:
                try:
                    mtime = os.path.getmtime(target_file)
                    cached = _STATIC_RAM_CACHE.get(target_file)
                    if cached and cached[0] == mtime:
                        compressed, mime_type = cached[1], cached[2]
                    else:
                        with open(target_file, "rb") as f:
                            raw_bytes = f.read()
                        compressed = gzip.compress(raw_bytes, compresslevel=6)
                        mime_type = self.guess_type(target_file)
                        _STATIC_RAM_CACHE[target_file] = (mtime, compressed, mime_type)

                    self.send_response(200)
                    self.send_header("Content-Type", mime_type)
                    self.send_header("Content-Encoding", "gzip")
                    self.send_header("Content-Length", str(len(compressed)))
                    self.send_header("Vary", "Accept-Encoding")
                    self.end_headers()
                    self.wfile.write(compressed)
                    return
                except Exception:
                    pass

        super().do_GET()

    def end_headers(self):
        # Statik sunucu cevaplarına Connection: close ekle ki tarayıcı TCP bağlantılarını
        # serbest bıraksın ve sunucu thread'leri saatler sonra bile kilitlenmesin
        self.send_header("Connection", "close")
        if self.path.startswith('/api_cache/'):
            self.send_header('Cache-Control', 'no-store')
        elif self.path.startswith('/assets/'):
            # Dosya adinda hash var, icerik degisince ad da degisir - guvenle onbelleklenir.
            self.send_header('Cache-Control', 'public, max-age=31536000, immutable')
        else:
            # index.html ve diger sabit adresli dosyalar ASLA onbellege alinmamali.
            # Bunlar hash'siz, sabit URL'de duruyor; onbellekten servis edilirse ESKI
            # hash'li bundle'lara isaret eden eski bir index.html yuklenir ve yeni
            # derleme yapilmis olsa bile ekranda hicbir sey degismez.
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
        super().end_headers()


class _ThreadingHTTPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True
    request_queue_size = 512  # 100+ Eşzamanlı Kullanıcı için Soket Bağlantı Kuyruğu Kapasitesi (512)


def _start_static_server(directory, preferred_port=5175):
    """dist/ klasörünü 127.0.0.1'de sabit bir portta servis eder (localStorage origin tutarlılığı için)."""
    ensure_frontend_dist_integrity()
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

        # ── YAZDIRMA ──
        # QtWebEngine'de JavaScript'teki window.print() KENDİLİĞİNDEN bir şey yapmaz;
        # yalnızca printRequested sinyalini yayar. Uygulama bu sinyali karşılamazsa
        # hiçbir yazdırma iletişim kutusu açılmaz ve buton "hiçbir şey yapmıyor" gibi
        # görünür - etiket yazdırma butonunun boş dönmesinin sebebi buydu.
        self.web_view.printRequested.connect(self._yazdirma_istegi)
        # Calisan surumun yazdirma destegi olup olmadigini konsoldan ayirt edebilmek icin.
        # Bu satiri gormuyorsaniz ESKI surec calisiyor demektir; python main.py ile yeniden baslatin.
        try:
            from PySide6.QtPrintSupport import QPrinterInfo
            _v = QPrinterInfo.defaultPrinter()
            print("[INFO] Yazdirma destegi AKTIF (yazici secim penceresi acilir). "
                  "Varsayilan yazici: "
                  + (_v.printerName() if not _v.isNull() else "yok"))
        except Exception as _e:
            print(f"[WARN] Yazdirma destegi kontrol edilemedi: {_e}")

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

    def _yazdirma_istegi(self):
        """Sayfadan window.print() çağrıldığında tetiklenir.

        DİKKAT: Qt'de printRequested işleyicisinin İÇİNDEN doğrudan print() çağırmak
        yeniden girişe yol açıyor ve uygulama sessizce KAPANIYOR. İş bir sonraki olay
        döngüsü turuna ertelenmeli.
        """
        QTimer.singleShot(0, self._yazdir)

    def _kagit_ayarla(self, printer, genislik, yukseklik):
        """Yaziciyi istenen etiket olcusune ayarlar; sorun varsa uyari metni doner.

        Etiket yazicilarinda medyanin FIZIKSEL genisligi sabittir. Ornegin DYMO 99014
        etiketi 54 mm genis / 101 mm uzundur. Tasarim 101x54 (yatay) istendiginde sayfa
        "101 mm genis" diye bildirilirse surucu 54 mm'lik medyaya sigdirmak icin iceriği
        KUCULTUYOR - cikti minicik oluyor. Dogrusu: medya olcusu (kisa kenar x uzun kenar)
        + YATAY yonlendirme.
        """
        from PySide6.QtCore import QMarginsF, QSizeF
        from PySide6.QtGui import QPageLayout, QPageSize
        from PySide6.QtPrintSupport import QPrinterInfo

        # Sayfa DAIMA medyanin fiziksel yonunde (dikey) bildirilir. Yatay tasarim
        # gerekiyorsa dondurmeyi CSS yapar (bkz. EtiketYazdirModal::yazdirmaCss).
        # Surucuye Landscape demek ise yaramiyor: cikti yine dikey geliyor ve tasarim
        # sigdirilmak icin kuculuyordu.
        medya_en, medya_boy = min(genislik, yukseklik), max(genislik, yukseklik)
        yon = QPageLayout.Orientation.Portrait

        # Yazicinin HAZIR TANIMLI formu varsa onu tercih et - ozel olcuden daha
        # guvenilir, surucu kendi besleme ayarlarini uygular.
        # Kullanici Etiket Tasarimi ekranindan bir form sectiyse ONCE o denenir.
        # Olcuye gore otomatik esleme her zaman dogru formu bulmuyor: DYMO'da ayni
        # 53.98x100.89 mm olcusunu uc form paylasiyor ve yanlis secilen form surucunun
        # kendi kenar bosluklariyla basiliyor - cerceve ve bos etiket bundan cikiyor.
        secilen_ad = ""
        try:
            secilen_ad = (getattr(self.web_bridge, "etiket_form_adi", "") or "").strip()
        except Exception:
            pass

        sayfa = None
        try:
            bilgi = QPrinterInfo.printerInfo(printer.printerName())
            adaylar = list(bilgi.supportedPageSizes())
            if secilen_ad:
                for aday in adaylar:
                    if aday.name().strip().lower() == secilen_ad.lower():
                        sayfa = aday
                        b = aday.size(QPageSize.Unit.Millimeter)
                        print(f"[INFO] Secilen kagit formu: {aday.name()} "
                              f"({b.width():.1f}x{b.height():.1f} mm)")
                        break
                if sayfa is None:
                    print(f"[WARN] '{secilen_ad}' formu bu yazicida yok; olcuye gore secilecek.")
            if sayfa is None:
                for aday in adaylar:
                    b = aday.size(QPageSize.Unit.Millimeter)
                    if abs(b.width() - medya_en) <= 1.5 and abs(b.height() - medya_boy) <= 1.5:
                        sayfa = aday
                        print(f"[INFO] Yazicinin hazir formu kullaniliyor: {aday.name()} "
                              f"({b.width():.0f}x{b.height():.0f} mm)")
                        break
        except Exception as e:
            print(f"[WARN] Yazici formlari okunamadi: {e}")
        if sayfa is None:
            sayfa = QPageSize(QSizeF(medya_en, medya_boy), QPageSize.Unit.Millimeter,
                              "Etiket", QPageSize.SizeMatchPolicy.ExactMatch)

        # ONCE setPageSize: DYMO'da setPageLayout(...) False donuyor ve yazici
        # varsayilan formunda (30252 Address, 27.87x88.90 mm) kaliyordu - olculdu.
        # setPageSize ise kabul ediliyor.
        uygulandi = printer.setPageSize(sayfa)
        if uygulandi:
            printer.setPageOrientation(yon)
        else:
            uygulandi = printer.setPageLayout(QPageLayout(
                sayfa, yon, QMarginsF(0, 0, 0, 0), QPageLayout.Unit.Millimeter))

        # TAM SAYFA MODU - ikinci etikete tasmanin asil sebebi buydu.
        # Etiket yazicilari sifir kenar boslugunu REDDEDIYOR: DYMO'da
        # setPageMargins(0) False donuyor ve 53.98x100.89 mm'lik 99014 etiketinde
        # Chromium'a yalnizca 51.44x93.53 mm tuval veriliyordu. Tasarim medya
        # olcusune (54x101) gore kurulunca 7.4 mm tasiyor, tasan serit IKINCI
        # ETIKETE basiliyor ve ikiye bolunen kutunun kenari cerceve gibi
        # gorunuyordu.
        #
        # setFullPage(True) sayfa duzenini FullPageMode'a alir: Qt artik Chromium'a
        # basilabilir alani degil MEDYANIN TAMAMINI tuval olarak verir, boylece
        # surucunun donanim kenar bosluklari sayfa kutusunu kucultmez. Sayfa kutusu
        # = fiziksel etiket oldugu icin her etiket TEK sayfaya sigar.
        #
        # Bedeli: yazicinin fiziksel olarak basamadigi en dis serit (DYMO'da ~1-1.5 mm)
        # artik kirpilir. Bu yuzden tasarim, sayfanin tamamini degil her kenardan
        # "kenar payi" kadar iceride kalan alani doldurur - bkz. EtiketYazdirModal.
        printer.setFullPage(True)
        printer.setPageMargins(QMarginsF(0, 0, 0, 0), QPageLayout.Unit.Millimeter)

        alan = printer.pageLayout().fullRect(QPageLayout.Unit.Millimeter)
        basilabilir = printer.pageLayout().paintRect(QPageLayout.Unit.Millimeter)
        # Formu kullanici kendi sectiyse olcu tutmasa da uyarilmaz - bilerek secmis.
        if (not uygulandi or (not secilen_ad and (abs(alan.width() - medya_en) > 2
                              or abs(alan.height() - medya_boy) > 2))):
            uyari = (f"Yazici '{printer.printerName()}' {medya_en:.0f}x{medya_boy:.0f} mm etiketi "
                     f"veremedi; basilacak alan {alan.width():.0f}x{alan.height():.0f} mm. "
                     f"Yazici ayarlarindan bu olcude bir etiket formu secin.")
            print("[WARN] " + uyari)
            return uyari
        # Not: dondurmeyi CSS yapiyor; burada yalnizca MEDYA olcusu bildirilir.
        # paintRect artik fullRect'e esit olmali (tam sayfa modu); esit degilse
        # surucu FullPageMode'u yok saymis demektir ve tasma yeniden baslar.
        print(f"[INFO] Etiket medyasi {alan.width():.1f}x{alan.height():.1f} mm olarak ayarlandi "
              f"(tuval {basilabilir.width():.1f}x{basilabilir.height():.1f} mm).")
        if (abs(basilabilir.width() - alan.width()) > 0.5
                or abs(basilabilir.height() - alan.height()) > 0.5):
            print("[WARN] Surucu tam sayfa modunu kabul etmedi; tuval medyadan kucuk kaldi.")
        return ""

    def _yazdirma_sonucu(self, durum, mesaj, yazici=""):
        """Son yazdirma isinin sonucunu ekranin okuyabilecegi yere yazar."""
        self.web_bridge.son_yazdirma_sonucu = {
            "durum": durum, "mesaj": mesaj, "yazici": yazici,
        }
        print(f"[{'INFO' if durum in ('gonderildi', 'tamamlandi') else 'ERROR'}] {mesaj}")

    def _baski_penceresi(self, pdf_yolu):
        """Yazici secimi + ONIZLEME tek pencerede. "Yazdir" secilirse True doner.

        NEDEN WINDOWS'UN PENCERESI DEGIL: Windows 11'in yazdirma penceresindeki
        onizleme alani "Bu uygulama yazdirma onizlemesini desteklemiyor" diyor ve
        DOLDURULAMAZ. O alani beslemek uygulamanin WinRT yazdirma sozlesmesini
        (PrintManager / IPrintDocumentSource) uygulamasini gerektirir; Qt'nin
        QPrintDialog'u eski PrintDlgEx API'sini cagirir, o API'de onizleme icerigi
        verecek bir kanal yoktur. Yani sorun uygulamada degil, hicbir Qt uygulamasinda
        o alan dolmaz. Cozum: Windows'un penceresini hic acmamak - yazici secimi,
        kopya sayisi ve onizleme burada, tek yerde.

        NEDEN QPrintPreviewDialog DEGIL: o sinif paintRequested icinde SENKRON cizim
        bekler; QWebEngineView.print() ise eszamansizdir, ikisi birlikte calismaz.
        Bunun yerine sayfa, gercek basimla AYNI sayfa duzeniyle PDF'e basilip
        gosteriliyor - yani onizlemede gordugunuz, motorun kagida cizecegi seyin
        birebir kendisi (sayfa sayisi dahil: etiket ikiye bolunuyorsa burada gorunur).
        """
        from PySide6.QtWidgets import (QDialog, QVBoxLayout, QHBoxLayout, QPushButton,
                                       QLabel, QComboBox, QSpinBox, QFrame, QWidget)
        from PySide6.QtGui import QPageLayout
        from PySide6.QtCore import Qt, QMargins
        from PySide6.QtPdf import QPdfDocument
        from PySide6.QtPdfWidgets import QPdfView
        from PySide6.QtPrintSupport import QPrinterInfo

        koyu = getattr(self.web_bridge, "baski_temasi", "dark") != "light"
        r = {
            "zemin":   "#12141c" if koyu else "#ffffff",
            "panel":   "#181a24" if koyu else "#f8fafc",
            "tuval":   "#0b0d13" if koyu else "#e9edf4",
            "kenar":   "#2a2e3d" if koyu else "#e2e8f0",
            "metin":   "#e6e9f5" if koyu else "#0f172a",
            "solgun":  "#8b93ab" if koyu else "#64748b",
            "vurgu":   "#7c3aed",
            "vurgu2":  "#6d28d9",
            "iyi":     "#22c55e" if koyu else "#16a34a",
            "uyari":   "#f59e0b" if koyu else "#b45309",
        }

        pencere = QDialog(self)
        pencere.setWindowTitle("Etiket Yazdır")
        pencere.resize(900, 740)
        pencere.setStyleSheet(f"""
            QDialog {{ background: {r['zemin']}; }}
            QLabel {{ color: {r['metin']}; font-size: 12px; }}
            QLabel#baslik {{ font-size: 17px; font-weight: 700; }}
            QLabel#etiketAdi {{ color: {r['solgun']}; font-size: 11px; font-weight: 600;
                                text-transform: uppercase; letter-spacing: 1px; }}
            QFrame#kart {{ background: {r['panel']}; border: 1px solid {r['kenar']};
                           border-radius: 12px; }}
            QComboBox, QSpinBox {{
                background: {r['zemin']}; color: {r['metin']};
                border: 1px solid {r['kenar']}; border-radius: 8px;
                padding: 7px 10px; font-size: 12px; min-height: 18px;
            }}
            QComboBox:focus, QSpinBox:focus {{ border-color: {r['vurgu']}; }}
            QComboBox::drop-down {{ border: none; width: 22px; }}
            QComboBox QAbstractItemView {{
                background: {r['panel']}; color: {r['metin']};
                border: 1px solid {r['kenar']}; selection-background-color: {r['vurgu']};
                outline: none;
            }}
            QPushButton {{
                background: {r['panel']}; color: {r['metin']};
                border: 1px solid {r['kenar']}; border-radius: 9px;
                padding: 9px 18px; font-size: 12px; font-weight: 600;
            }}
            QPushButton:hover {{ border-color: {r['solgun']}; }}
            QPushButton#birincil {{ background: {r['vurgu']}; border-color: {r['vurgu']};
                                    color: #ffffff; }}
            QPushButton#birincil:hover {{ background: {r['vurgu2']}; }}
            QPushButton#birincil:disabled {{ background: {r['kenar']};
                                             border-color: {r['kenar']}; color: {r['solgun']}; }}
            QPdfView {{ background: {r['tuval']}; border: 1px solid {r['kenar']};
                        border-radius: 12px; }}
        """)

        belge = QPdfDocument(pencere)
        gorunum = QPdfView(pencere)
        gorunum.setDocument(belge)
        gorunum.setPageMode(QPdfView.PageMode.MultiPage)
        gorunum.setZoomMode(QPdfView.ZoomMode.FitInView)
        gorunum.setDocumentMargins(QMargins(18, 18, 18, 18))

        yazici_kutusu = QComboBox()
        adlar = [i.printerName() for i in QPrinterInfo.availablePrinters()]
        yazici_kutusu.addItems(adlar)
        if self._printer.printerName() in adlar:
            yazici_kutusu.setCurrentText(self._printer.printerName())
        kopya = QSpinBox()
        kopya.setRange(1, 99)
        kopya.setValue(1)

        # Sayfa sayisi bilerek one cikariliyor: etiket sigmayip ikiye bolunuyorsa
        # etiket harcamadan burada gorulur.
        ozet = QLabel()
        ozet.setWordWrap(True)
        olcu_etiketi = QLabel()
        olcu_etiketi.setWordWrap(True)
        olcu_etiketi.setStyleSheet(f"color: {r['solgun']}; font-size: 11px;")

        def bilgi_tazele(mesaj=None):
            if mesaj:
                ozet.setText(f"<span style='color:{r['solgun']}'>{mesaj}</span>")
                return
            sayfa_sayisi = belge.pageCount()
            beklenen = getattr(self.web_bridge, "baski_etiket_sayisi", 0)
            if beklenen and sayfa_sayisi > beklenen:
                ozet.setText(
                    f"<span style='color:{r['uyari']};font-weight:700'>⚠ {beklenen} etiket "
                    f"→ {sayfa_sayisi} sayfa</span><br>"
                    f"<span style='color:{r['solgun']}'>Tasarım etikete sığmıyor, taşan "
                    f"kısım sonraki etikete basılacak. Etiket Tasarımı'ndan kenar payını "
                    f"artırın veya barkodu küçültün.</span>")
            elif beklenen:
                ozet.setText(f"<span style='color:{r['iyi']};font-weight:700'>✓ {beklenen} "
                             f"etiket → {sayfa_sayisi} sayfa</span>")
            else:
                ozet.setText(f"<b>{sayfa_sayisi} sayfa</b>")
            o = self._printer.pageLayout().fullRect(QPageLayout.Unit.Millimeter)
            olcu_etiketi.setText(f"Kağıt {o.width():.1f} × {o.height():.1f} mm")

        belge.load(pdf_yolu)
        bilgi_tazele()

        def yazici_degisti(ad):
            """Baska yazici secilirse kagit ayari VE onizleme yeniden uretilir -
            her yazicinin medya olculeri farkli, eski onizleme yaniltici olur."""
            secilen = QPrinterInfo.printerInfo(ad)
            if secilen.isNull():
                return
            self._printer.setPrinterName(ad)
            olcu = getattr(self.web_bridge, "son_etiket_olcusu", None)
            if olcu:
                self._kagit_ayarla(self._printer, float(olcu[0]), float(olcu[1]))
            bilgi_tazele("Önizleme yenileniyor…")
            yazdir_dugmesi.setEnabled(False)

            def yenilendi(yeni_yol):
                yazdir_dugmesi.setEnabled(True)
                if yeni_yol:
                    belge.load(yeni_yol)
                    bilgi_tazele()
                else:
                    bilgi_tazele("Önizleme yenilenemedi; çıktı yine de doğru ölçüde basılır.")

            self._onizleme_pdf_uret(yenilendi)

        iptal = QPushButton("İptal")
        yazdir_dugmesi = QPushButton("Yazdır")
        yazdir_dugmesi.setObjectName("birincil")
        yazdir_dugmesi.setDefault(True)
        iptal.clicked.connect(pencere.reject)
        yazdir_dugmesi.clicked.connect(pencere.accept)
        yazici_kutusu.currentTextChanged.connect(yazici_degisti)

        def alan(baslik, widget):
            kap = QVBoxLayout()
            kap.setSpacing(5)
            et = QLabel(baslik)
            et.setObjectName("etiketAdi")
            kap.addWidget(et)
            kap.addWidget(widget)
            return kap

        baslik = QLabel("Etiket Yazdır")
        baslik.setObjectName("baslik")

        ozet_karti = QFrame()
        ozet_karti.setObjectName("kart")
        ozet_duzen = QVBoxLayout(ozet_karti)
        ozet_duzen.setContentsMargins(14, 12, 14, 12)
        ozet_duzen.setSpacing(4)
        ozet_duzen.addWidget(ozet)
        ozet_duzen.addWidget(olcu_etiketi)

        sol = QVBoxLayout()
        sol.setContentsMargins(0, 0, 0, 0)
        sol.setSpacing(16)
        sol.addWidget(baslik)
        sol.addLayout(alan("Yazıcı", yazici_kutusu))
        sol.addLayout(alan("Kopya", kopya))
        sol.addWidget(ozet_karti)
        sol.addStretch(1)
        dugmeler = QHBoxLayout()
        dugmeler.setSpacing(10)
        dugmeler.addWidget(iptal, 1)
        dugmeler.addWidget(yazdir_dugmesi, 1)
        sol.addLayout(dugmeler)

        sol_panel = QWidget()
        sol_panel.setLayout(sol)
        sol_panel.setFixedWidth(268)

        govde = QHBoxLayout(pencere)
        govde.setContentsMargins(20, 20, 20, 20)
        govde.setSpacing(18)
        # Sol panel dikeyde DOLDURUR (AlignTop degil): aradaki esneme sayesinde
        # butonlar pencerenin altina yaslanir.
        govde.addWidget(sol_panel, 0)
        govde.addWidget(gorunum, 1)

        kabul = pencere.exec() == QDialog.DialogCode.Accepted
        if kabul:
            self._printer.setCopyCount(kopya.value())
        # Belge dosyayi acik tutuyor; kapatilmazsa gecici PDF silinemiyor.
        belge.close()
        return kabul

    def _yazdir(self):
        """Baskı önizlemesini, ardından yazıcı seçim penceresini açar.

        Kağıt ölçüsü CSS'teki @page'ten değil, ekranın yazdırmadan hemen önce bildirdiği
        değerden alınır (WebBridge.set_label_page_size) - sürücülerin çoğu @page'i yok
        sayıp etiketi A4'e ortalıyor.

        QPrinter self üzerinde tutulur: yazdırma eşzamansız olduğu için yerel değişkende
        tutulursa çöp toplayıcı onu iş bitmeden yok ediyor ve çıktı boş geliyor.
        """
        from PySide6.QtPrintSupport import QPrinter, QPrinterInfo

        if getattr(self, "_yazdirma_suruyor", False) or getattr(self, "_onizleme_acik", False):
            print("[WARN] Onceki yazdirma isi surerken yeni istek geldi, yok sayildi.")
            return

        # Onceki isin sonucu temizlenir: ekran basimdan 2.5 sn sonra sonucu soruyor,
        # onizleme/yazici penceresinde daha uzun kalinirsa BIR ONCEKI isin sonucunu
        # okuyup yaniltici bildirim gosteriyordu.
        self.web_bridge.son_yazdirma_sonucu = None

        try:
            varsayilan = QPrinterInfo.defaultPrinter()
            self._printer = (QPrinter(varsayilan, QPrinter.PrinterMode.HighResolution)
                             if not varsayilan.isNull()
                             else QPrinter(QPrinter.PrinterMode.HighResolution))

            olcu = getattr(self.web_bridge, "son_etiket_olcusu", None)
            kagit_uyarisi = ""
            if olcu:
                kagit_uyarisi = self._kagit_ayarla(self._printer, float(olcu[0]), float(olcu[1]))

            if not getattr(self.web_bridge, "baski_onizleme_istendi", True):
                self._yazdirma_penceresi(kagit_uyarisi)
                return

            self._onizleme_uret(kagit_uyarisi)
        except Exception as e:
            self._yazdirma_suruyor = False
            self._onizleme_acik = False
            self._yazdirma_sonucu("hata", f"Yazdirma baslatilamadi: {e}")

    def _onizleme_pdf_uret(self, geri):
        """Sayfayi GECERLI sayfa duzeniyle gecici bir PDF'e basar; bitince geri(yol) cagirir.

        printToPdf ESZAMANSIZDIR - is bitince pdfPrintingFinished sinyali gelir; bu
        yuzden sonuc geri cagriyla verilir. Uretilemezse geri(None) cagrilir.
        Yazici degistirildiginde onizlemeyi tazelemek icin de kullanilir.
        """
        import tempfile

        yol = os.path.join(tempfile.gettempdir(), "remalab_etiket_onizleme.pdf")
        try:
            if os.path.exists(yol):
                os.remove(yol)
        except OSError:
            # Onizleme penceresi hala acikken dosya kilitli olabilir; farkli ad kullan.
            yol = os.path.join(tempfile.gettempdir(),
                               f"remalab_etiket_onizleme_{os.getpid()}.pdf")

        sayfa = self.web_view.page()

        def pdf_hazir(uretilen, basarili):
            try:
                sayfa.pdfPrintingFinished.disconnect(pdf_hazir)
            except (RuntimeError, TypeError):
                pass
            geri(uretilen if (basarili and os.path.exists(uretilen)) else None)

        sayfa.pdfPrintingFinished.connect(pdf_hazir)
        sayfa.printToPdf(yol, self._printer.pageLayout())

    def _onizleme_uret(self, kagit_uyarisi):
        """Onizlemeyi uretip yazdirma penceresini (yazici secimi + onizleme) acar.

        Onizleme uretilemezse basim ENGELLENMEZ; Windows'un yazdirma penceresine dusulur.
        """
        self._onizleme_acik = True

        def pdf_hazir(yol):
            self._onizleme_acik = False
            if yol is None:
                print("[WARN] Baski onizlemesi uretilemedi; Windows yazdirma penceresi aciliyor.")
                self._yazdirma_penceresi(kagit_uyarisi)
                return
            try:
                devam = self._baski_penceresi(yol)
            except Exception as e:
                # QtPdf yoksa veya pencere kurulamazsa basim engellenmemeli.
                print(f"[WARN] Yazdirma penceresi acilamadi ({e}); Windows penceresine dusuluyor.")
                self._yazdirma_penceresi(kagit_uyarisi)
                return
            try:
                os.remove(yol)
            except OSError:
                pass
            if devam:
                # Yazici ve kopya sayisi pencerede secildi; Windows'un penceresi ACILMAZ.
                self._bas(kagit_uyarisi)
            else:
                self._yazdirma_sonucu("iptal", "Yazdirma onizleme penceresinde iptal edildi.")

        self._onizleme_pdf_uret(pdf_hazir)

    def _yazdirma_penceresi(self, kagit_uyarisi):
        """WINDOWS'UN yazdirma penceresi. Yalnizca onizleme kapaliyken veya onizleme
        uretilemediginde kullanilir; normal akista _baski_penceresi devreye girer.

        Sessiz basimda is her zaman Windows'un varsayilan yazicisina gidiyordu; sahada
        varsayilan cogu zaman etiket yazicisi degil (or. AnyDesk Printer gibi sanal bir
        yazici) ve cikti sessizce kayboluyordu. Pencere dogru yazicinin secilmesini saglar.
        """
        from PySide6.QtPrintSupport import QPrintDialog

        try:
            dialog = QPrintDialog(self._printer, self)
            dialog.setWindowTitle("Etiket Yazdır")
            if dialog.exec() != QPrintDialog.DialogCode.Accepted:
                self._yazdirma_sonucu("iptal", "Yazdirma kullanici tarafindan iptal edildi.")
                return

            # Kullanici pencerede BASKA bir yazici sectiyse kagit ayari o yaziciya gore
            # yeniden yapilmali; her yazicinin medya olculeri farkli.
            olcu = getattr(self.web_bridge, "son_etiket_olcusu", None)
            if olcu:
                kagit_uyarisi = self._kagit_ayarla(self._printer, float(olcu[0]), float(olcu[1]))
        except Exception as e:
            self._yazdirma_suruyor = False
            self._yazdirma_sonucu("hata", f"Yazdirma baslatilamadi: {e}")
            return

        self._bas(kagit_uyarisi)

    def _bas(self, kagit_uyarisi):
        """Isi secilen yaziciya gonderir. Yazici/kopya secimi cagirandan gelir."""
        try:
            self._yazdirma_suruyor = True

            def bitti(basarili):
                self._yazdirma_suruyor = False
                if basarili:
                    self._yazdirma_sonucu(
                        "tamamlandi",
                        f"Yazdirma tamamlandi -> {self._printer.printerName()}",
                        self._printer.printerName())
                else:
                    self._yazdirma_sonucu(
                        "hata",
                        f"Yazici '{self._printer.printerName()}' isi reddetti veya yanit vermedi.",
                        self._printer.printerName())

            if hasattr(self.web_view, "printFinished"):
                try:
                    self.web_view.printFinished.disconnect()
                except Exception:
                    pass
                try:
                    self.web_view.printFinished.connect(bitti)
                except Exception:
                    self._yazdirma_suruyor = False

            self._yazdirma_sonucu(
                "gonderildi",
                f"Is yaziciya gonderildi -> {self._printer.printerName()}"
                + (" | " + kagit_uyarisi if kagit_uyarisi else ""),
                self._printer.printerName())
            self.web_view.print(self._printer)
        except Exception as e:
            self._yazdirma_suruyor = False
            self._yazdirma_sonucu("hata", f"Yazdirma baslatilamadi: {e}")

    def on_new_websocket_connection(self):
        socket = self.websocket_server.nextPendingConnection()
        transport = WebSocketTransport(socket)
        self.channel.connectTo(transport)
        self.transports.append(transport)
        socket.disconnected.connect(lambda: self.transports.remove(transport) if transport in self.transports else None)

