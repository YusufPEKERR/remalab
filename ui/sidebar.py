"""
RemaLab WMS - Sidebar Navigation Widget
Sabit navigasyon menüsü - tüm modüller burada listelenir.
Çoklu dil desteği ile.
"""

from PySide6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QLabel,
    QPushButton,
    QScrollArea,
    QFrame,
    QSizePolicy,
)
from PySide6.QtCore import Signal, Qt
from PySide6.QtGui import QPixmap
import os

from ui.translations import tr, get_translator
from config.session import SessionManager
from ui.theme_manager import get_theme_manager


class SidebarButton(QPushButton):
    """Navigasyon menüsü butonu."""

    def __init__(self, icon: str, text: str, tr_key: str, parent=None):
        super().__init__(parent)
        self._icon = icon
        self._tr_key = tr_key
        self._module_id = tr_key  # Sabit modül kimliği (dil değişse de değişmez)
        self.setText(f"  {icon}   {tr(tr_key)}")
        self.setObjectName("nav_button")
        self.setCursor(Qt.PointingHandCursor)
        self.setFixedHeight(40)

    @property
    def module_id(self) -> str:
        return self._module_id

    def set_active(self, active: bool):
        """Aktif/pasif durumu ayarla."""
        self.setObjectName("nav_button_active" if active else "nav_button")
        self.style().unpolish(self)
        self.style().polish(self)

    def retranslate(self):
        """Dil değiştiğinde metni güncelle."""
        self.setText(f"  {self._icon}   {tr(self._tr_key)}")


