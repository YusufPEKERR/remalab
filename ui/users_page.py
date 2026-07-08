"""
RemaLab WMS - Users Page
Kullanıcı yönetimi modülü.
"""

from PySide6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QHeaderView,
    QMessageBox,
    QDialog,
    QFormLayout,
    QLineEdit,
    QComboBox,
    QLabel,
    QInputDialog,
)
from PySide6.QtCore import Qt
from sqlalchemy import text

from config.database import SessionLocal
from config.auth import get_password_hash
from ui.translations import tr


class UserDialog(QDialog):
    def __init__(self, parent=None, user_data=None):
        super().__init__(parent)
        self.user_data = user_data
        self.setWindowTitle(
            tr("users.edit_user") if user_data else tr("users.add_user")
        )
        self.resize(400, 250)
        self._setup_ui()

    def _setup_ui(self):
        layout = QVBoxLayout(self)

        form_layout = QFormLayout()

        self.username_input = QLineEdit()
        self.email_input = QLineEdit()
        self.password_input = QLineEdit()
        self.password_input.setEchoMode(QLineEdit.Password)
        self.password_input.setPlaceholderText(
            tr("users.password_placeholder") if self.user_data else ""
        )

        self.role_combo = QComboBox()
        self.role_combo.addItems(["Admin", "Depo Müdürü", "Depo", "Teknisyen"])

        form_layout.addRow(tr("users.username") + ":", self.username_input)
        form_layout.addRow(tr("users.email") + ":", self.email_input)
        form_layout.addRow(tr("users.password") + ":", self.password_input)
        form_layout.addRow(tr("users.role") + ":", self.role_combo)

        layout.addLayout(form_layout)

        btn_layout = QHBoxLayout()
        save_btn = QPushButton(tr("common.save"))
        save_btn.clicked.connect(self.accept)
        cancel_btn = QPushButton(tr("common.cancel"))
        cancel_btn.clicked.connect(self.reject)

        btn_layout.addStretch()
        btn_layout.addWidget(save_btn)
        btn_layout.addWidget(cancel_btn)

        layout.addLayout(btn_layout)

        if self.user_data:
            self.username_input.setText(self.user_data["username"])
            self.email_input.setText(self.user_data["email"])
            self.role_combo.setCurrentText(self.user_data["role"])

    def get_data(self):
        return {
            "username": self.username_input.text().strip(),
            "email": self.email_input.text().strip(),
            "password": self.password_input.text().strip(),
            "role": self.role_combo.currentText(),
        }


