"""
RemaLab WMS - Database Error Dialog
Veritabanı bağlantı hatalarında kullanıcıya seçenek sunan arayüz.
"""

import os
from PySide6.QtWidgets import (
    QDialog,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QLineEdit,
    QFormLayout,
    QMessageBox,
    QStackedWidget,
    QWidget
)
from PySide6.QtCore import Qt
from PySide6.QtGui import QFont, QIcon
import dotenv

class DatabaseErrorDialog(QDialog):
    def __init__(self, error_message: str, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Veritabanı Bağlantı Hatası")
        self.setMinimumWidth(500)
        
        self.layout = QVBoxLayout(self)
        
        self.stacked_widget = QStackedWidget(self)
        self.layout.addWidget(self.stacked_widget)
        
        # Page 1: Error Display
        self.error_page = QWidget()
        error_layout = QVBoxLayout(self.error_page)
        
        icon_label = QLabel("⚠️")
        icon_label.setFont(QFont("Segoe UI", 48))
        icon_label.setAlignment(Qt.AlignCenter)
        error_layout.addWidget(icon_label)
        
        title_label = QLabel("Veritabanı bağlantısı kurulamadı!")
        title_label.setFont(QFont("Segoe UI", 14, QFont.Bold))
        title_label.setAlignment(Qt.AlignCenter)
        error_layout.addWidget(title_label)
        
        msg_label = QLabel(str(error_message))
        msg_label.setWordWrap(True)
        msg_label.setStyleSheet("color: #da3633; margin-top: 10px; margin-bottom: 20px;")
        error_layout.addWidget(msg_label)
        
        btn_layout = QHBoxLayout()
        
        self.btn_exit = QPushButton("Çıkış")
        self.btn_exit.setObjectName("btn_danger")
        self.btn_exit.clicked.connect(self.reject)
        
        self.btn_reconnect = QPushButton("Yeniden Bağlan")
        self.btn_reconnect.setObjectName("btn_primary")
        self.btn_reconnect.clicked.connect(self.accept)
        
        self.btn_change_server = QPushButton("Sunucu Değiştir")
        self.btn_change_server.setObjectName("btn_warning")
        self.btn_change_server.clicked.connect(self.show_settings_page)
        
        btn_layout.addWidget(self.btn_exit)
        btn_layout.addWidget(self.btn_change_server)
        btn_layout.addWidget(self.btn_reconnect)
        
        error_layout.addLayout(btn_layout)
        
        # Page 2: Server Settings
        self.settings_page = QWidget()
        settings_layout = QVBoxLayout(self.settings_page)
        
        settings_title = QLabel("Veritabanı Ayarlarını Güncelle")
        settings_title.setFont(QFont("Segoe UI", 14, QFont.Bold))
        settings_layout.addWidget(settings_title)
        
        form_layout = QFormLayout()
        self.input_host = QLineEdit(os.getenv("PG_HOST", ""))
        self.input_port = QLineEdit(os.getenv("PG_PORT", "5432"))
        self.input_db = QLineEdit(os.getenv("PG_DATABASE", "remalab"))
        self.input_user = QLineEdit(os.getenv("PG_USER", ""))
        self.input_pass = QLineEdit(os.getenv("PG_PASSWORD", ""))
        self.input_pass.setEchoMode(QLineEdit.Password)
        
        form_layout.addRow("Host IP:", self.input_host)
        form_layout.addRow("Port:", self.input_port)
        form_layout.addRow("Veritabanı:", self.input_db)
        form_layout.addRow("Kullanıcı:", self.input_user)
        form_layout.addRow("Şifre:", self.input_pass)
        settings_layout.addLayout(form_layout)
        
        settings_btn_layout = QHBoxLayout()
        self.btn_cancel_settings = QPushButton("İptal")
        self.btn_cancel_settings.clicked.connect(self.show_error_page)
        
        self.btn_save_settings = QPushButton("Kaydet ve Yeniden Bağlan")
        self.btn_save_settings.setObjectName("btn_primary")
        self.btn_save_settings.clicked.connect(self.save_settings)
        
        settings_btn_layout.addWidget(self.btn_cancel_settings)
        settings_btn_layout.addWidget(self.btn_save_settings)
        settings_layout.addLayout(settings_btn_layout)
        
        self.stacked_widget.addWidget(self.error_page)
        self.stacked_widget.addWidget(self.settings_page)
        
        # Variable to check if settings were changed
        self.settings_changed = False
        
    def show_settings_page(self):
        self.stacked_widget.setCurrentWidget(self.settings_page)
        
    def show_error_page(self):
        self.stacked_widget.setCurrentWidget(self.error_page)
        
    def save_settings(self):
        env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        
        try:
            # Update .env file safely
            dotenv.set_key(env_file, "PG_HOST", self.input_host.text().strip())
            dotenv.set_key(env_file, "PG_PORT", self.input_port.text().strip())
            dotenv.set_key(env_file, "PG_DATABASE", self.input_db.text().strip())
            dotenv.set_key(env_file, "PG_USER", self.input_user.text().strip())
            dotenv.set_key(env_file, "PG_PASSWORD", self.input_pass.text().strip())
            
            # Reload env into os.environ
            dotenv.load_dotenv(env_file, override=True)
            
            self.settings_changed = True
            self.accept() # Acts like reconnect after saving
        except Exception as e:
            QMessageBox.critical(self, "Hata", f"Ayarlar kaydedilirken hata oluştu: {e}")
