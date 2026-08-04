import sys
import os
import json
import uuid
import urllib.parse

# Chromium Donanım İvmelendirmesi ve Maksimum Performans Bayrakları (GPU & Skia Render)
os.environ["QTWEBENGINE_CHROMIUM_FLAGS"] = (
    "--enable-gpu-rasterization "
    "--enable-zero-copy "
    "--ignore-gpu-blocklist "
    "--enable-features=UseSkiaRenderer,CanvasOopRasterization "
    "--enable-smooth-scrolling"
)

from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QDialog, QToolBar, QComboBox, QLineEdit,
    QPushButton, QVBoxLayout, QHBoxLayout, QWidget, QStatusBar, QMessageBox,
    QListWidget, QListWidgetItem, QLabel, QToolButton
)
from PyQt6.QtCore import QUrl, Qt, QSize, pyqtSignal
from PyQt6.QtGui import QIcon, QPixmap, QKeySequence, QShortcut
from PyQt6.QtWebEngineWidgets import QWebEngineView
from PyQt6.QtWebEngineCore import QWebEnginePage, QWebEngineProfile, QWebEngineSettings


class AddEditSiteDialog(QDialog):
    """Yeni site ekleme veya mevcut siteyi düzenleme penceresi."""
    def __init__(self, parent=None, site_data=None):
        super().__init__(parent)
        self.site_data = site_data or {}
        self.init_ui()

    def init_ui(self):
        self.setWindowTitle("✏️ Site Düzenle" if self.site_data else "➕ Yeni Site Ekle")
        self.setFixedSize(440, 260)
        self.setStyleSheet("""
            QDialog {
                background-color: #12131c;
                color: #f3f4f6;
            }
            QLabel {
                color: #e5e7eb;
                font-size: 13px;
                font-weight: 600;
            }
            QLineEdit {
                background-color: #1a1b28;
                border: 1.5px solid #2d3045;
                border-radius: 8px;
                padding: 10px;
                color: #f3f4f6;
                font-size: 13px;
            }
            QLineEdit:focus {
                border: 1.5px solid #6366f1;
                background-color: #1f2030;
            }
            QPushButton {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #6366f1, stop:1 #4f46e5);
                color: #ffffff;
                border: none;
                border-radius: 8px;
                padding: 9px 20px;
                font-weight: 700;
                font-size: 13px;
            }
            QPushButton:hover {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #4f46e5, stop:1 #4338ca);
            }
            QPushButton#cancelBtn {
                background: #252738;
                color: #9ca3af;
                border: 1px solid #373952;
            }
            QPushButton#cancelBtn:hover {
                background: #32354c;
                color: #ffffff;
            }
        """)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(14)

        # Site Adı
        layout.addWidget(QLabel("Site Adı (Ör: ERP Paneli, Google):"))
        self.name_input = QLineEdit()
        self.name_input.setPlaceholderText("Örn: ERP Sistemi")
        self.name_input.setText(self.site_data.get("name", ""))
        layout.addWidget(self.name_input)

        # Site URL
        layout.addWidget(QLabel("Site Adresi (URL):"))
        self.url_input = QLineEdit()
        self.url_input.setPlaceholderText("https://example.com")
        self.url_input.setText(self.site_data.get("url", ""))
        layout.addWidget(self.url_input)

        # Butonlar
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()

        cancel_btn = QPushButton("İptal")
        cancel_btn.setObjectName("cancelBtn")
        cancel_btn.clicked.connect(self.reject)
        btn_layout.addWidget(cancel_btn)

        save_btn = QPushButton("Kaydet")
        save_btn.clicked.connect(self.save_site)
        btn_layout.addWidget(save_btn)

        layout.addLayout(btn_layout)

    def save_site(self):
        name = self.name_input.text().strip()
        url = self.url_input.text().strip()

        if not name:
            QMessageBox.warning(self, "Hata", "Lütfen bir site adı girin.")
            return

        if not url:
            QMessageBox.warning(self, "Hata", "Lütfen bir site URL'si girin.")
            return

        if not (url.startswith("http://") or url.startswith("https://")):
            url = "https://" + url

        self.result_data = {
            "id": self.site_data.get("id", str(uuid.uuid4())),
            "name": name,
            "url": url
        }
        self.accept()


