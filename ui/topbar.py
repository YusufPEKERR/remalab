"""
RemaLab WMS - Top Bar Widget
Üst başlık çubuğu - sayfa başlığı, arama, bildirimler ve profil.
Çoklu dil desteği ile.
"""

from PySide6.QtWidgets import (
    QWidget,
    QHBoxLayout,
    QVBoxLayout,
    QLabel,
    QPushButton,
    QLineEdit,
    QSizePolicy,
    QMenu,
)
from PySide6.QtCore import Qt, Signal
from config.session import SessionManager

from ui.translations import tr, get_translator


class TopBar(QWidget):
    """Üst başlık çubuğu."""

    search_requested = Signal(str)
    notification_clicked = Signal()
    profile_clicked = Signal()
    logout_requested = Signal()
    refresh_requested = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName("topbar")
        self.setFixedHeight(60)
        self._current_page_key = "nav.dashboard"
        self._setup_ui()

        # Dil değişikliklerini dinle
        get_translator().language_changed.connect(self._retranslate)

    def _setup_ui(self):
        """Arayüzü oluştur."""
        layout = QHBoxLayout(self)
        layout.setContentsMargins(24, 0, 24, 0)
        layout.setSpacing(16)

        # Sol: Sayfa başlığı
        title_section = QWidget()
        title_layout = QVBoxLayout(title_section)
        title_layout.setContentsMargins(0, 0, 0, 0)
        title_layout.setSpacing(2)

        self._title = QLabel(tr("nav.dashboard"))
        self._title.setObjectName("topbar_title")

        self._breadcrumb = QLabel(f"{tr('topbar.home')}  ›  {tr('nav.dashboard')}")
        self._breadcrumb.setObjectName("topbar_breadcrumb")

        title_layout.addStretch()
        title_layout.addWidget(self._title)
        title_layout.addWidget(self._breadcrumb)
        title_layout.addStretch()

        layout.addWidget(title_section)
        layout.addStretch()

        # Orta: Arama kutusu
        search_container = QWidget()
        search_layout = QHBoxLayout(search_container)
        search_layout.setContentsMargins(0, 0, 0, 0)

        self._search_input = QLineEdit()
        self._search_input.setObjectName("search_input")
        self._search_input.setPlaceholderText(f"🔍  {tr('topbar.search')}")
        self._search_input.returnPressed.connect(
            lambda: self.search_requested.emit(self._search_input.text())
        )
        search_layout.addWidget(self._search_input)

        layout.addWidget(search_container)
        layout.addStretch()

        # Sağ: Bildirimler ve Profil
        right_section = QWidget()
        right_layout = QHBoxLayout(right_section)
        right_layout.setContentsMargins(0, 0, 0, 0)
        right_layout.setSpacing(12)

        minimalist_btn_style = """
            QPushButton {
                background-color: transparent;
                border: none;
                border-radius: 18px;
                font-size: 18px;
            }
            QPushButton:hover {
                background-color: rgba(255, 255, 255, 0.1);
            }
        """


        # Tema butonu
        self.theme_btn = QPushButton("🌙")
        self.theme_btn.setObjectName("topbar_icon_btn")
        self.theme_btn.setFixedSize(36, 36)
        self.theme_btn.setCursor(Qt.PointingHandCursor)
        from ui.theme_manager import get_theme_manager
        self._theme_mgr = get_theme_manager()
        self.theme_btn.setText("🌞" if self._theme_mgr.is_dark else "🌙")
        self.theme_btn.clicked.connect(self._toggle_theme)
        right_layout.addWidget(self.theme_btn)

        # Yenile butonu

        refresh_btn = QPushButton("🔄")
        refresh_btn.setFixedSize(36, 36)
        refresh_btn.setCursor(Qt.PointingHandCursor)
        refresh_btn.setStyleSheet(minimalist_btn_style)
        refresh_btn.clicked.connect(self.refresh_requested.emit)
        right_layout.addWidget(refresh_btn)



        # Ayırıcı
        separator = QWidget()
        separator.setFixedWidth(1)
        separator.setFixedHeight(32)
        separator
        right_layout.addWidget(separator)

        # Session Bilgilerini al
        session = SessionManager()
        username = session.username if session.username else "Misafir"
        role = session.role if session.role else "Kullanıcı"

        avatar_letters = username[:2].upper() if username != "Misafir" else "M"

        # Kullanıcı avatarı
        avatar = QLabel(avatar_letters)
        avatar.setObjectName("user_avatar")
        avatar.setAlignment(Qt.AlignCenter)
        right_layout.addWidget(avatar)

        # Kullanıcı bilgileri
        user_info = QWidget()
        user_info_layout = QVBoxLayout(user_info)
        user_info_layout.setContentsMargins(0, 0, 0, 0)
        user_info_layout.setSpacing(0)

        user_name = QLabel(f"Hoşgeldin, {username}")
        user_name.setObjectName("user_name")

        self._user_role = QLabel(role)
        self._user_role.setObjectName("user_role")

        user_info_layout.addStretch()
        user_info_layout.addWidget(user_name)
        user_info_layout.addWidget(self._user_role)
        user_info_layout.addStretch()

        right_layout.addWidget(user_info)

        # Profil Çıkış Yap butonu
        logout_btn = QPushButton("🚪 Çıkış Yap")
        logout_btn.setObjectName("logout_btn")
        logout_btn.setCursor(Qt.PointingHandCursor)
        logout_btn
        logout_btn.clicked.connect(self.logout_requested.emit)
        
        right_layout.addWidget(logout_btn)

        layout.addWidget(right_section)

    def set_page_title(self, page_tr_key: str):
        """Sayfa başlığını güncelle (tr_key bazlı)."""
        self._current_page_key = page_tr_key
        self._title.setText(tr(page_tr_key))
        self._breadcrumb.setText(f"{tr('topbar.home')}  ›  {tr(page_tr_key)}")




    def _toggle_theme(self):
        self._theme_mgr.toggle_theme()
        self.theme_btn.setText("🌞" if self._theme_mgr.is_dark else "🌙")

    def _retranslate(self):

        """Dil değiştiğinde metinleri güncelle."""
        self._title.setText(tr(self._current_page_key))
        self._breadcrumb.setText(
            f"{tr('topbar.home')}  ›  {tr(self._current_page_key)}"
        )
        self._search_input.setPlaceholderText(f"🔍  {tr('topbar.search')}")
