"""
RemaLab WMS - Settings Page (Database Management)
Ayarlar sayfası - Dil seçimi, PostgreSQL bağlantıları ve Lokal DB yönetimi.
Admin panelinde çalışan veritabanı ekleme/düzenleme/silme/test etme.
Lokal dosya ekleme, klasör seçme, yeni veritabanı oluşturma.
"""

import json
import os
import sqlite3
import subprocess
import uuid
from datetime import datetime
from PySide6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QLineEdit,
    QScrollArea,
    QFrame,
    QComboBox,
    QStackedWidget,
    QMessageBox,
    QSpinBox,
    QSizePolicy,
    QFileDialog,
)
from PySide6.QtCore import Qt, Signal, QTimer
from PySide6.QtGui import QColor

from ui.translations import tr, get_translator

# Config dosya yolu
CONFIG_DIR = os.path.dirname(os.path.dirname(__file__))
DB_CONFIG_PATH = os.path.join(CONFIG_DIR, "db_connections.json")
LOCAL_CONFIG_PATH = os.path.join(CONFIG_DIR, "local_databases.json")


def _format_size(size_bytes: int) -> str:
    """Dosya boyutunu okunabilir formata çevir."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"


def _get_sqlite_info(filepath: str) -> dict:
    """SQLite dosyasından tablo ve kayıt bilgisi al."""
    info = {"tables": 0, "records": 0, "table_names": []}
    try:
        conn = sqlite3.connect(filepath)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        info["tables"] = len(tables)
        info["table_names"] = [t[0] for t in tables]
        total_records = 0
        for table in tables:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM [{table[0]}]")
                total_records += cursor.fetchone()[0]
            except sqlite3.Error:
                pass
        info["records"] = total_records
        conn.close()
    except (sqlite3.Error, OSError):
        pass
    return info


# DB türlerine göre ikonlar, renkler ve varsayılan portlar
DB_TYPE_CONFIG = {
    "postgresql": {
        "icon": "🐘",
        "color": "#336791",
        "label": "PostgreSQL",
        "default_port": 5432,
    },
    "mysql": {"icon": "🐬", "color": "#4479A1", "label": "MySQL", "default_port": 3306},
    "mssql": {
        "icon": "🔷",
        "color": "#CC2927",
        "label": "SQL Server",
        "default_port": 1433,
    },
}


# ============================================================
#  Database Connection Card (PostgreSQL, MySQL, SQL Server)
# ============================================================


class DatabaseConnectionCard(QWidget):
    """Tek bir veritabanı bağlantısını gösteren kart."""

    edit_requested = Signal(dict)
    delete_requested = Signal(str)
    set_active_requested = Signal(str)
    test_requested = Signal(dict)

    def __init__(self, connection: dict, is_active: bool = False, parent=None):
        super().__init__(parent)
        self._connection = connection
        self._is_active = is_active
        self._setup_ui()

    def _setup_ui(self):
        self.setObjectName("dashboard_card")
        self.setFixedHeight(120)

        layout = QHBoxLayout(self)
        layout.setContentsMargins(20, 16, 20, 16)
        layout.setSpacing(16)

        # Sol: DB türüne göre ikon
        db_type = self._connection.get("db_type", "postgresql")
        cfg = DB_TYPE_CONFIG.get(db_type, DB_TYPE_CONFIG["postgresql"])

        type_icon = QLabel(cfg["icon"])
        type_icon.setFixedSize(44, 44)
        type_icon.setAlignment(Qt.AlignCenter)
        type_icon.setStyleSheet(
            f"background-color: {cfg['color']}33; border-radius: 10px; font-size: 22px;"
        )
        layout.addWidget(type_icon)

        # Orta: Bağlantı bilgileri
        info_section = QWidget()
        info_layout = QVBoxLayout(info_section)
        info_layout.setContentsMargins(0, 0, 0, 0)
        info_layout.setSpacing(4)

        name_row = QHBoxLayout()
        name_label = QLabel(self._connection.get("name", "Unnamed"))
        name_label
        name_row.addWidget(name_label)

        # DB türü badge
        type_badge = QLabel(f"  {cfg['label']}")
        type_badge.setStyleSheet(
            f"color: {cfg['color']}; font-size: 11px; font-weight: 600;"
        )
        name_row.addWidget(type_badge)

        if self._is_active:
            active_badge = QLabel(f"  ● {tr('db.active')}")
            active_badge
            name_row.addWidget(active_badge)

        name_row.addStretch()
        info_layout.addLayout(name_row)

        host = self._connection.get("host", "localhost")
        port = self._connection.get("port", cfg["default_port"])
        db = self._connection.get("database", "")
        user = self._connection.get("username", "")
        detail_text = f"🖥️  {host}:{port}  •  📁  {db}  •  👤  {user}"
        detail_label = QLabel(detail_text)
        detail_label
        info_layout.addWidget(detail_label)

        layout.addWidget(info_section, stretch=1)

        # Sağ: Butonlar
        btn_section = QWidget()
        btn_layout = QHBoxLayout(btn_section)
        btn_layout.setContentsMargins(0, 0, 0, 0)
        btn_layout.setSpacing(8)

        if not self._is_active:
            set_active_btn = QPushButton(tr("db.set_active"))
            set_active_btn.setCursor(Qt.PointingHandCursor)
            set_active_btn
            set_active_btn.clicked.connect(
                lambda: self.set_active_requested.emit(self._connection.get("id", ""))
            )
            btn_layout.addWidget(set_active_btn)

        test_btn = QPushButton(tr("db.test_connection"))
        test_btn.setCursor(Qt.PointingHandCursor)
        test_btn
        test_btn.clicked.connect(lambda: self.test_requested.emit(self._connection))
        btn_layout.addWidget(test_btn)

        edit_btn = QPushButton("✏️")
        edit_btn.setCursor(Qt.PointingHandCursor)
        edit_btn
        edit_btn.clicked.connect(lambda: self.edit_requested.emit(self._connection))
        btn_layout.addWidget(edit_btn)

        import os
        from PySide6.QtGui import QIcon
        from PySide6.QtCore import QSize
        delete_btn = QPushButton()
        icon_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets", "trash.svg")
        if os.path.exists(icon_path):
            delete_btn.setIcon(QIcon(icon_path))
            delete_btn.setIconSize(QSize(20, 20))
        else:
            delete_btn.setText("🗑️")
        delete_btn.setObjectName("table_delete_btn")
        delete_btn.setCursor(Qt.PointingHandCursor)
        delete_btn
        delete_btn.clicked.connect(
            lambda: self.delete_requested.emit(self._connection.get("id", ""))
        )
        btn_layout.addWidget(delete_btn)

        layout.addWidget(btn_section)


# ============================================================
#  Local Database File Card
# ============================================================


class LocalDbFileCard(QWidget):
    """Lokal veritabanı dosyası kartı."""

    remove_requested = Signal(str)
    open_folder_requested = Signal(str)
    export_requested = Signal(str)

    def __init__(self, file_info: dict, parent=None):
        super().__init__(parent)
        self._file_info = file_info
        self._setup_ui()

    def _setup_ui(self):
        self.setObjectName("dashboard_card")
        self.setFixedHeight(110)

        layout = QHBoxLayout(self)
        layout.setContentsMargins(20, 14, 20, 14)
        layout.setSpacing(16)

        # Sol: Dosya/Script ikonu
        path = self._file_info.get("path", "")
        is_sql = path.lower().endswith(".sql")
        icon_char = "📜" if is_sql else "🗄️"
        bg_color = "#3FB95033" if is_sql else "#A371F733"

        icon = QLabel(icon_char)
        icon.setFixedSize(44, 44)
        icon.setAlignment(Qt.AlignCenter)
        icon.setStyleSheet(
            f"background-color: {bg_color}; border-radius: 10px; font-size: 22px;"
        )
        layout.addWidget(icon)

        # Orta: Dosya bilgileri
        info_section = QWidget()
        info_layout = QVBoxLayout(info_section)
        info_layout.setContentsMargins(0, 0, 0, 0)
        info_layout.setSpacing(4)

        # İsim
        name = self._file_info.get("name", "Unknown")
        name_label = QLabel(name)
        name_label
        info_layout.addWidget(name_label)

        # Yol
        path = self._file_info.get("path", "")
        path_label = QLabel(f"📂  {path}")
        path_label
        path_label.setWordWrap(True)
        info_layout.addWidget(path_label)

        # Detaylar satırı
        details = []
        size = self._file_info.get("size", "")
        if size:
            details.append(f"💾 {size}")

        tables = self._file_info.get("tables", 0)
        records = self._file_info.get("records", 0)
        if tables:
            details.append(f"📋 {tables} {tr('local.tables')}")
        if records:
            details.append(f"📝 {records:,} {tr('local.records')}")

        modified = self._file_info.get("last_modified", "")
        if modified:
            details.append(f"🕐 {modified}")

        if details:
            detail_label = QLabel("  •  ".join(details))
            detail_label
            info_layout.addWidget(detail_label)

        layout.addWidget(info_section, stretch=1)

        # Sağ: Butonlar
        btn_section = QWidget()
        btn_layout = QHBoxLayout(btn_section)
        btn_layout.setContentsMargins(0, 0, 0, 0)
        btn_layout.setSpacing(8)

        open_btn = QPushButton(f"📂")
        open_btn.setToolTip(tr("local.open_folder"))
        open_btn.setCursor(Qt.PointingHandCursor)
        open_btn
        open_btn.clicked.connect(
            lambda: self.open_folder_requested.emit(self._file_info.get("path", ""))
        )
        btn_layout.addWidget(open_btn)

        export_btn = QPushButton("📤")
        export_btn.setToolTip(tr("local.export_db"))
        export_btn.setCursor(Qt.PointingHandCursor)
        export_btn
        export_btn.clicked.connect(
            lambda: self.export_requested.emit(self._file_info.get("path", ""))
        )
        btn_layout.addWidget(export_btn)

        import os
        from PySide6.QtGui import QIcon
        from PySide6.QtCore import QSize
        remove_btn = QPushButton()
        icon_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets", "trash.svg")
        if os.path.exists(icon_path):
            remove_btn.setIcon(QIcon(icon_path))
            remove_btn.setIconSize(QSize(20, 20))
        else:
            remove_btn.setText("🗑️")
        remove_btn.setObjectName("table_delete_btn")
        remove_btn.setToolTip(tr("local.remove"))
        remove_btn.setCursor(Qt.PointingHandCursor)
        remove_btn
        remove_btn.clicked.connect(
            lambda: self.remove_requested.emit(self._file_info.get("id", ""))
        )
        btn_layout.addWidget(remove_btn)

        layout.addWidget(btn_section)


# ============================================================
#  Data Folder Card
# ============================================================


class DataFolderCard(QWidget):
    """Veri klasörü kartı."""

    remove_requested = Signal(str)
    open_requested = Signal(str)

    def __init__(self, folder_info: dict, parent=None):
        super().__init__(parent)
        self._folder_info = folder_info
        self._setup_ui()

    def _setup_ui(self):
        self.setObjectName("dashboard_card")
        self.setFixedHeight(80)

        layout = QHBoxLayout(self)
        layout.setContentsMargins(20, 12, 20, 12)
        layout.setSpacing(16)

        # İkon
        folder_type = self._folder_info.get("type", "data")
        type_icons = {
            "backup": ("💼", "#3FB950"),
            "export": ("📤", "#58A6FF"),
            "import": ("📥", "#D29922"),
            "data": ("📁", "#A371F7"),
        }
        icon_char, accent = type_icons.get(folder_type, ("📁", "#A371F7"))

        icon = QLabel(icon_char)
        icon.setFixedSize(40, 40)
        icon.setAlignment(Qt.AlignCenter)
        icon.setStyleSheet(
            f"background-color: {accent}33; border-radius: 10px; font-size: 20px;"
        )
        layout.addWidget(icon)

        # Bilgiler
        info_section = QWidget()
        info_layout = QVBoxLayout(info_section)
        info_layout.setContentsMargins(0, 0, 0, 0)
        info_layout.setSpacing(2)

        name_row = QHBoxLayout()
        name = self._folder_info.get("name", "Unnamed")
        name_label = QLabel(name)
        name_label
        name_row.addWidget(name_label)

        type_badge = QLabel(f"  {tr(f'local.folder_type_{folder_type}')}")
        type_badge.setStyleSheet(f"color: {accent}; font-size: 11px; font-weight: 600;")
        name_row.addWidget(type_badge)
        name_row.addStretch()
        info_layout.addLayout(name_row)

        path_label = QLabel(self._folder_info.get("path", ""))
        path_label
        info_layout.addWidget(path_label)

        layout.addWidget(info_section, stretch=1)

        # Butonlar
        open_btn = QPushButton("📂")
        open_btn.setToolTip(tr("local.open_folder"))
        open_btn.setCursor(Qt.PointingHandCursor)
        open_btn
        open_btn.clicked.connect(
            lambda: self.open_requested.emit(self._folder_info.get("path", ""))
        )
        layout.addWidget(open_btn)

        import os
        from PySide6.QtGui import QIcon
        from PySide6.QtCore import QSize
        remove_btn = QPushButton()
        icon_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets", "trash.svg")
        if os.path.exists(icon_path):
            remove_btn.setIcon(QIcon(icon_path))
            remove_btn.setIconSize(QSize(20, 20))
        else:
            remove_btn.setText("🗑️")
        remove_btn.setObjectName("table_delete_btn")
        remove_btn.setCursor(Qt.PointingHandCursor)
        remove_btn
        remove_btn.clicked.connect(
            lambda: self.remove_requested.emit(self._folder_info.get("id", ""))
        )
        layout.addWidget(remove_btn)


# ============================================================
#  Database Connection Form (PostgreSQL, MySQL, SQL Server)
# ============================================================


def _build_connection_url(data: dict) -> tuple[str, str]:
    """DB türüne göre SQLAlchemy URL ve gerekli paket bilgisi döndür."""
    db_type = data.get("db_type", "postgresql")
    user = data.get("username", "")
    password = data.get("password", "")
    host = data.get("host", "localhost")
    port = data.get("port", 5432)
    database = data.get("database", "")

    if db_type == "postgresql":
        url = f"postgresql://{user}:{password}@{host}:{port}/{database}"
        driver_pkg = "pip install sqlalchemy psycopg2-binary"
    elif db_type == "mysql":
        url = f"mysql+pymysql://{user}:{password}@{host}:{port}/{database}"
        driver_pkg = "pip install sqlalchemy pymysql"
    elif db_type == "mssql":
        url = f"mssql+pymssql://{user}:{password}@{host}:{port}/{database}"
        driver_pkg = "pip install sqlalchemy pymssql"
    else:
        url = f"postgresql://{user}:{password}@{host}:{port}/{database}"
        driver_pkg = "pip install sqlalchemy psycopg2-binary"

    return url, driver_pkg


class DatabaseFormDialog(QWidget):
    """Veritabanı bağlantı ekleme/düzenleme formu (PostgreSQL, MySQL, SQL Server)."""

    saved = Signal(dict)
    cancelled = Signal()

    def __init__(self, connection: dict = None, parent=None):
        super().__init__(parent)
        self._editing = connection is not None
        self._connection = connection or {}
        self._setup_ui()

    def _setup_ui(self):
        self.setObjectName("table_container")

        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(16)

        title = QLabel(
            f"✏️  {tr('db.edit')}" if self._editing else f"＋  {tr('db.add_new')}"
        )
        title
        layout.addWidget(title)

        form_layout = QVBoxLayout()
        form_layout.setSpacing(12)

        # Bağlantı adı ve Tür - yan yana
        name_type_row = QHBoxLayout()

        self._name_input = self._create_field(
            tr("db.connection_name"),
            self._connection.get("name", ""),
            tr("db.default_name"),
        )
        name_type_row.addWidget(self._name_input["container"], stretch=2)

        # Veritabanı türü seçici
        type_container = QWidget()
        type_layout = QVBoxLayout(type_container)
        type_layout.setContentsMargins(0, 0, 0, 0)
        type_layout.setSpacing(4)

        type_label = QLabel(tr("db.db_type"))
        type_label
        type_layout.addWidget(type_label)

        self._type_combo = QComboBox()
        self._type_combo.addItem("🐘  PostgreSQL", "postgresql")
        self._type_combo.addItem("🐬  MySQL", "mysql")
        self._type_combo.addItem("🔷  SQL Server", "mssql")
        self._type_combo.setStyleSheet(
            "QComboBox { background-color: #0D1117; border: 1px solid #30363D; "
            "border-radius: 8px; padding: 10px 14px; color: #C9D1D9; "
            "font-size: 13px; min-width: 180px; }"
            "QComboBox:focus { border-color: #1F6FEB; }"
            "QComboBox::drop-down { border: none; width: 30px; }"
            "QComboBox::down-arrow { image: none; border: none; }"
            "QComboBox QAbstractItemView { background-color: #161B22; "
            "border: 1px solid #30363D; color: #C9D1D9; selection-background-color: #1F6FEB; }"
        )

        # Mevcut türü seç
        current_type = self._connection.get("db_type", "postgresql")
        type_index = {"postgresql": 0, "mysql": 1, "mssql": 2}.get(current_type, 0)
        self._type_combo.setCurrentIndex(type_index)
        self._type_combo.currentIndexChanged.connect(self._on_type_changed)

        type_layout.addWidget(self._type_combo)
        name_type_row.addWidget(type_container, stretch=1)

        form_layout.addLayout(name_type_row)

        # Host ve Port - yan yana
        host_port_row = QHBoxLayout()

        self._host_input = self._create_field(
            tr("db.host"), self._connection.get("host", ""), "localhost"
        )
        host_port_row.addWidget(self._host_input["container"], stretch=3)

        port_container = QWidget()
        port_layout = QVBoxLayout(port_container)
        port_layout.setContentsMargins(0, 0, 0, 0)
        port_layout.setSpacing(4)

        port_label = QLabel(tr("db.port"))
        port_label
        port_layout.addWidget(port_label)

        default_port = DB_TYPE_CONFIG.get(current_type, {}).get("default_port", 5432)
        self._port_input = QSpinBox()
        self._port_input.setRange(1, 65535)
        self._port_input.setValue(self._connection.get("port", default_port))
        self._port_input.setStyleSheet(
            "QSpinBox { background-color: #0D1117; border: 1px solid #30363D; "
            "border-radius: 8px; padding: 10px 14px; color: #C9D1D9; font-size: 13px; }"
            "QSpinBox:focus { border-color: #1F6FEB; }"
        )
        port_layout.addWidget(self._port_input)

        host_port_row.addWidget(port_container, stretch=1)
        form_layout.addLayout(host_port_row)

        # Veritabanı adı
        self._db_input = self._create_field(
            tr("db.database_name"), self._connection.get("database", ""), "remalab_db"
        )
        form_layout.addWidget(self._db_input["container"])

        # Kullanıcı adı ve Şifre
        cred_row = QHBoxLayout()

        default_user = {"postgresql": "postgres", "mysql": "root", "mssql": "sa"}
        self._user_input = self._create_field(
            tr("db.username"),
            self._connection.get("username", ""),
            default_user.get(current_type, "postgres"),
        )
        cred_row.addWidget(self._user_input["container"])

        self._pass_input = self._create_field(
            tr("db.password"),
            self._connection.get("password", ""),
            "••••••••",
            is_password=True,
        )
        cred_row.addWidget(self._pass_input["container"])

        form_layout.addLayout(cred_row)
        layout.addLayout(form_layout)

        # Durum mesajı
        self._status_label = QLabel("")
        self._status_label
        self._status_label.setVisible(False)
        self._status_label.setWordWrap(True)
        layout.addWidget(self._status_label)

        # Butonlar
        btn_row = QHBoxLayout()
        btn_row.addStretch()

        cancel_btn = QPushButton(tr("db.cancel"))
        cancel_btn.setCursor(Qt.PointingHandCursor)
        cancel_btn
        cancel_btn.clicked.connect(self.cancelled.emit)
        btn_row.addWidget(cancel_btn)

        test_btn = QPushButton(f"🔌  {tr('db.test_connection')}")
        test_btn.setCursor(Qt.PointingHandCursor)
        test_btn
        test_btn.clicked.connect(self._test_connection)
        btn_row.addWidget(test_btn)

        save_btn = QPushButton(f"💾  {tr('db.save')}")
        save_btn.setCursor(Qt.PointingHandCursor)
        save_btn
        save_btn.clicked.connect(self._save)
        btn_row.addWidget(save_btn)

        layout.addLayout(btn_row)

    def _on_type_changed(self, index: int):
        """DB türü değiştiğinde port'u otomatik güncelle."""
        db_type = self._type_combo.itemData(index)
        cfg = DB_TYPE_CONFIG.get(db_type, {})
        default_port = cfg.get("default_port", 5432)
        # Sadece port varsayılan değerdeyse güncelle
        current_port = self._port_input.value()
        default_ports = [5432, 3306, 1433]
        if current_port in default_ports:
            self._port_input.setValue(default_port)

    def _create_field(
        self, label_text: str, value: str, placeholder: str, is_password: bool = False
    ) -> dict:
        container = QWidget()
        layout = QVBoxLayout(container)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(4)

        label = QLabel(label_text)
        label
        layout.addWidget(label)

        input_field = QLineEdit()
        input_field.setText(value)
        input_field.setPlaceholderText(placeholder)
        if is_password:
            input_field.setEchoMode(QLineEdit.Password)
        input_field.setStyleSheet(
            "QLineEdit { background-color: #0D1117; border: 1px solid #30363D; "
            "border-radius: 8px; padding: 10px 14px; color: #C9D1D9; font-size: 13px; }"
            "QLineEdit:focus { border-color: #1F6FEB; }"
        )
        layout.addWidget(input_field)

        return {"container": container, "input": input_field}

    def _get_connection_data(self) -> dict:
        db_type = self._type_combo.itemData(self._type_combo.currentIndex())
        return {
            "id": self._connection.get("id", str(uuid.uuid4())[:8]),
            "name": self._name_input["input"].text().strip() or tr("db.default_name"),
            "db_type": db_type,
            "host": self._host_input["input"].text().strip() or "localhost",
            "port": self._port_input.value(),
            "database": self._db_input["input"].text().strip(),
            "username": self._user_input["input"].text().strip(),
            "password": self._pass_input["input"].text().strip(),
        }

    def _test_connection(self):
        data = self._get_connection_data()
        self._status_label.setVisible(True)
        self._status_label.setText(f"⏳  {tr('db.testing')}")
        self._status_label
        self._status_label.repaint()

        url, driver_pkg = _build_connection_url(data)

        try:
            from sqlalchemy import create_engine, text

            engine = create_engine(url, connect_args={"connect_timeout": 5})
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            self._status_label.setText(f"✅  {tr('db.success')}")
            self._status_label
        except ImportError:
            self._status_label.setText(f"⚠️  {tr('db.driver_missing')}\n{driver_pkg}")
            self._status_label
        except Exception as e:
            error_msg = str(e).split("\n")[0][:100]
            self._status_label.setText(f"❌  {tr('db.failed')}\n{error_msg}")
            self._status_label

    def _save(self):
        data = self._get_connection_data()
        if not data["database"]:
            self._status_label.setVisible(True)
            self._status_label.setText("⚠️  Veritabanı adı gerekli!")
            self._status_label
            return
        self.saved.emit(data)