class UsersPage(QWidget):
    """Kullanıcı yönetimi sayfası."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._setup_ui()
        self._load_data()

    def _setup_ui(self):
        layout = QVBoxLayout(self)

        # Üst Panel: Başlık ve Butonlar
        top_layout = QHBoxLayout()
        title_label = QLabel(tr("nav.users"))
        title_label

        add_btn = QPushButton(tr("users.add_user"))
        add_btn
        add_btn.clicked.connect(self._add_user)

        edit_btn = QPushButton(tr("users.edit_user"))
        edit_btn
        edit_btn.clicked.connect(self._edit_user)

        delete_btn = QPushButton(tr("users.delete_user"))
        delete_btn
        delete_btn.clicked.connect(self._delete_user)

        reset_btn = QPushButton("🔑 Şifreyi Sıfırla")
        reset_btn
        reset_btn.clicked.connect(self._reset_password)

        top_layout.addWidget(title_label)
        top_layout.addStretch()
        top_layout.addWidget(add_btn)
        top_layout.addWidget(edit_btn)
        top_layout.addWidget(reset_btn)
        top_layout.addWidget(delete_btn)

        layout.addLayout(top_layout)

        # Tablo
        self.table = QTableWidget()
        self.table.setColumnCount(5)
        self.table.setHorizontalHeaderLabels(
            ["ID", tr("users.username"), tr("users.email"), "Şifre", tr("users.role")]
        )
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.table.setSelectionBehavior(QTableWidget.SelectRows)
        self.table.setSelectionMode(QTableWidget.SingleSelection)
        self.table.setEditTriggers(QTableWidget.NoEditTriggers)

        layout.addWidget(self.table)

    def _load_data(self):
        self.table.setRowCount(0)
        db = SessionLocal()
        try:
            result = db.execute(
                text(
                    "SELECT id, username, email, password_hash, role FROM warehouse.users ORDER BY id ASC"
                )
            ).fetchall()
            self.table.setRowCount(len(result))
            for row_idx, row in enumerate(result):
                self.table.setItem(row_idx, 0, QTableWidgetItem(str(row[0])))
                self.table.setItem(row_idx, 1, QTableWidgetItem(row[1]))
                self.table.setItem(row_idx, 2, QTableWidgetItem(row[2]))
                self.table.setItem(row_idx, 3, QTableWidgetItem(str(row[3])))
                self.table.setItem(row_idx, 4, QTableWidgetItem(row[4]))
        except Exception as e:
            print(f"[UsersPage] Veri yüklenemedi: {e}")
        finally:
            db.close()

    def _add_user(self):
        dialog = UserDialog(self)
        if dialog.exec():
            data = dialog.get_data()
            if not data["username"] or not data["password"]:
                QMessageBox.warning(self, "Hata", "Kullanıcı adı ve şifre zorunludur.")
                return

            pwd_hash = get_password_hash(data["password"])
            db = SessionLocal()
            try:
                db.execute(
                    text(
                        "INSERT INTO warehouse.users (username, email, password_hash, role) VALUES (:u, :e, :p, :r)"
                    ),
                    {
                        "u": data["username"],
                        "e": data["email"],
                        "p": pwd_hash,
                        "r": data["role"],
                    },
                )
                db.commit()
                self._load_data()
            except Exception as e:
                db.rollback()
                QMessageBox.critical(
                    self, "Hata", f"Kullanıcı eklenirken hata oluştu:\n{e}"
                )
            finally:
                db.close()

    def _edit_user(self):
        selected = self.table.selectedItems()
        if not selected:
            QMessageBox.information(
                self, "Bilgi", "Lütfen düzenlenecek kullanıcıyı seçin."
            )
            return

        row = selected[0].row()
        user_id = self.table.item(row, 0).text()
        user_data = {
            "username": self.table.item(row, 1).text(),
            "email": self.table.item(row, 2).text(),
            "role": self.table.item(row, 4).text(),
        }

        dialog = UserDialog(self, user_data)
        if dialog.exec():
            data = dialog.get_data()
            db = SessionLocal()
            try:
                if data["password"]:
                    pwd_hash = get_password_hash(data["password"])
                    db.execute(
                        text(
                            "UPDATE warehouse.users SET username=:u, email=:e, password_hash=:p, role=:r WHERE id=:id"
                        ),
                        {
                            "u": data["username"],
                            "e": data["email"],
                            "p": pwd_hash,
                            "r": data["role"],
                            "id": user_id,
                        },
                    )
                else:
                    db.execute(
                        text(
                            "UPDATE warehouse.users SET username=:u, email=:e, role=:r WHERE id=:id"
                        ),
                        {
                            "u": data["username"],
                            "e": data["email"],
                            "r": data["role"],
                            "id": user_id,
                        },
                    )
                db.commit()
                self._load_data()
            except Exception as e:
                db.rollback()
                QMessageBox.critical(
                    self, "Hata", f"Kullanıcı güncellenirken hata oluştu:\n{e}"
                )
            finally:
                db.close()

    def _reset_password(self):
        selected = self.table.selectedItems()
        if not selected:
            QMessageBox.information(
                self, "Bilgi", "Lütfen şifresi sıfırlanacak kullanıcıyı seçin."
            )
            return

        row = selected[0].row()
        user_id = self.table.item(row, 0).text()
        username = self.table.item(row, 1).text()

        new_password, ok = QInputDialog.getText(
            self,
            "Şifreyi Sıfırla",
            f"'{username}' kullanıcısı için yeni şifreyi girin:",
            QLineEdit.Password
        )

        if ok and new_password:
            db = SessionLocal()
            try:
                pwd_hash = get_password_hash(new_password)
                db.execute(
                    text("UPDATE warehouse.users SET password_hash=:p WHERE id=:id"),
                    {"p": pwd_hash, "id": user_id},
                )
                db.commit()
                QMessageBox.information(self, "Başarılı", f"'{username}' kullanıcısının şifresi başarıyla sıfırlandı!")
            except Exception as e:
                db.rollback()
                QMessageBox.critical(self, "Hata", f"Şifre sıfırlanırken hata oluştu:\n{e}")
            finally:
                db.close()

    def _delete_user(self):
        selected = self.table.selectedItems()
        if not selected:
            QMessageBox.information(
                self, "Bilgi", "Lütfen silinecek kullanıcıyı seçin."
            )
            return

        row = selected[0].row()
        user_id = self.table.item(row, 0).text()
        username = self.table.item(row, 1).text()

        reply = QMessageBox.question(
            self,
            "Onay",
            f"'{username}' kullanıcısını silmek istediğinize emin misiniz?",
            QMessageBox.Yes | QMessageBox.No,
        )
        if reply == QMessageBox.Yes:
            db = SessionLocal()
            try:
                db.execute(
                    text("DELETE FROM warehouse.users WHERE id=:id"), {"id": user_id}
                )
                db.commit()
                self._load_data()
            except Exception as e:
                db.rollback()
                QMessageBox.critical(
                    self, "Hata", f"Kullanıcı silinirken hata oluştu:\n{e}"
                )
            finally:
                db.close()
