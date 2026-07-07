"""
RemaLab WMS - Main Window
Ana pencere - sidebar, topbar ve içerik alanını bir araya getirir.
Çoklu dil desteği ve settings sayfası entegrasyonu.
"""

from PySide6.QtWidgets import (
    QMainWindow, QWidget, QHBoxLayout, QVBoxLayout,
    QStackedWidget, QLabel, QSizePolicy
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
from ui.translations import tr, get_translator


class PlaceholderPage(QWidget):
    """Henüz geliştirilmemiş sayfalar için geçici sayfa."""

    def __init__(self, module_tr_key: str, parent=None):
        super().__init__(parent)
        self._tr_key = module_tr_key
        layout = QVBoxLayout(self)
        layout.setAlignment(Qt.AlignCenter)

        icon_label = QLabel("🚧")
        icon_label.setAlignment(Qt.AlignCenter)
        icon_label.setStyleSheet("font-size: 48px;")
        layout.addWidget(icon_label)

        self._title = QLabel(tr(module_tr_key))
        self._title.setAlignment(Qt.AlignCenter)
        self._title.setStyleSheet(
            "color: #F0F6FC; font-size: 24px; font-weight: 700; margin-top: 16px;"
        )
        layout.addWidget(self._title)

        self._subtitle = QLabel(tr("placeholder.subtitle"))
        self._subtitle.setAlignment(Qt.AlignCenter)
        self._subtitle.setStyleSheet(
            "color: #484F58; font-size: 14px; margin-top: 8px;"
        )
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
        # Dashboard
        dashboard = DashboardPage()
        self._add_page("nav.dashboard", dashboard)

        # Parts
        parts = PartsPage()
        self._add_page("nav.parts", parts)

        # Warehouse
        warehouse = WarehousePage()
        self._add_page("nav.warehouse", warehouse)

        # Locations
        locations = LocationsPage()
        self._add_page("nav.locations", locations)

        # Inbound Stock Entry
        inbound = InboundPage()
        self._add_page("nav.inbound", inbound)

        # Outbound Stock Entry
        outbound = OutboundPage()
        self._add_page("nav.outbound", outbound)

        # Inventory Status Page
        inventory = InventoryPage()
        self._add_page("nav.inventory", inventory)

        # Settings (Veritabanı yönetimi dahil)
        settings = SettingsPage()
        self._add_page("nav.settings", settings)

        # Diğer modüller için placeholder sayfalar
        placeholder_modules = [
            "nav.brands",
            "nav.phone_models", "nav.suppliers",
            "nav.putaway", "nav.picking", "nav.quality_control",
            "nav.refurbishment", "nav.priority_matrix", "nav.reports", "nav.users"
        ]

        for module_key in placeholder_modules:
            page = PlaceholderPage(module_key)
            self._add_page(module_key, page)

        # İlk sayfa Dashboard
        self._content_stack.setCurrentIndex(0)

    def _add_page(self, tr_key: str, widget: QWidget):
        """Yeni sayfa ekle."""
        index = self._content_stack.addWidget(widget)
        self._pages[tr_key] = index

    def _connect_signals(self):
        """Sinyalleri bağla."""
        self._sidebar.navigation_changed.connect(self._on_navigation_changed)

    def _on_navigation_changed(self, module_tr_key: str):
        """Navigasyon değiştiğinde sayfa değiştir."""
        if module_tr_key in self._pages:
            self._content_stack.setCurrentIndex(self._pages[module_tr_key])
            self._topbar.set_page_title(module_tr_key)

    def _retranslate(self):
        """Dil değiştiğinde pencere başlığını güncelle."""
        self.setWindowTitle(tr("app.title"))