class Sidebar(QWidget):
    """Sol navigasyon paneli."""

    # Menü öğesi tıklandığında sinyal gönderir (tr_key bazlı)
    navigation_changed = Signal(str)

    # Menü yapılandırması: (bölüm_tr_key, [(ikon, modül_tr_key), ...])
    MENU_STRUCTURE = [
        (
            "section.overview",
            [
                ("📊", "nav.dashboard"),
            ],
        ),
        (
            "section.warehouse",
            [
                ("🏭", "nav.warehouse"),
                ("📄", "nav.waybill"),
                ("📈", "nav.reports"),
            ],
        ),
        (
            "section.inventory",
            [
                ("🔧", "nav.parts"),
                ("📱", "nav.phone_models"),
                ("🚚", "nav.suppliers"),
                ("📍", "nav.locations"),
            ],
        ),
        (
            "section.quality",
            [
                ("✅", "nav.quality_control"),
                ("🔄", "nav.refurbishment"),
                ("⚡", "nav.priority_matrix"),
            ],
        ),
        (
            "section.user_and_settings",
            [
                ("👥", "nav.users"),
                ("⚙️", "nav.settings"),
            ],
        ),
    ]

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName("sidebar")
        self.setAttribute(Qt.WA_StyledBackground, True)
        self.setFixedWidth(250)
        self._buttons: list[SidebarButton] = []
        self._section_labels: list[tuple[QLabel, str]] = []
        self._active_module = "nav.dashboard"
        self._setup_ui()

        # Dil değişikliklerini dinle
        get_translator().language_changed.connect(self._retranslate)
        
        # Tema değişikliklerini dinle
        get_theme_manager().theme_changed.connect(self._on_theme_changed)

    def _setup_ui(self):
        """Arayüzü oluştur."""
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        # Logo
        self._logo = QLabel()
        self._logo.setObjectName("sidebar_logo")
        self._update_logo_pixmap(get_theme_manager().is_dark)
        main_layout.addWidget(self._logo)

        # Alt başlık
        self._subtitle = QLabel(tr("app.subtitle"))
        self._subtitle.setObjectName("sidebar_subtitle")
        main_layout.addWidget(self._subtitle)

        # Ayırıcı
        separator = QFrame()
        separator.setObjectName("separator")
        separator.setFrameShape(QFrame.HLine)
        main_layout.addWidget(separator)

        # Scrollable menu area
        self._scroll_area = QScrollArea()
        self._scroll_area.setWidgetResizable(True)
        self._scroll_area.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self._scroll_area.setFrameShape(QFrame.NoFrame)
        main_layout.addWidget(self._scroll_area)

        self.update_menu_permissions()

        # Alt ayırıcı (Sidebar'ın altına çizgi)
        bottom_separator = QFrame()
        bottom_separator.setObjectName("separator")
        bottom_separator.setFrameShape(QFrame.HLine)
        main_layout.addWidget(bottom_separator)

        # Alt bilgi
        version_label = QLabel("  v1.0.0")
        version_label.setObjectName("sidebar_section_label")
        version_label.setAlignment(Qt.AlignCenter)
        version_label.setFixedHeight(40)
        main_layout.addWidget(version_label)

    def update_menu_permissions(self):
        """Kullanıcı rolüne göre menü butonlarını temizleyip yeniden oluşturur."""
        # Eski butonları ve labelleri temizle
        self._buttons.clear()
        self._section_labels.clear()

        scroll_widget = QWidget()
        scroll_layout = QVBoxLayout(scroll_widget)
        scroll_layout.setContentsMargins(0, 8, 0, 8)
        scroll_layout.setSpacing(0)

        session = SessionManager()
        user_role = session.role

        # Yetkiye göre modül dağılımı
        depo_modules = [
            "nav.dashboard", "nav.warehouse", "nav.waybill", "nav.locations"
        ]
        depo_muduru_modules = [
            "nav.dashboard", "nav.warehouse", "nav.waybill", "nav.locations",
            "nav.parts", "nav.phone_models", "nav.suppliers"
        ]
        teknisyen_modules = [
            "nav.dashboard",
            "nav.quality_control", "nav.refurbishment", "nav.priority_matrix"
        ]

        # Menü öğelerini oluştur
        for section_tr_key, items in self.MENU_STRUCTURE:
            # Önce bu bölümdeki yetkili olduğumuz itemleri bulalım
            allowed_items = []
            for icon, module_tr_key in items:
                if user_role == "Admin":
                    allowed_items.append((icon, module_tr_key))
                elif user_role == "Depo" and module_tr_key in depo_modules:
                    allowed_items.append((icon, module_tr_key))
                elif user_role == "Depo Müdürü" and module_tr_key in depo_muduru_modules:
                    allowed_items.append((icon, module_tr_key))
                elif user_role == "Teknisyen" and module_tr_key in teknisyen_modules:
                    allowed_items.append((icon, module_tr_key))
            
            # Eğer bu bölümde gösterilecek hiçbir öğe yoksa bölüm başlığını da çizme
            if not allowed_items:
                continue

            # Bölüm etiketi
            section_label = QLabel(tr(section_tr_key))
            section_label.setObjectName("sidebar_section_label")
            scroll_layout.addWidget(section_label)
            self._section_labels.append((section_label, section_tr_key))

            # Butonlar
            for icon, module_tr_key in allowed_items:
                btn = SidebarButton(icon, tr(module_tr_key), module_tr_key)
                btn.clicked.connect(
                    lambda checked, key=module_tr_key: self._on_button_clicked(key)
                )

                if module_tr_key == self._active_module:
                    btn.set_active(True)

                self._buttons.append(btn)
                scroll_layout.addWidget(btn)

        scroll_layout.addStretch()
        self._scroll_area.setWidget(scroll_widget)

    def _on_button_clicked(self, module_tr_key: str):
        """Menü butonuna tıklandığında."""
        if module_tr_key == self._active_module:
            return

        self._active_module = module_tr_key

        for btn in self._buttons:
            btn.set_active(btn.module_id == module_tr_key)

        self.navigation_changed.emit(module_tr_key)

    def _retranslate(self):
        """Dil değiştiğinde tüm metinleri güncelle."""
        self._subtitle.setText(tr("app.subtitle"))

        for label, tr_key in self._section_labels:
            label.setText(tr(tr_key))

        for btn in self._buttons:
            btn.retranslate()

    def _on_theme_changed(self, is_dark: bool):
        """Tema değiştiğinde logoyu güncelle."""
        self._update_logo_pixmap(is_dark)

    def _update_logo_pixmap(self, is_dark: bool):
        filename = "karanlık-mod.png" if is_dark else "logo.png"
        logo_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets", filename)
        if os.path.exists(logo_path):
            pixmap = QPixmap(logo_path)
            pixmap = pixmap.scaledToWidth(180, Qt.SmoothTransformation)
            self._logo.setPixmap(pixmap)
            self._logo.setAlignment(Qt.AlignCenter)
            self._logo.setContentsMargins(0, 20, 0, 10)
        else:
            self._logo.setText("REMALAB")