class SettingsDialog(QDialog):
    """Kayıtlı web sitelerini yönetme ve varsayılan siteyi seçme penceresi."""
    sites_updated = pyqtSignal()

    def __init__(self, json_path, parent=None):
        super().__init__(parent)
        self.json_path = json_path
        self.sites_data = {"default_site_id": "", "sites": []}
        self.load_data()
        self.init_ui()

    def load_data(self):
        if os.path.exists(self.json_path):
            try:
                with open(self.json_path, "r", encoding="utf-8") as f:
                    self.sites_data = json.load(f)
            except Exception as e:
                print(f"Data okuma hatası: {e}")

    def save_data(self):
        try:
            with open(self.json_path, "w", encoding="utf-8") as f:
                json.dump(self.sites_data, f, ensure_ascii=False, indent=2)
            self.sites_updated.emit()
        except Exception as e:
            QMessageBox.critical(self, "Hata", f"Veriler kaydedilemedi: {e}")

    def init_ui(self):
        self.setWindowTitle("⚙️ Web Sitesi Yöneticisi & Ayarlar")
        self.setMinimumSize(580, 420)
        self.setStyleSheet("""
            QDialog {
                background-color: #0f1017;
                color: #f3f4f6;
            }
            QLabel#headerTitle {
                color: #ffffff;
                font-size: 16px;
                font-weight: 800;
            }
            QLabel#headerSubtitle {
                color: #9ca3af;
                font-size: 12px;
            }
            QListWidget {
                background-color: #171824;
                border: 1px solid #2a2c40;
                border-radius: 12px;
                color: #f3f4f6;
                font-size: 13px;
                padding: 8px;
                outline: 0;
            }
            QListWidget::item {
                background-color: #1e2030;
                border: 1px solid #2d3047;
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 8px;
                color: #e5e7eb;
            }
            QListWidget::item:hover {
                background-color: #26283d;
                border: 1px solid #434768;
            }
            QListWidget::item:selected {
                background-color: #2b2e46;
                border: 1.5px solid #6366f1;
                color: #ffffff;
            }
            QPushButton {
                background-color: #202233;
                color: #e5e7eb;
                border: 1px solid #32354d;
                border-radius: 8px;
                padding: 10px 16px;
                font-weight: 700;
                font-size: 12px;
                text-align: left;
            }
            QPushButton:hover {
                background-color: #2b2d45;
                color: #ffffff;
                border-color: #45496e;
            }
            QPushButton#primaryBtn {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #6366f1, stop:1 #4f46e5);
                color: #ffffff;
                border: none;
            }
            QPushButton#primaryBtn:hover {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #4f46e5, stop:1 #4338ca);
            }
            QPushButton#defaultBtn {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #f59e0b, stop:1 #d97706);
                color: #0d1117;
                border: none;
            }
            QPushButton#defaultBtn:hover {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #d97706, stop:1 #b45309);
                color: #ffffff;
            }
            QPushButton#dangerBtn {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #ef4444, stop:1 #dc2626);
                color: #ffffff;
                border: none;
            }
            QPushButton#dangerBtn:hover {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #dc2626, stop:1 #b91c1c);
            }
            QPushButton#closeBtn {
                background-color: #1e2030;
                color: #9ca3af;
                border: 1px solid #2d3047;
                text-align: center;
                padding: 8px 24px;
            }
            QPushButton#closeBtn:hover {
                background-color: #2b2e46;
                color: #ffffff;
            }
        """)

        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(20, 20, 20, 20)
        main_layout.setSpacing(14)

        # Header Title
        header_title = QLabel("🌐 Kayıtlı Web Siteleri")
        header_title.setObjectName("headerTitle")
        header_subtitle = QLabel("Uygulamada kayıtlı web sitelerinizi yönetin ve varsayılan siteyi seçin.")
        header_subtitle.setObjectName("headerSubtitle")
        
        main_layout.addWidget(header_title)
        main_layout.addWidget(header_subtitle)

        content_layout = QHBoxLayout()
        content_layout.setSpacing(14)

        # Liste
        self.list_widget = QListWidget()
        self.list_widget.doubleClicked.connect(self.edit_site)
        content_layout.addWidget(self.list_widget, stretch=3)

        # Butonlar Paneli
        btn_panel = QVBoxLayout()
        btn_panel.setSpacing(10)

        add_btn = QPushButton("➕ Yeni Site Ekle")
        add_btn.setObjectName("primaryBtn")
        add_btn.clicked.connect(self.add_site)
        btn_panel.addWidget(add_btn)

        edit_btn = QPushButton("✏️ Düzenle")
        edit_btn.clicked.connect(self.edit_site)
        btn_panel.addWidget(edit_btn)

        default_btn = QPushButton("⭐ Varsayılan Yap")
        default_btn.setObjectName("defaultBtn")
        default_btn.clicked.connect(self.set_as_default)
        btn_panel.addWidget(default_btn)

        delete_btn = QPushButton("🗑️ Sil")
        delete_btn.setObjectName("dangerBtn")
        delete_btn.clicked.connect(self.delete_site)
        btn_panel.addWidget(delete_btn)

        btn_panel.addStretch()
        content_layout.addLayout(btn_panel, stretch=1)

        main_layout.addLayout(content_layout)

        # Kapat Butonu
        bottom_layout = QHBoxLayout()
        bottom_layout.addStretch()
        close_btn = QPushButton("Kapat")
        close_btn.setObjectName("closeBtn")
        close_btn.clicked.connect(self.accept)
        bottom_layout.addWidget(close_btn)
        main_layout.addLayout(bottom_layout)

        self.refresh_list()

    def refresh_list(self):
        self.list_widget.clear()
        default_id = self.sites_data.get("default_site_id", "")

        for site in self.sites_data.get("sites", []):
            is_default = (site["id"] == default_id)
            prefix = "⭐ [Varsayılan] " if is_default else "🌐 "
            item_text = f"{prefix}{site['name']}\n   ↳ {site['url']}"
            item = QListWidgetItem(item_text)
            item.setData(Qt.ItemDataRole.UserRole, site["id"])
            if is_default:
                font = item.font()
                font.setBold(True)
                item.setFont(font)
            self.list_widget.addItem(item)

    def get_selected_site(self):
        current_item = self.list_widget.currentItem()
        if not current_item:
            return None, None
        site_id = current_item.data(Qt.ItemDataRole.UserRole)
        for index, site in enumerate(self.sites_data.get("sites", [])):
            if site["id"] == site_id:
                return index, site
        return None, None

    def add_site(self):
        dialog = AddEditSiteDialog(self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            new_site = dialog.result_data
            self.sites_data.setdefault("sites", []).append(new_site)

            # İlk eklenen siteyse varsayılan yap
            if not self.sites_data.get("default_site_id"):
                self.sites_data["default_site_id"] = new_site["id"]

            self.save_data()
            self.refresh_list()

    def edit_site(self):
        index, site = self.get_selected_site()
        if site is None:
            QMessageBox.information(self, "Bilgi", "Lütfen düzenlemek için bir site seçin.")
            return

        dialog = AddEditSiteDialog(self, site_data=site)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            self.sites_data["sites"][index] = dialog.result_data
            self.save_data()
            self.refresh_list()

    def delete_site(self):
        index, site = self.get_selected_site()
        if site is None:
            QMessageBox.information(self, "Bilgi", "Lütfen silmek için bir site seçin.")
            return

        reply = QMessageBox.question(
            self, "Onay",
            f"'{site['name']}' sitesini silmek istediğinize emin misiniz?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )

        if reply == QMessageBox.StandardButton.Yes:
            site_id = site["id"]
            self.sites_data["sites"].pop(index)

            # Silinen site varsayılansa ilk kalan siteyi varsayılan yap
            if self.sites_data.get("default_site_id") == site_id:
                if self.sites_data["sites"]:
                    self.sites_data["default_site_id"] = self.sites_data["sites"][0]["id"]
                else:
                    self.sites_data["default_site_id"] = ""

            self.save_data()
            self.refresh_list()

    def set_as_default(self):
        index, site = self.get_selected_site()
        if site is None:
            QMessageBox.information(self, "Bilgi", "Lütfen varsayılan yapmak için bir site seçin.")
            return

        self.sites_data["default_site_id"] = site["id"]
        self.save_data()
        self.refresh_list()


class CustomWebPage(QWebEnginePage):
    """Gelişmiş Web Engine Sayfası (User-Agent & Güvenli İzin Yönetimi)"""
    def __init__(self, profile, parent=None):
        super().__init__(profile, parent)

    def userAgentForUrl(self, url):
        return (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/126.0.0.0 Safari/537.36"
        )


class WebAppWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.app_dir = os.path.dirname(os.path.abspath(__file__))
        self.sites_file = os.path.join(self.app_dir, "sites.json")
        self.logo_file = os.path.join(self.app_dir, "logo.png")

        self.sites_data = {"default_site_id": "", "sites": []}
        self.current_site_url = ""

        self.load_sites_config()
        self.init_ui()
        self.apply_performance_settings()
        self.setup_shortcuts()
        self.load_initial_site()

    def apply_performance_settings(self):
        """Maksimum web işleme hızı için Chromium & QtWebEngine performans ayarları."""
        settings = self.browser.settings()
        settings.setAttribute(QWebEngineSettings.WebAttribute.Accelerated2dCanvasEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.WebGLEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalStorageEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.ScrollAnimatorEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.DnsPrefetchEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.AutoLoadImages, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.FullScreenSupportEnabled, True)

    def setup_shortcuts(self):
        """Kullanıcı kolaylığı için klavye kısayolları."""
        # F11: Tam Ekran
        self.shortcut_f11 = QShortcut(QKeySequence(Qt.Key.Key_F11), self)
        self.shortcut_f11.activated.connect(self.toggle_fullscreen)

        # F5 veya Ctrl+R: Yenile
        self.shortcut_f5 = QShortcut(QKeySequence(Qt.Key.Key_F5), self)
        self.shortcut_f5.activated.connect(self.navigate_reload)

        # Ctrl+Shift+S: Ayarlar
        self.shortcut_settings = QShortcut(QKeySequence("Ctrl+Shift+S"), self)
        self.shortcut_settings.activated.connect(self.open_settings)

        # Üst Menü (Toolbar) Göster/Gizle Kısayolları (Ctrl+M, Ctrl+Shift+M, F2)
        self.shortcut_toggle_toolbar_ctrl = QShortcut(QKeySequence("Ctrl+M"), self)
        self.shortcut_toggle_toolbar_ctrl.activated.connect(self.toggle_toolbar)

        self.shortcut_toggle_toolbar_ctrl_shift = QShortcut(QKeySequence("Ctrl+Shift+M"), self)
        self.shortcut_toggle_toolbar_ctrl_shift.activated.connect(self.toggle_toolbar)

        self.shortcut_toggle_toolbar_f2 = QShortcut(QKeySequence(Qt.Key.Key_F2), self)
        self.shortcut_toggle_toolbar_f2.activated.connect(self.toggle_toolbar)

    def toggle_toolbar(self):
        """Üst menüyü (Toolbar) gösterir / gizler."""
        if hasattr(self, 'toolbar') and self.toolbar:
            self.toolbar.setVisible(not self.toolbar.isVisible())

    def toggle_fullscreen(self):
        """Tam ekran modunu açar / kapatır."""
        if self.isFullScreen():
            self.showNormal()
        else:
            self.showFullScreen()

    def load_sites_config(self):
        """sites.json dosyasını yükler veya varsayılan oluşturur."""
        if os.path.exists(self.sites_file):
            try:
                with open(self.sites_file, "r", encoding="utf-8") as f:
                    self.sites_data = json.load(f)
            except Exception as e:
                print(f"Yapılandırma yükleme hatası: {e}")

        # Eğer hiç site yoksa varsayılan site ekle
        if not self.sites_data.get("sites"):
            default_site = {
                "id": "1",
                "name": "Google",
                "url": "https://www.google.com"
            }
            self.sites_data = {
                "default_site_id": "1",
                "sites": [default_site]
            }
            self.save_sites_config()

    def save_sites_config(self):
        """sites.json dosyasını kaydeder."""
        try:
            with open(self.sites_file, "w", encoding="utf-8") as f:
                json.dump(self.sites_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Yapılandırma kaydetme hatası: {e}")

    def init_ui(self):
        self.setWindowTitle("Web Uygulama Yöneticisi")
        self.resize(1280, 800)

        # Varsayılan ikon ayarla (logo.png varsa yükle)
        self.update_app_icon_from_file()

        # Dark Theme CSS
        self.setStyleSheet("""
            QMainWindow {
                background-color: #1e1e2e;
            }
            QToolBar {
                background-color: #181825;
                border-bottom: 1px solid #313244;
                padding: 6px 10px;
                spacing: 8px;
            }
            QToolButton {
                background-color: #313244;
                color: #cdd6f4;
                border: 1px solid #45475a;
                border-radius: 6px;
                padding: 6px 12px;
                font-size: 13px;
                font-weight: bold;
            }
            QToolButton:hover {
                background-color: #45475a;
                color: #ffffff;
            }
            QComboBox {
                background-color: #313244;
                color: #cdd6f4;
                border: 1px solid #45475a;
                border-radius: 6px;
                padding: 6px 12px;
                font-size: 13px;
                font-weight: bold;
                min-width: 160px;
            }
            QComboBox::drop-down {
                border: none;
            }
            QComboBox QAbstractItemView {
                background-color: #1e1e2e;
                color: #cdd6f4;
                selection-background-color: #45475a;
                selection-color: #89b4fa;
                border: 1px solid #45475a;
            }
            QLineEdit {
                background-color: #11111b;
                border: 1px solid #45475a;
                border-radius: 6px;
                padding: 6px 12px;
                color: #cdd6f4;
                font-size: 13px;
            }
            QLineEdit:focus {
                border: 1px solid #89b4fa;
            }
            QStatusBar {
                background-color: #181825;
                color: #a6adc8;
                font-size: 12px;
            }
        """)

        # ToolBar (Tamamen Gizlendi - Sadece Web Sitesi Görünür)
        self.toolbar = QToolBar("Navigasyon")
        self.toolbar.setMovable(False)
        self.toolbar.setIconSize(QSize(18, 18))
        self.addToolBar(self.toolbar)
        self.toolbar.setVisible(False)  # Üst navigasyon çubuğu gizlendi


        # Geri Butonu
        self.back_btn = QToolButton(self)
        self.back_btn.setText("◀ Geri")
        self.back_btn.setToolTip("Geri Dön")
        self.back_btn.clicked.connect(self.navigate_back)
        self.toolbar.addWidget(self.back_btn)

        # İleri Butonu
        self.forward_btn = QToolButton(self)
        self.forward_btn.setText("İleri ▶")
        self.forward_btn.setToolTip("İleri Git")
        self.forward_btn.clicked.connect(self.navigate_forward)
        self.toolbar.addWidget(self.forward_btn)

        # Yenile Butonu
        self.reload_btn = QToolButton(self)
        self.reload_btn.setText("🔄 Yenile")
        self.reload_btn.setToolTip("Sayfayı Yenile")
        self.reload_btn.clicked.connect(self.navigate_reload)
        self.toolbar.addWidget(self.reload_btn)

        # Ana Sayfa Butonu
        self.home_btn = QToolButton(self)
        self.home_btn.setText("🏠 Ana Sayfa")
        self.home_btn.setToolTip("Varsayılan Siteye Git")
        self.home_btn.clicked.connect(self.load_initial_site)
        self.toolbar.addWidget(self.home_btn)

        self.toolbar.addSeparator()

        # Site Seçici Combobox
        self.site_combo = QComboBox(self)
        self.site_combo.setToolTip("Kayıtlı Siteler Arasında Geçiş Yap")
        self.site_combo.currentIndexChanged.connect(self.on_site_selected)
        self.toolbar.addWidget(self.site_combo)

        # URL Giriş Alanı
        self.url_bar = QLineEdit(self)
        self.url_bar.setPlaceholderText("https://...")
        self.url_bar.returnPressed.connect(self.navigate_to_url)
        self.toolbar.addWidget(self.url_bar)

        # Ayarlar Butonu
        self.settings_btn = QToolButton(self)
        self.settings_btn.setText("⚙️ Ayarlar")
        self.settings_btn.setToolTip("Web Sitelerini Yönet & Ayarlar")
        self.settings_btn.clicked.connect(self.open_settings)
        self.toolbar.addWidget(self.settings_btn)

        # Web Engine View
        self.browser = QWebEngineView(self)
        profile = QWebEngineProfile.defaultProfile()
        self.web_page = CustomWebPage(profile, self.browser)
        self.browser.setPage(self.web_page)

        self.setCentralWidget(self.browser)

        # Sinyal Bağlantıları
        self.browser.urlChanged.connect(self.update_url_bar)
        self.browser.titleChanged.connect(self.update_title)
        self.browser.iconChanged.connect(self.on_site_icon_changed)

        # Status Bar (Gizlendi)
        self.status_bar = QStatusBar(self)
        self.setStatusBar(self.status_bar)
        self.status_bar.hide()


        self.populate_site_combo()

    def update_app_icon_from_file(self):
        """Eğer klasörde logo.png varsa pencere ikonu olarak yükler."""
        if os.path.exists(self.logo_file):
            icon = QIcon(self.logo_file)
            self.setWindowIcon(icon)

    def populate_site_combo(self):
        """Site seçici dropdown menüsünü günceller."""
        self.site_combo.blockSignals(True)
        self.site_combo.clear()

        sites = self.sites_data.get("sites", [])
        default_id = self.sites_data.get("default_site_id", "")

        for site in sites:
            is_default = (site["id"] == default_id)
            label = f"⭐ {site['name']}" if is_default else site['name']
            self.site_combo.addItem(label, site)

        self.site_combo.blockSignals(False)

    def get_default_site(self):
        """Varsayılan site objesini döndürür."""
        default_id = self.sites_data.get("default_site_id", "")
        sites = self.sites_data.get("sites", [])

        for site in sites:
            if site["id"] == default_id:
                return site
        if sites:
            return sites[0]
        return {"name": "Google", "url": "https://www.google.com"}

    def load_initial_site(self):
        """Varsayılan web sitesini yükler."""
        default_site = self.get_default_site()
        if default_site:
            self.load_site_url(default_site["url"])

            # Combobox'ta varsayılan siteyi seç
            for index in range(self.site_combo.count()):
                site = self.site_combo.itemData(index)
                if site and site.get("id") == default_site.get("id"):
                    self.site_combo.blockSignals(True)
                    self.site_combo.setCurrentIndex(index)
                    self.site_combo.blockSignals(False)
                    break

    def load_site_url(self, url_str):
        """Belirtilen URL'yi yükler."""
        if not (url_str.startswith("http://") or url_str.startswith("https://")):
            url_str = "https://" + url_str
        self.current_site_url = url_str
        self.browser.setUrl(QUrl(url_str))

    def on_site_selected(self, index):
        """Dropdown menüden site seçildiğinde çalışır."""
        site = self.site_combo.itemData(index)
        if site and "url" in site:
            self.load_site_url(site["url"])

    def navigate_to_url(self):
        """Adres çubuğundan girilen URL'ye gider."""
        url_text = self.url_bar.text().strip()
        if url_text:
            self.load_site_url(url_text)

    def navigate_back(self):
        self.browser.back()

    def navigate_forward(self):
        self.browser.forward()

    def navigate_reload(self):
        self.browser.reload()

    def update_url_bar(self, qurl):
        """Web adresi değiştiğinde adres çubuğunu günceller."""
        self.url_bar.setText(qurl.toString())

    def update_title(self, title):
        """Sayfa başlığı değiştiğinde pencere başlığını günceller."""
        if title:
            self.setWindowTitle(f"{title} - Web Masaüstü Uygulaması")

    def on_site_icon_changed(self, icon):
        """Site yüklendiğinde sitenin logosunu hem pencereye hem görev çubuğuna uygular."""
        if not icon.isNull():
            self.setWindowIcon(icon)
            app_inst = QApplication.instance()
            if app_inst:
                app_inst.setWindowIcon(icon)

    def open_settings(self):
        """Ayarlar penceresini açar."""
        dialog = SettingsDialog(self.sites_file, self)
        dialog.sites_updated.connect(self.on_sites_updated)
        dialog.exec()

    def on_sites_updated(self):
        """Ayarlar güncellendiğinde config reload yapar."""
        self.load_sites_config()
        self.populate_site_combo()


def main():
    # Windows Görev Çubuğunda varsayılan Python logosu yerine uygulamanın kendi logosunun görünmesini sağlar
    if sys.platform == "win32":
        try:
            import ctypes
            myappid = "webappwrapper.desktop.app.v1"
            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(myappid)
        except Exception as e:
            print(f"AppUserModelID ayarlama hatası: {e}")

    app = QApplication(sys.argv)
    app.setApplicationName("Web App Wrapper")

    window = WebAppWindow()
    window.show()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
