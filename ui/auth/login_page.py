from PySide6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QCheckBox,
    QFrame,
    QApplication,
    QGraphicsDropShadowEffect,
    QMessageBox,
)
from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QCursor, QColor, QPainter, QLinearGradient, QPixmap
import sys
import os
from config.database import engine
from sqlalchemy import text
from config.auth import verify_password, create_access_token
from config.session import SessionManager


class LoginPage(QWidget):
    login_successful = Signal()

    def __init__(self):
        super().__init__()
        self.setWindowTitle("RemaLab - Akıllı Depo Sistemi")
        self.resize(1100, 700)
        self.setup_ui()

    def paintEvent(self, event):
        painter = QPainter(self)
        gradient = QLinearGradient(0, 0, self.width(), self.height())
        gradient.setColorAt(0.0, QColor("#F8FAFD"))
        gradient.setColorAt(1.0, QColor("#EBF0F8"))
        painter.fillRect(self.rect(), gradient)

    def setup_ui(self):
        main_layout = QHBoxLayout(self)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        # Center Container (Glassmorphism look)
        center_widget = QWidget()
        center_layout = QHBoxLayout(center_widget)
        center_layout.setContentsMargins(0, 0, 0, 0)
        center_layout.setSpacing(0)

        # Glass panel
        glass_panel = QFrame()
        glass_panel.setFixedSize(900, 550)
        glass_panel.setStyleSheet("""
            QFrame {
                background-color: rgba(255, 255, 255, 0.5);
                border-radius: 24px;
                border: 1px solid rgba(255, 255, 255, 0.8);
            }
        """)

        # Add shadow
        shadow = QGraphicsDropShadowEffect(self)
        shadow.setBlurRadius(30)
        shadow.setColor(QColor(0, 0, 0, 80))
        shadow.setOffset(0, 10)
        glass_panel.setGraphicsEffect(shadow)

        glass_layout = QHBoxLayout(glass_panel)
        glass_layout.setContentsMargins(0, 0, 0, 0)
        glass_layout.setSpacing(0)

        # Left Side: Graphic / Branding
        left_frame = QFrame()
        left_frame.setStyleSheet("""
            QFrame {
                background-color: transparent;
                border-top-left-radius: 20px;
                border-bottom-left-radius: 20px;
                border-right: 1px solid rgba(255, 255, 255, 0.2);
            }
        """)
        left_layout = QVBoxLayout(left_frame)
        left_layout.setContentsMargins(50, 50, 50, 50)

        # Logo
        logo_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "assets", "logo.png")
        self.logo_lbl = QLabel()
        self.logo_lbl.setStyleSheet("background: transparent; border: none;")
        if os.path.exists(logo_path):
            pixmap = QPixmap(logo_path)
            pixmap = pixmap.scaledToWidth(250, Qt.SmoothTransformation)
            self.logo_lbl.setPixmap(pixmap)
        else:
            # Fallback if logo not found
            self.logo_lbl.setText("REMALAB")
            self.logo_lbl.setStyleSheet(
                "color: #243B7A; font-size: 56px; font-weight: 900; font-family: 'Segoe UI Black'; letter-spacing: 3px; border: none; background: transparent;"
            )

        sub_lbl = QLabel("Geleceğin Depo\nYönetim Sistemi")
        sub_lbl.setStyleSheet(
            "color: #4F6CB3; font-size: 24px; font-weight: 400; font-family: 'Segoe UI'; border: none; background: transparent;"
        )

        desc_lbl = QLabel(
            "Tüm stok hareketlerinizi saniyeler\niçinde yönetin, izleyin ve analiz edin."
        )
        desc_lbl.setStyleSheet(
            "color: #4F6CB3; font-size: 14px; font-family: 'Segoe UI'; border: none; background: transparent;"
        )

        left_layout.addWidget(self.logo_lbl)
        left_layout.addSpacing(10)
        left_layout.addWidget(sub_lbl)
        left_layout.addSpacing(20)
        left_layout.addWidget(desc_lbl)
        left_layout.addStretch()

        # Right Side: Form
        right_frame = QFrame()
        right_frame.setStyleSheet("""
            QFrame {
                background-color: #FFFFFF;
                border-top-right-radius: 24px;
                border-bottom-right-radius: 24px;
                border: none;
            }
        """)
        right_layout = QVBoxLayout(right_frame)
        right_layout.setContentsMargins(60, 60, 60, 60)
        right_layout.setAlignment(Qt.AlignCenter)

        form_layout = QVBoxLayout()
        form_layout.setSpacing(25)

        welcome_lbl = QLabel("Giriş Yap")
        welcome_lbl.setStyleSheet(
            "color: #243B7A; font-size: 32px; font-weight: 800; font-family: 'Segoe UI'; background: transparent;"
        )
        welcome_lbl.setAlignment(Qt.AlignCenter)

        self.username_input = QLineEdit()
        self.username_input.setPlaceholderText("Kullanıcı Adı")
        self.username_input.setFixedHeight(50)
        self.username_input.setStyleSheet("""
            QLineEdit {
                border: 2px solid #D8E2F0;
                border-radius: 14px;
                padding: 0 20px;
                font-size: 15px;
                color: #1B2338;
                background-color: #F8FAFD;
                font-weight: 500;
            }
            QLineEdit:hover {
                background-color: #FFFFFF;
                border: 2px solid #4F6CB3;
            }
            QLineEdit:focus {
                border: 2px solid #4FA3FF;
                background-color: #FFFFFF;
            }
        """)

        self.password_input = QLineEdit()
        self.password_input.setPlaceholderText("Şifre")
        self.password_input.setEchoMode(QLineEdit.Password)
        self.password_input.setFixedHeight(50)
        self.password_input.setStyleSheet("""
            QLineEdit {
                border: 2px solid #D8E2F0;
                border-radius: 14px;
                padding: 0 45px 0 20px;
                font-size: 15px;
                color: #1B2338;
                background-color: #F8FAFD;
                font-weight: 500;
            }
            QLineEdit:hover {
                background-color: #FFFFFF;
                border: 2px solid #4F6CB3;
            }
            QLineEdit:focus {
                border: 2px solid #4FA3FF;
                background-color: #FFFFFF;
            }
        """)
        
        # Şifre gizle/göster butonu - Input'un içine ekleniyor
        self.pwd_toggle_btn = QPushButton("🙈", self.password_input)
        self.pwd_toggle_btn.setFixedSize(24, 24)
        self.pwd_toggle_btn.setCursor(QCursor(Qt.PointingHandCursor))
        self.pwd_toggle_btn.setStyleSheet("""
            QPushButton {
                background-color: transparent;
                border: none;
                font-size: 14px;
                color: #4F6CB3;
                padding: 0px;
                outline: none;
            }
            QPushButton:hover {
                color: #4FA3FF;
            }
        """)
        self.pwd_toggle_btn.setCheckable(True)
        self.pwd_toggle_btn.toggled.connect(self._toggle_password)
        
        pwd_layout = QHBoxLayout(self.password_input)
        pwd_layout.setContentsMargins(0, 0, 10, 0)
        pwd_layout.addWidget(self.pwd_toggle_btn, 0, Qt.AlignRight | Qt.AlignVCenter)
        
        # Enter tuşu ile giriş
        self.username_input.returnPressed.connect(self.handle_login)
        self.password_input.returnPressed.connect(self.handle_login)

        self.remember_cb = QCheckBox("Beni hatırla")
        self.remember_cb.setCursor(QCursor(Qt.PointingHandCursor))
        self.remember_cb.setStyleSheet("""
            QCheckBox {
                color: #1B2338;
                font-size: 14px;
                font-weight: 600;
                font-family: 'Segoe UI';
                background: transparent;
            }
            QCheckBox::indicator {
                width: 20px;
                height: 20px;
                border-radius: 6px;
                border: 2px solid #4F6CB3;
                background-color: #F8FAFD;
            }
            QCheckBox::indicator:checked {
                background-color: transparent;
                border: 2px solid #243B7A;
                image: url(assets/check.svg);
            }
        """)

        self.login_btn = QPushButton("Giriş Yap")
        self.login_btn.setFixedHeight(55)
        self.login_btn.setCursor(QCursor(Qt.PointingHandCursor))
        self.login_btn.setStyleSheet("""
            QPushButton {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #243B7A, stop:1 #4F6CB3);
                color: white;
                border: none;
                border-radius: 14px;
                font-size: 18px;
                font-weight: bold;
                font-family: 'Segoe UI';
                letter-spacing: 1px;
            }
            QPushButton:hover {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #4F6CB3, stop:1 #4FA3FF);
            }
            QPushButton:pressed {
                background: #182956;
            }
        """)
        self.login_btn.clicked.connect(self.handle_login)

        form_layout.addWidget(welcome_lbl)
        form_layout.addSpacing(10)
        form_layout.addWidget(self.username_input)
        form_layout.addWidget(self.password_input)
        form_layout.addWidget(self.remember_cb)
        form_layout.addSpacing(10)
        form_layout.addWidget(self.login_btn)

        right_layout.addLayout(form_layout)

        glass_layout.addWidget(left_frame, 1)
        glass_layout.addWidget(right_frame, 1)

        # Center the glass panel
        wrapper_layout = QVBoxLayout()
        wrapper_layout.setAlignment(Qt.AlignCenter)
        wrapper_layout.addWidget(glass_panel)
        main_layout.addLayout(wrapper_layout)

    def _toggle_password(self, checked):
        if checked:
            self.password_input.setEchoMode(QLineEdit.Normal)
            self.pwd_toggle_btn.setText("👁") # Şifre görünür -> açık göz
        else:
            self.password_input.setEchoMode(QLineEdit.Password)
            self.pwd_toggle_btn.setText("🙈") # Şifre gizli -> maymun

    def handle_login(self):
        username = self.username_input.text().strip()
        password = self.password_input.text().strip()

        if not username or not password:
            QMessageBox.warning(self, "Hata", "Lütfen tüm alanları doldurun.")
            return

        # DUMMY BYPASS: DB yoksa bile "admin" / "admin123" girmesini sağlar.
        if username == "admin" and password == "admin123":
            try:
                with engine.connect() as conn:
                    result = conn.execute(
                        text(
                            "SELECT id, username, password_hash, role FROM warehouse.users WHERE username = :username"
                        ),
                        {"username": username},
                    ).fetchone()
                    if result:
                        user_id, db_username, password_hash, role = result
                        if verify_password(password, password_hash):
                            self._do_login(db_username, user_id, role)
                            return
                        else:
                            QMessageBox.warning(self, "Hata", "Geçersiz şifre.")
                            return
            except Exception:
                # DB yok, offline moda geçir
                self._do_login("admin", 1, "Admin")
                return

        # Normal Flow
        try:
            with engine.connect() as conn:
                result = conn.execute(
                    text(
                        "SELECT id, username, password_hash, role FROM warehouse.users WHERE username = :username"
                    ),
                    {"username": username},
                ).fetchone()

                if result:
                    user_id, db_username, password_hash, role = result
                    if verify_password(password, password_hash):
                        self._do_login(db_username, user_id, role)
                    else:
                        QMessageBox.warning(self, "Hata", "Geçersiz şifre.")
                else:
                    QMessageBox.warning(self, "Hata", "Kullanıcı bulunamadı.")
        except Exception as e:
            QMessageBox.critical(
                self,
                "Hata",
                f"Veritabanı hatası!\nPostgreSQL sunucusunun çalıştığından emin olun.\nDetay: {str(e)}",
            )

    def _do_login(self, username, user_id, role):
        payload = {"sub": username, "user_id": user_id, "role": role}
        token = create_access_token(payload)
        remember = self.remember_cb.isChecked()
        SessionManager().set_session(token, payload, remember=remember)
        
        # Load user's theme preference
        from ui.theme_manager import get_theme_manager
        get_theme_manager().load_user_theme(username)
        
        self.login_successful.emit()


if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = LoginPage()
    window.show()
    sys.exit(app.exec())
