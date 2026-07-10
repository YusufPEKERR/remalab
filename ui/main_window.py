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
    QFrame,
)
from PySide6.QtCore import Qt

from ui.sidebar import Sidebar
from ui.topbar import TopBar
from ui.dashboard_page import DashboardPage
from ui.settings_page import SettingsPage
from ui.parts_page import PartsPage
from ui.locations_page import LocationsPage
from ui.reports_page import ReportsPage
from ui.users_page import UsersPage
from ui.translations import tr, get_translator
from config.session import SessionManager
import os


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

    def refresh(self):
        # Placeholder sayfaları için yenileme işlemi gerekmez.
        pass


class MainWindow(QMainWindow):
    """Ana uygulama penceresi."""

    def __init__(self):
        super().__init__()
        self.setWindowTitle(tr("app.title"))
        self.setMinimumSize(1280, 800)
        self.resize(1440, 900)

        # Sayfaları tutan dict (tr_key -> index)
        self._pages: dict[str, int] = {}

        # Master Stack (Giriş / Yükleniyor / Ana Uygulama)
        self._master_stack = QStackedWidget()
        self.setCentralWidget(self._master_stack)

        # 1. Giriş Sayfası
        from ui.auth.login_page import LoginPage

        self._login_page = LoginPage()
        self._master_stack.addWidget(self._login_page)

        # 2. Yükleniyor Ekranı
        self._loading_widget = QWidget()
        self._loading_widget.setObjectName("loading_page")
        self._loading_widget.setStyleSheet("""
            QWidget#loading_page {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #F8FAFD, stop:1 #EBF0F8);
            }
        """)
        loading_layout = QVBoxLayout(self._loading_widget)
        loading_layout.setAlignment(Qt.AlignCenter)
        loading_layout.setSpacing(20)

        # Elegant glass loading card
        loading_card = QFrame()
        loading_card.setFixedSize(400, 250)
        loading_card.setStyleSheet("""
            QFrame {
                background-color: rgba(255, 255, 255, 0.7);
                border-radius: 20px;
                border: 1px solid rgba(255, 255, 255, 0.9);
            }
            QLabel {
                background: transparent;
                border: none;
                color: #1B2338;
            }
        """)
        card_layout = QVBoxLayout(loading_card)
        card_layout.setAlignment(Qt.AlignCenter)
        card_layout.setSpacing(15)

        # Yükleniyor Spinner (Logo)

        filename = "logo.png"
        logo_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), "assets", filename
        )
        loading_spinner = QLabel()
        if os.path.exists(logo_path):
            from PySide6.QtGui import QPixmap

            pixmap = QPixmap(logo_path)
            pixmap = pixmap.scaledToWidth(120, Qt.SmoothTransformation)
            loading_spinner.setPixmap(pixmap)
            loading_spinner.setAlignment(Qt.AlignCenter)
        else:
            loading_spinner.setText("Yükleniyor...")
            loading_spinner.setStyleSheet("font-size: 24px; color: #4F6CB3;")
            loading_spinner.setAlignment(Qt.AlignCenter)
        card_layout.addWidget(loading_spinner)

        # Spin animation setup (subtle pulse effect)
        loading_lbl = QLabel(
            tr("common.loading")
            if tr("common.loading") != "common.loading"
            else "Sistem Yükleniyor..."
        )
        loading_lbl.setAlignment(Qt.AlignCenter)
        loading_lbl.setStyleSheet(
            "font-size: 20px; font-weight: 700; font-family: 'Segoe UI'; letter-spacing: 1px; color: #243B7A;"
        )
        card_layout.addWidget(loading_lbl)

        loading_sub = QLabel("Lütfen bekleyin, veriler senkronize ediliyor...")
        loading_sub.setAlignment(Qt.AlignCenter)
        loading_sub.setStyleSheet(
            "font-size: 13px; color: #4F6CB3; font-family: 'Segoe UI';"
        )
        card_layout.addWidget(loading_sub)

        loading_layout.addWidget(loading_card)
        self._master_stack.addWidget(self._loading_widget)

        # 3. Ana Uygulama Düzeni
        self._app_widget = QWidget()
        self._master_stack.addWidget(self._app_widget)

        self._setup_ui()
        self._connect_signals()

        # Oturum kontrolüne göre gösterim
        session = SessionManager()
        if session.is_authenticated():
            self._show_app_directly()
        else:
            self._master_stack.setCurrentIndex(0)  # Login sayfasını göster

        # Dil değişikliklerini dinle
        get_translator().language_changed.connect(self._retranslate)

    def _show_app_directly(self):
        """Doğrudan uygulamayı başlatır."""
        self._create_pages()
        self._master_stack.setCurrentIndex(2)

        # Arayüzü yenile
        self._sidebar.update_menu_permissions()
        self._topbar.update_user_info()

    def _setup_ui(self):
        """Ana uygulama arayüzünü oluştur."""
        main_layout = QHBoxLayout(self._app_widget)
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

    def _create_pages(self):
        """Dashboard'u hemen oluşturur; diğer sayfalar ilk ziyarette (lazy) kurulur.

        Önceden tüm modüller (Depo, Parçalar, Raporlar, vb.) girişte anında
        inşa ediliyor ve her biri kendi veritabanı sorgusunu çalıştırıyordu.
        Kullanıcı o sayfayı hiç açmasa bile bu maliyeti ödüyordu. Artık sadece
        gezinme menüsünde tıklanan sayfa, tıklandığı an kuruluyor.
        """
        session = SessionManager()
        user_role = session.role
        self._page_factories = self._build_page_factories(user_role)

        # Herkesin gördüğü ilk sayfa
        dashboard = DashboardPage()
        self._add_page("nav.dashboard", dashboard)
        self._content_stack.setCurrentIndex(0)

    def _build_page_factories(self, user_role: str) -> dict:
        """Role göre erişilebilir modüller için gecikmeli (lazy) kurucu fonksiyonlar üretir."""
        factories: dict = {}

        # Sadece Admin, Depo ve Depo Müdürü Ortak Modülleri
        if user_role in ["Admin", "Depo", "Depo Müdürü"]:
            def _make_warehouse():
                from ui.warehouse_page import WarehousePage
                return WarehousePage()

            def _make_waybill():
                from ui.waybill_page import WaybillPage
                return WaybillPage()

            factories["nav.warehouse"] = _make_warehouse
            factories["nav.locations"] = lambda: LocationsPage()
            factories["nav.waybill"] = _make_waybill

        # Admin ve Depo Müdürü Ortak Modülleri (Envanter)
        if user_role in ["Admin", "Depo Müdürü"]:
            def _make_phone_models():
                from ui.phone_models_page import PhoneModelsPage
                return PhoneModelsPage()

            def _make_suppliers():
                from ui.suppliers_page import SuppliersPage
                return SuppliersPage()

            factories["nav.parts"] = lambda: PartsPage()
            factories["nav.phone_models"] = _make_phone_models
            factories["nav.suppliers"] = _make_suppliers

        # Admin ve Teknisyen Modülleri
        if user_role in ["Admin", "Teknisyen"]:
            for m in ["nav.quality_control", "nav.refurbishment", "nav.priority_matrix"]:
                factories[m] = lambda m=m: PlaceholderPage(m)

        # Sadece Admin Modülleri
        if user_role == "Admin":
            factories["nav.reports"] = lambda: ReportsPage()
            factories["nav.settings"] = lambda: SettingsPage()
            factories["nav.users"] = lambda: UsersPage()

        return factories

    def _add_page(self, tr_key: str, widget: QWidget):
        """Yeni sayfa ekle."""
        index = self._content_stack.addWidget(widget)
        self._pages[tr_key] = index

    def _connect_signals(self):
        """Sinyalleri bağla."""
        self._login_page.login_successful.connect(self._start_loading_sequence)
        self._sidebar.navigation_changed.connect(self._on_navigation_changed)
        self._topbar.logout_requested.connect(self._handle_logout)
        self._topbar.refresh_requested.connect(self._handle_refresh)

    def _start_loading_sequence(self):
        """Oturum açma başarılı olduğunda yükleniyor ekranı geçişini yapar."""
        self._master_stack.setCurrentIndex(1)  # Yükleniyor ekranını göster

        # Yükleniyor ekranının bir kare boyanmasına izin ver, sonra hemen devam et
        # (yapay bir bekleme yok - sadece Dashboard artık lazy yükleme sayesinde hızlı).
        from PySide6.QtCore import QTimer

        QTimer.singleShot(0, self._on_loading_complete)

    def _on_loading_complete(self):
        """Yükleme tamamlandığında ana pencereleri oluşturur ve gösterir."""
        self._create_pages()
        self._master_stack.setCurrentIndex(2)  # Ana uygulamayı göster

        # Arayüzü yenile
        self._sidebar.update_menu_permissions()
        self._topbar.update_user_info()

    def _handle_refresh(self):
        # Sadece aktif olan sayfanın verilerini yenile
        current_widget = self._content_stack.currentWidget()

        refresh_methods = [
            "refresh",
            "load_data",
            "_load_data",
            "_load_parts",
            "_load_inventory",
            "_load_locations",
            "_load_entries",
            "_load_users",
            "_load_stocks",
            "_load_local_config",
            "_load_combos",
        ]

        for method_name in refresh_methods:
            if hasattr(current_widget, method_name):
                getattr(current_widget, method_name)()
                return

        print(
            f"[{current_widget.__class__.__name__}] için yenileme fonksiyonu bulunamadı."
        )

    def _handle_logout(self):
        """Oturumu kapatır ve uygulamayı kapatmadan Login ekranına döner."""
        # 1. Oturumu temizle
        SessionManager().clear_session()

        # 2. Login ekranındaki eski girdileri temizle
        self._login_page.username_input.clear()
        self._login_page.password_input.clear()

        # 3. Ana sayfaları temizle (böylece bir sonraki girişte tekrar temiz sıfırdan yüklenir)
        while self._content_stack.count() > 0:
            widget = self._content_stack.widget(0)
            self._content_stack.removeWidget(widget)
            widget.deleteLater()
        self._pages.clear()

        # 4. Master Stack'i Giriş Sayfasına yönlendir
        self._master_stack.setCurrentIndex(0)

    def _on_navigation_changed(self, module_tr_key: str):
        """Navigasyon değiştiğinde sayfa değiştir; sayfa ilk kez görülüyorsa burada kurulur."""
        if module_tr_key not in self._pages:
            factory = getattr(self, "_page_factories", {}).get(module_tr_key)
            if factory is None:
                return
            self._add_page(module_tr_key, factory())

        self._content_stack.setCurrentIndex(self._pages[module_tr_key])
        self._topbar.set_page_title(module_tr_key)

    def _retranslate(self):
        """Dil değiştiğinde pencere başlığını güncelle."""
        self.setWindowTitle(tr("app.title"))