# ============================================================
#  Settings Page
# ============================================================


class SettingsPage(QWidget):
    """Ayarlar sayfası - Dil, PostgreSQL ve Lokal DB yönetimi."""

    def __init__(self, parent=None):
        super().__init__(parent)
        # PostgreSQL bağlantıları
        self._connections: list[dict] = []
        self._active_connection_id: str = ""
        self._load_connections()

        # Lokal DB dosyaları ve klasörler
        self._local_files: list[dict] = []
        self._data_folders: list[dict] = []
        self._load_local_config()

        self._setup_ui()

    def _setup_ui(self):
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.NoFrame)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)

        content = QWidget()
        self._main_layout = QVBoxLayout(content)
        self._main_layout.setContentsMargins(28, 28, 28, 28)
        self._main_layout.setSpacing(24)

        # Başlık
        title = QLabel(tr("settings.title"))
        title.setObjectName("dashboard_title")
        self._main_layout.addWidget(title)

        subtitle = QLabel(tr("settings.subtitle"))
        subtitle.setObjectName("dashboard_subtitle")
        self._main_layout.addWidget(subtitle)

        # Tab butonları
        tab_row = QHBoxLayout()
        tab_row.setSpacing(8)

        self._tab_buttons = {}
        tabs = [
            ("general", tr("settings.general"), "⚙️"),
            ("database", tr("settings.database"), "🗄️"),
            ("local_db", tr("settings.local_db"), "💾"),
        ]

        for key, label, icon in tabs:
            btn = QPushButton(f" {icon}  {label}")
            btn.setCursor(Qt.PointingHandCursor)
            btn.setFixedHeight(40)
            btn.clicked.connect(lambda checked, k=key: self._switch_tab(k))
            self._tab_buttons[key] = btn
            tab_row.addWidget(btn)

        tab_row.addStretch()
        self._main_layout.addLayout(tab_row)

        # Tab içerikleri
        self._tab_stack = QStackedWidget()

        # General tab
        general_tab = self._create_general_tab()
        self._tab_stack.addWidget(general_tab)

        # PostgreSQL Database tab
        self._db_tab_stack = QStackedWidget()
        self._db_list_widget = self._create_db_list()
        self._db_tab_stack.addWidget(self._db_list_widget)
        self._tab_stack.addWidget(self._db_tab_stack)

        # Local DB tab
        local_db_tab = self._create_local_db_tab()
        self._tab_stack.addWidget(local_db_tab)

        self._main_layout.addWidget(self._tab_stack)
        self._main_layout.addStretch()

        scroll.setWidget(content)

        outer_layout = QVBoxLayout(self)
        outer_layout.setContentsMargins(0, 0, 0, 0)
        outer_layout.addWidget(scroll)

        self._switch_tab("general")

    def _switch_tab(self, tab_key: str):
        tab_index = {"general": 0, "database": 1, "local_db": 2}.get(tab_key, 0)
        self._tab_stack.setCurrentIndex(tab_index)

        for key, btn in self._tab_buttons.items():
            if key == tab_key:
                btn
            else:
                btn

    # ============================================================
    #  General Tab
    # ============================================================

    def _create_general_tab(self) -> QWidget:
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(0, 16, 0, 0)
        layout.setSpacing(16)

        lang_card = QWidget()
        lang_card.setObjectName("dashboard_card")
        lang_layout = QHBoxLayout(lang_card)
        lang_layout.setContentsMargins(20, 20, 20, 20)
        lang_layout.setSpacing(16)

        lang_icon = QLabel("🌐")
        lang_icon.setFixedSize(44, 44)
        lang_icon.setAlignment(Qt.AlignCenter)
        lang_icon
        lang_layout.addWidget(lang_icon)

        lang_info = QWidget()
        lang_info_layout = QVBoxLayout(lang_info)
        lang_info_layout.setContentsMargins(0, 0, 0, 0)
        lang_info_layout.setSpacing(2)

        lang_title = QLabel(tr("settings.language"))
        lang_title
        lang_info_layout.addWidget(lang_title)

        lang_desc = QLabel(tr("settings.language_desc"))
        lang_desc
        lang_info_layout.addWidget(lang_desc)

        lang_layout.addWidget(lang_info, stretch=1)

        self._lang_combo = QComboBox()
        self._lang_combo.addItem("🇹🇷  Türkçe", "tr")
        self._lang_combo.addItem("🇬🇧  English", "en")
        self._lang_combo.setStyleSheet(
            "QComboBox { background-color: #0D1117; border: 1px solid #30363D; "
            "border-radius: 8px; padding: 10px 16px; color: #C9D1D9; "
            "font-size: 13px; min-width: 160px; }"
            "QComboBox:focus { border-color: #1F6FEB; }"
            "QComboBox::drop-down { border: none; width: 30px; }"
            "QComboBox::down-arrow { image: none; border: none; }"
            "QComboBox QAbstractItemView { background-color: #161B22; "
            "border: 1px solid #30363D; color: #C9D1D9; selection-background-color: #1F6FEB; }"
        )
        translator = get_translator()
        idx = 0 if translator.current_language == "tr" else 1
        self._lang_combo.setCurrentIndex(idx)
        self._lang_combo.currentIndexChanged.connect(self._on_language_changed)
        lang_layout.addWidget(self._lang_combo)

        layout.addWidget(lang_card)
        layout.addStretch()

        return widget

    def _on_language_changed(self, index: int):
        lang = self._lang_combo.itemData(index)
        translator = get_translator()
        translator.set_language(lang)

    # ============================================================
    #  PostgreSQL Database Tab
    # ============================================================

    def _create_db_list(self) -> QWidget:
        widget = QWidget()
        self._db_list_layout = QVBoxLayout(widget)
        self._db_list_layout.setContentsMargins(0, 16, 0, 0)
        self._db_list_layout.setSpacing(12)

        header_row = QHBoxLayout()
        header_info = QWidget()
        header_info_layout = QVBoxLayout(header_info)
        header_info_layout.setContentsMargins(0, 0, 0, 0)
        header_info_layout.setSpacing(4)

        db_title = QLabel(f"🗄️  {tr('db.title')}")
        db_title
        header_info_layout.addWidget(db_title)

        db_subtitle = QLabel(tr("db.subtitle"))
        db_subtitle
        header_info_layout.addWidget(db_subtitle)

        header_row.addWidget(header_info)
        header_row.addStretch()

        add_btn = QPushButton(tr("db.add_new"))
        add_btn.setCursor(Qt.PointingHandCursor)
        add_btn
        add_btn.clicked.connect(self._show_add_form)
        header_row.addWidget(add_btn)

        self._db_list_layout.addLayout(header_row)

        self._cards_container = QWidget()
        self._cards_layout = QVBoxLayout(self._cards_container)
        self._cards_layout.setContentsMargins(0, 0, 0, 0)
        self._cards_layout.setSpacing(8)
        self._db_list_layout.addWidget(self._cards_container)

        self._refresh_cards()
        self._db_list_layout.addStretch()

        return widget

    def _refresh_cards(self):
        while self._cards_layout.count():
            child = self._cards_layout.takeAt(0)
            if child.widget():
                child.widget().deleteLater()

        if not self._connections:
            empty_label = QLabel(tr("db.no_connections"))
            empty_label.setAlignment(Qt.AlignCenter)
            empty_label
            self._cards_layout.addWidget(empty_label)
        else:
            for conn in self._connections:
                is_active = conn.get("id") == self._active_connection_id
                card = DatabaseConnectionCard(conn, is_active)
                card.edit_requested.connect(self._show_edit_form)
                card.delete_requested.connect(self._delete_connection)
                card.set_active_requested.connect(self._set_active_connection)
                card.test_requested.connect(self._test_connection_from_card)
                self._cards_layout.addWidget(card)

    def _show_add_form(self):
        form = DatabaseFormDialog()
        form.saved.connect(self._on_connection_saved)
        form.cancelled.connect(self._hide_form)

        if self._db_tab_stack.count() > 1:
            old = self._db_tab_stack.widget(1)
            self._db_tab_stack.removeWidget(old)
            old.deleteLater()

        self._db_tab_stack.addWidget(form)
        self._db_tab_stack.setCurrentIndex(1)

    def _show_edit_form(self, connection: dict):
        form = DatabaseFormDialog(connection)
        form.saved.connect(self._on_connection_saved)
        form.cancelled.connect(self._hide_form)

        if self._db_tab_stack.count() > 1:
            old = self._db_tab_stack.widget(1)
            self._db_tab_stack.removeWidget(old)
            old.deleteLater()

        self._db_tab_stack.addWidget(form)
        self._db_tab_stack.setCurrentIndex(1)

    def _hide_form(self):
        self._db_tab_stack.setCurrentIndex(0)
        if self._db_tab_stack.count() > 1:
            old = self._db_tab_stack.widget(1)
            self._db_tab_stack.removeWidget(old)
            old.deleteLater()

    def _on_connection_saved(self, data: dict):
        existing = next((c for c in self._connections if c["id"] == data["id"]), None)
        if existing:
            idx = self._connections.index(existing)
            self._connections[idx] = data
        else:
            self._connections.append(data)
            if len(self._connections) == 1:
                self._active_connection_id = data["id"]

        self._save_connections()
        self._refresh_cards()
        self._hide_form()

    def _delete_connection(self, conn_id: str):
        reply = QMessageBox.question(
            self,
            tr("db.delete"),
            tr("db.confirm_delete"),
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No,
        )
        if reply == QMessageBox.Yes:
            self._connections = [c for c in self._connections if c.get("id") != conn_id]
            if self._active_connection_id == conn_id:
                self._active_connection_id = (
                    self._connections[0]["id"] if self._connections else ""
                )
            self._save_connections()
            self._refresh_cards()

    def _set_active_connection(self, conn_id: str):
        self._active_connection_id = conn_id
        self._save_connections()
        self._refresh_cards()

    def _test_connection_from_card(self, connection: dict):
        url, driver_pkg = _build_connection_url(connection)
        try:
            from sqlalchemy import create_engine, text

            engine = create_engine(url, connect_args={"connect_timeout": 5})
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            QMessageBox.information(self, "✅", tr("db.success"))
        except ImportError:
            QMessageBox.warning(self, "⚠️", f"{tr('db.driver_missing')}\n{driver_pkg}")
        except Exception as e:
            QMessageBox.critical(self, "❌", f"{tr('db.failed')}\n\n{str(e)[:200]}")

    # ============================================================
    #  Local Database Tab
    # ============================================================

    def _create_local_db_tab(self) -> QWidget:
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(0, 16, 0, 0)
        layout.setSpacing(20)

        # ---- Veritabanı Dosyaları Bölümü ----
        files_header = QHBoxLayout()

        files_info = QWidget()
        files_info_layout = QVBoxLayout(files_info)
        files_info_layout.setContentsMargins(0, 0, 0, 0)
        files_info_layout.setSpacing(4)

        files_title = QLabel(f"🗄️  {tr('local.title')}")
        files_title
        files_info_layout.addWidget(files_title)

        files_subtitle = QLabel(tr("local.subtitle"))
        files_subtitle
        files_info_layout.addWidget(files_subtitle)

        files_header.addWidget(files_info)
        files_header.addStretch()

        # Dosya ekleme butonları
        btn_container = QHBoxLayout()
        btn_container.setSpacing(8)

        add_file_btn = QPushButton(tr("local.add_db_file"))
        add_file_btn.setCursor(Qt.PointingHandCursor)
        add_file_btn
        add_file_btn.clicked.connect(self._add_local_db_file)
        btn_container.addWidget(add_file_btn)

        create_btn = QPushButton(tr("local.create_new_db"))
        create_btn.setCursor(Qt.PointingHandCursor)
        create_btn
        create_btn.clicked.connect(self._create_new_db)
        btn_container.addWidget(create_btn)

        files_header.addLayout(btn_container)
        layout.addLayout(files_header)

        # Dosya kartları
        self._local_files_container = QWidget()
        self._local_files_layout = QVBoxLayout(self._local_files_container)
        self._local_files_layout.setContentsMargins(0, 0, 0, 0)
        self._local_files_layout.setSpacing(8)
        layout.addWidget(self._local_files_container)

        self._refresh_local_files()

        # ---- Ayırıcı ----
        sep = QFrame()
        sep.setFrameShape(QFrame.HLine)
        sep
        layout.addWidget(sep)

        # ---- Veri Klasörleri Bölümü ----
        folders_header = QHBoxLayout()

        folders_info = QWidget()
        folders_info_layout = QVBoxLayout(folders_info)
        folders_info_layout.setContentsMargins(0, 0, 0, 0)
        folders_info_layout.setSpacing(4)

        folders_title = QLabel(f"📁  {tr('local.data_folders')}")
        folders_title
        folders_info_layout.addWidget(folders_title)

        folders_subtitle = QLabel(tr("local.data_folders_subtitle"))
        folders_subtitle
        folders_info_layout.addWidget(folders_subtitle)

        folders_header.addWidget(folders_info)
        folders_header.addStretch()

        add_folder_btn = QPushButton(tr("local.add_folder"))
        add_folder_btn.setCursor(Qt.PointingHandCursor)
        add_folder_btn
        add_folder_btn.clicked.connect(self._add_data_folder)
        folders_header.addWidget(add_folder_btn)

        layout.addLayout(folders_header)

        # Klasör kartları
        self._folders_container = QWidget()
        self._folders_layout = QVBoxLayout(self._folders_container)
        self._folders_layout.setContentsMargins(0, 0, 0, 0)
        self._folders_layout.setSpacing(8)
        layout.addWidget(self._folders_container)

        self._refresh_folders()

        layout.addStretch()
        return widget

    def _refresh_local_files(self):
        """Lokal DB dosya kartlarını yeniden oluştur."""
        while self._local_files_layout.count():
            child = self._local_files_layout.takeAt(0)
            if child.widget():
                child.widget().deleteLater()

        if not self._local_files:
            empty = QLabel(tr("local.no_files"))
            empty.setAlignment(Qt.AlignCenter)
            empty
            self._local_files_layout.addWidget(empty)
        else:
            for file_info in self._local_files:
                # Dosya bilgilerini güncelle
                path = file_info.get("path", "")
                if os.path.exists(path):
                    stat = os.stat(path)
                    file_info["size"] = _format_size(stat.st_size)
                    file_info["last_modified"] = datetime.fromtimestamp(
                        stat.st_mtime
                    ).strftime("%d.%m.%Y %H:%M")

                    # SQLite bilgileri
                    if path.endswith((".db", ".sqlite", ".sqlite3")):
                        info = _get_sqlite_info(path)
                        file_info["tables"] = info["tables"]
                        file_info["records"] = info["records"]
                else:
                    file_info["size"] = "⚠️ Dosya bulunamadı"

                card = LocalDbFileCard(file_info)
                card.remove_requested.connect(self._remove_local_file)
                card.open_folder_requested.connect(self._open_file_location)
                card.export_requested.connect(self._export_db_file)
                self._local_files_layout.addWidget(card)

    def _refresh_folders(self):
        """Klasör kartlarını yeniden oluştur."""
        while self._folders_layout.count():
            child = self._folders_layout.takeAt(0)
            if child.widget():
                child.widget().deleteLater()

        if not self._data_folders:
            empty = QLabel(tr("local.no_folders"))
            empty.setAlignment(Qt.AlignCenter)
            empty
            self._folders_layout.addWidget(empty)
        else:
            for folder_info in self._data_folders:
                card = DataFolderCard(folder_info)
                card.remove_requested.connect(self._remove_folder)
                card.open_requested.connect(self._open_folder_in_explorer)
                self._folders_layout.addWidget(card)

    def _add_local_db_file(self):
        """Var olan bir veritabanı (.db, .sqlite) veya SQL (.sql) dosyasını ekle."""
        filepath, _ = QFileDialog.getOpenFileName(
            self,
            tr("local.select_db_file"),
            "",
            "Database & SQL Files (*.db *.sqlite *.sqlite3 *.sdb *.sql);;Database Files (*.db *.sqlite *.sqlite3 *.sdb);;SQL Scripts (*.sql);;All Files (*.*)",
        )
        if filepath:
            # Zaten ekliyse atla
            # Dosyayı projedeki 'database' klasörüne kopyala
            db_dir = os.path.join(
                os.path.dirname(os.path.dirname(__file__)), "database"
            )
            if not os.path.exists(db_dir):
                os.makedirs(db_dir, exist_ok=True)

            filename = os.path.basename(filepath)
            dest_path = os.path.join(db_dir, filename)

            import shutil

            try:
                if os.path.abspath(filepath) != os.path.abspath(dest_path):
                    shutil.copy2(filepath, dest_path)
            except Exception as e:
                QMessageBox.critical(self, "❌", f"Kopyalama hatası: {str(e)[:200]}")
                return

            name = os.path.splitext(filename)[0]
            file_entry = {
                "id": str(uuid.uuid4())[:8],
                "name": name,
                "path": dest_path,
                "type": "sql" if filename.lower().endswith(".sql") else "sqlite",
            }
            self._local_files.append(file_entry)
            self._save_local_config()
            self._refresh_local_files()
            QMessageBox.information(self, "✅", tr("local.db_copied"))

    def _create_new_db(self):
        """Yeni bir boş SQLite veritabanı oluştur."""
        db_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "database")
        if not os.path.exists(db_dir):
            os.makedirs(db_dir, exist_ok=True)

        filepath, _ = QFileDialog.getSaveFileName(
            self,
            tr("local.select_save_location"),
            os.path.join(db_dir, "remalab_local.db"),
            "SQLite Database (*.db);;All Files (*.*)",
        )
        if filepath:
            if not filepath.endswith(".db"):
                filepath += ".db"

            try:
                # Boş SQLite veritabanı oluştur
                conn = sqlite3.connect(filepath)
                conn.execute(
                    "CREATE TABLE IF NOT EXISTS _remalab_meta ("
                    "key TEXT PRIMARY KEY, value TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
                )
                conn.execute(
                    "INSERT OR REPLACE INTO _remalab_meta (key, value) "
                    "VALUES ('version', '1.0'), ('created_by', 'RemaLab WMS')"
                )
                conn.commit()
                conn.close()

                name = os.path.splitext(os.path.basename(filepath))[0]
                file_entry = {
                    "id": str(uuid.uuid4())[:8],
                    "name": name,
                    "path": filepath,
                    "type": "sqlite",
                }
                self._local_files.append(file_entry)
                self._save_local_config()
                self._refresh_local_files()
                QMessageBox.information(self, "✅", tr("local.db_created"))
            except Exception as e:
                QMessageBox.critical(self, "❌", f"Hata: {str(e)[:200]}")

    def _remove_local_file(self, file_id: str):
        """Dosyayı listeden kaldır (dosya silinmez)."""
        reply = QMessageBox.question(
            self,
            tr("local.remove"),
            tr("local.confirm_remove"),
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No,
        )
        if reply == QMessageBox.Yes:
            self._local_files = [f for f in self._local_files if f.get("id") != file_id]
            self._save_local_config()
            self._refresh_local_files()

    def _open_file_location(self, filepath: str):
        """Dosyanın bulunduğu klasörü aç."""
        folder = os.path.dirname(filepath)
        if os.path.exists(folder):
            os.startfile(folder)
        else:
            QMessageBox.warning(self, "⚠️", tr("local.file_not_found"))

    def _export_db_file(self, filepath: str):
        """Veritabanı dosyasını başka bir konuma kopyala."""
        if not os.path.exists(filepath):
            QMessageBox.warning(self, "⚠️", tr("local.file_not_found"))
            return

        dest, _ = QFileDialog.getSaveFileName(
            self,
            tr("local.export_db"),
            os.path.basename(filepath),
            "Database Files (*.db);;All Files (*.*)",
        )
        if dest:
            import shutil

            try:
                shutil.copy2(filepath, dest)
                QMessageBox.information(self, "✅", f"Dışa aktarıldı: {dest}")
            except Exception as e:
                QMessageBox.critical(self, "❌", f"Hata: {str(e)[:200]}")

    def _add_data_folder(self):
        """Veri klasörü ekle."""
        folder = QFileDialog.getExistingDirectory(
            self, tr("local.select_data_folder"), ""
        )
        if folder:
            if any(f.get("path") == folder for f in self._data_folders):
                QMessageBox.information(self, "ℹ️", "Bu klasör zaten ekli.")
                return

            # Tür seçimi
            folder_name = os.path.basename(folder) or folder
            folder_entry = {
                "id": str(uuid.uuid4())[:8],
                "name": folder_name,
                "path": folder,
                "type": "data",
            }

            # Klasör adına göre tür belirleme
            name_lower = folder_name.lower()
            if "backup" in name_lower or "yedek" in name_lower:
                folder_entry["type"] = "backup"
            elif "export" in name_lower or "disa" in name_lower:
                folder_entry["type"] = "export"
            elif "import" in name_lower or "ice" in name_lower:
                folder_entry["type"] = "import"

            self._data_folders.append(folder_entry)
            self._save_local_config()
            self._refresh_folders()

    def _remove_folder(self, folder_id: str):
        """Klasörü listeden kaldır."""
        reply = QMessageBox.question(
            self,
            tr("local.remove"),
            tr("local.confirm_remove"),
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No,
        )
        if reply == QMessageBox.Yes:
            self._data_folders = [
                f for f in self._data_folders if f.get("id") != folder_id
            ]
            self._save_local_config()
            self._refresh_folders()

    def _open_folder_in_explorer(self, folder_path: str):
        """Klasörü Windows Explorer'da aç."""
        if os.path.exists(folder_path):
            os.startfile(folder_path)
        else:
            QMessageBox.warning(self, "⚠️", tr("local.file_not_found"))

    # ============================================================
    #  Dosya İşlemleri
    # ============================================================

    def _load_connections(self):
        if os.path.exists(DB_CONFIG_PATH):
            try:
                with open(DB_CONFIG_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._connections = data.get("connections", [])
                    self._active_connection_id = data.get("active_id", "")
            except (json.JSONDecodeError, IOError):
                self._connections = []
                self._active_connection_id = ""

    def _save_connections(self):
        data = {
            "connections": self._connections,
            "active_id": self._active_connection_id,
        }
        try:
            with open(DB_CONFIG_PATH, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except IOError as e:
            print(f"[ERROR] Could not save connections: {e}")

    def _load_local_config(self):
        if os.path.exists(LOCAL_CONFIG_PATH):
            try:
                with open(LOCAL_CONFIG_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._local_files = data.get("files", [])
                    self._data_folders = data.get("folders", [])
            except (json.JSONDecodeError, IOError):
                self._local_files = []
                self._data_folders = []

    def _save_local_config(self):
        data = {
            "files": self._local_files,
            "folders": self._data_folders,
        }
        try:
            with open(LOCAL_CONFIG_PATH, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except IOError as e:
            print(f"[ERROR] Could not save local config: {e}")
