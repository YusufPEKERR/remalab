"""
RemaLab WMS - Main Window
Ana pencere - sidebar, topbar ve içerik alanını bir araya getirir.
Çoklu dil desteği ve settings sayfası entegrasyonu.
"""

from PySide6.QtWidgets import (
    QMainWindow,
    QWidget,
    QHBoxLayout,
    QVBoxLayout,
    QStackedWidget,
    QLabel,
    QSizePolicy,
)
from PySide6.QtCore import Qt

from ui.sidebar import Sidebar
from ui.topbar import TopBar
from ui.dashboard_page import DashboardPage
from ui.settings_page import SettingsPage
from ui.parts_page import PartsPage
from ui.warehouse_page import WarehousePage
from ui.inbound_page import InboundPage
from ui.outbound_page import OutboundPage
from ui.locations_page import LocationsPage
from ui.inventory_page import InventoryPage
from ui.users_page import UsersPage
from ui.translations import tr, get_translator
from config.session import SessionManager
import sys


class PlaceholderPage(QWidget):
    """Henüz geliştirilmemiş sayfalar için geçici sayfa."""

    def __init__(self, module_tr_key: str, parent=None):
        super().__init__(parent)
        self._tr_key = module_tr_key
        layout = QVBoxLayout(self)
        layout.setAlignment(Qt.AlignCenter)

        icon_label = QLabel("🚧")
        icon_label.setAlignment(Qt.AlignCenter)
        icon_label
        layout.addWidget(icon_label)

        self._title = QLabel(tr(module_tr_key))
        self._title.setAlignment(Qt.AlignCenter)
        self._title
        layout.addWidget(self._title)

        self._subtitle = QLabel(tr("placeholder.subtitle"))
        self._subtitle.setAlignment(Qt.AlignCenter)
        self._subtitle
        layout.addWidget(self._subtitle)

        # Dil değişikliklerini dinle
        get_translator().language_changed.connect(self._retranslate)

    def _retranslate(self):
        self._title.setText(tr(self._tr_key))
        self._subtitle.setText(tr("placeholder.subtitle"))


class MainWindow(QMainWindow):
    """Ana uygulama penceresi."""

    def __init__(self):
        super().__init__()
        self.setWindowTitle(tr("app.title"))
        self.setMinimumSize(1280, 800)
        self.resize(1440, 900)

        # Sayfaları tutan dict (tr_key -> index)
        self._pages: dict[str, int] = {}

        self._setup_ui()
        self._connect_signals()

        # Dil değişikliklerini dinle
        get_translator().language_changed.connect(self._retranslate)

    def _setup_ui(self):
        """Arayüzü oluştur."""
        central = QWidget()
        self.setCentralWidget(central)

        main_layout = QHBoxLayout(central)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        # Sidebar
        self._sidebar = Sidebar()
        main_layout.addWidget(self._sidebar)

        # Sağ taraf: Topbar + İçerik alanı
        right_section = QWidget()
        right_layout = QVBoxLayout(right_section)
        right_layout.setContentsMargins(0, 0, 0, 0)
        right_layout.setSpacing(0)

        # Topbar
        self._topbar = TopBar()
        right_layout.addWidget(self._topbar)

        # İçerik alanı
        self._content_stack = QStackedWidget()
        self._content_stack.setObjectName("content_area")
        right_layout.addWidget(self._content_stack)

        main_layout.addWidget(right_section)

        # Sayfaları oluştur
        self._create_pages()

    def _create_pages(self):
        """Tüm sayfaları oluştur ve stack'e ekle."""
        session = SessionManager()
        user_role = session.role

        # Herkesin gördüğü
        dashboard = DashboardPage()
        self._add_page("nav.dashboard", dashboard)

        # Sadece Admin, Depo ve Depo Müdürü Ortak Modülleri
        if user_role in ["Admin", "Depo", "Depo Müdürü"]:
            from ui.inventory_page import InventoryPage
            inventory = InventoryPage()
            self._add_page("nav.warehouse", inventory)
            
            locations = LocationsPage()
            self._add_page("nav.locations", locations)
            
            from ui.waybill_page import WaybillPage
            waybill = WaybillPage()
            self._add_page("nav.waybill", waybill)

        # Admin ve Depo Müdürü Ortak Modülleri (Envanter)
        if user_role in ["Admin", "Depo Müdürü"]:
            parts = PartsPage()
            self._add_page("nav.parts", parts)
            
            depo_placeholders = ["nav.brands", "nav.phone_models", "nav.suppliers"]
            for m in depo_placeholders:
                self._add_page(m, PlaceholderPage(m))

        # Admin ve Teknisyen Modülleri
        if user_role in ["Admin", "Teknisyen"]:
            teknisyen_placeholders = ["nav.quality_control", "nav.refurbishment", "nav.priority_matrix"]
            for m in teknisyen_placeholders:
                self._add_page(m, PlaceholderPage(m))

        # Sadece Admin Modülleri
        if user_role == "Admin":
            self._add_page("nav.reports", PlaceholderPage("nav.reports"))
            
            settings = SettingsPage()
            self._add_page("nav.settings", settings)
            
            users = UsersPage()
            self._add_page("nav.users", users)

        # İlk sayfa Dashboard
        self._content_stack.setCurrentIndex(0)

    def _add_page(self, tr_key: str, widget: QWidget):
        """Yeni sayfa ekle."""
        index = self._content_stack.addWidget(widget)
        self._pages[tr_key] = index

    def _connect_signals(self):
        """Sinyalleri bağla."""
        self._sidebar.navigation_changed.connect(self._on_navigation_changed)
        self._topbar.logout_requested.connect(self._handle_logout)
        self._topbar.refresh_requested.connect(self._handle_refresh)

    def _handle_refresh(self):
        # Sadece aktif olan sayfanın verilerini yenile
        current_widget = self._content_stack.currentWidget()
        
        refresh_methods = [
            "refresh", "load_data", "_load_data", 
            "_load_parts", "_load_inventory", "_load_locations",
            "_load_entries", "_load_users", "_load_stocks",
            "_load_local_config", "_load_combos"
        ]
        
        for method_name in refresh_methods:
            if hasattr(current_widget, method_name):
                getattr(current_widget, method_name)()
                return
                
        print(f"[{current_widget.__class__.__name__}] için yenileme fonksiyonu bulunamadı.")

    def _handle_logout(self):
        # Oturumu kapat
        SessionManager().clear_session()
        # Pencereyi kapatıp ana uygulamadan tekrar başlatılmasını sağlamak için
        # QApplication instance'ı üzerinden restart yapabiliriz ya da main_window kapanınca
        # main.py'deki akış duracak. Daha kolayı:
        import os
        from PySide6.QtWidgets import QApplication
        
        QApplication.quit()
        # Yeni bir instance başlatmak (cross-platform çözüm)
        import subprocess
        subprocess.Popen([sys.executable, "main.py"])

    def _on_navigation_changed(self, module_tr_key: str):
        """Navigasyon değiştiğinde sayfa değiştir."""
        if module_tr_key in self._pages:
            self._content_stack.setCurrentIndex(self._pages[module_tr_key])
            self._topbar.set_page_title(module_tr_key)

    def _retranslate(self):
        """Dil değiştiğinde pencere başlığını güncelle."""
        self.setWindowTitle(tr("app.title"))
