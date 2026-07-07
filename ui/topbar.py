"""
RemaLab WMS - Top Bar Widget
Üst başlık çubuğu - sayfa başlığı, arama, bildirimler ve profil.
Çoklu dil desteği ile.
"""

from PySide6.QtWidgets import (
    QWidget, QHBoxLayout, QVBoxLayout, QLabel,
    QPushButton, QLineEdit, QSizePolicy
)
from PySide6.QtCore import Qt, Signal

from ui.translations import tr, get_translator


class TopBar(QWidget):
    """Üst başlık çubuğu."""

    search_requested = Signal(str)
    notification_clicked = Signal()
    profile_clicked = Signal()

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

        # Bildirim butonu
        notification_btn = QPushButton("🔔")
        notification_btn.setObjectName("topbar_icon_btn")
        notification_btn.setCursor(Qt.PointingHandCursor)
        notification_btn.clicked.connect(self.notification_clicked.emit)
        right_layout.addWidget(notification_btn)

        # Bildirim badge
        self._notification_badge = QLabel("3")
        self._notification_badge.setObjectName("notification_badge")
        self._notification_badge.setAlignment(Qt.AlignCenter)
        self._notification_badge.setParent(notification_btn)
        self._notification_badge.move(24, 2)

        # Ayarlar butonu
        settings_btn = QPushButton("⚙️")
        settings_btn.setObjectName("topbar_icon_btn")
        settings_btn.setCursor(Qt.PointingHandCursor)
        right_layout.addWidget(settings_btn)

        # Ayırıcı
        separator = QWidget()
        separator.setFixedWidth(1)
        separator.setFixedHeight(32)
        separator.setStyleSheet("background-color: #21262D;")
        right_layout.addWidget(separator)

        # Kullanıcı avatarı
        avatar = QLabel("YP")
        avatar.setObjectName("user_avatar")
        avatar.setAlignment(Qt.AlignCenter)
        right_layout.addWidget(avatar)

        # Kullanıcı bilgileri
        user_info = QWidget()
        user_info_layout = QVBoxLayout(user_info)
        user_info_layout.setContentsMargins(0, 0, 0, 0)
        user_info_layout.setSpacing(0)

        user_name = QLabel("Yusuf Peker")
        user_name.setObjectName("user_name")

        self._user_role = QLabel(tr("topbar.role_admin"))
        self._user_role.setObjectName("user_role")

        user_info_layout.addStretch()
        user_info_layout.addWidget(user_name)
        user_info_layout.addWidget(self._user_role)
        user_info_layout.addStretch()

        right_layout.addWidget(user_info)

        # Profil dropdown butonu
        dropdown_btn = QPushButton("▾")
        dropdown_btn.setObjectName("topbar_icon_btn")
        dropdown_btn.setCursor(Qt.PointingHandCursor)
        dropdown_btn.clicked.connect(self.profile_clicked.emit)
        right_layout.addWidget(dropdown_btn)

        layout.addWidget(right_section)

    def set_page_title(self, page_tr_key: str):
        """Sayfa başlığını güncelle (tr_key bazlı)."""
        self._current_page_key = page_tr_key
        self._title.setText(tr(page_tr_key))
        self._breadcrumb.setText(f"{tr('topbar.home')}  ›  {tr(page_tr_key)}")

    def set_notification_count(self, count: int):
        """Bildirim sayısını güncelle."""
        self._notification_badge.setText(str(count))
        self._notification_badge.setVisible(count > 0)

    def _retranslate(self):
        """Dil değiştiğinde metinleri güncelle."""
        self._title.setText(tr(self._current_page_key))
        self._breadcrumb.setText(
            f"{tr('topbar.home')}  ›  {tr(self._current_page_key)}"
        )
        self._search_input.setPlaceholderText(f"🔍  {tr('topbar.search')}")
        self._user_role.setText(tr("topbar.role_admin"))
