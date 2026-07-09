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

from services.user_service import UserService
from services.exceptions import ServiceError
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
        btn_text = tr("common.save") if self.user_data else tr("users.register")
        save_btn = QPushButton(btn_text)
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
        self.service = UserService()
        self._setup_ui()
        self._load_data()

    def _setup_ui(self):
        layout = QVBoxLayout(self)

        # Üst Panel: Başlık ve Butonlar
        top_layout = QHBoxLayout()
        title_label = QLabel(tr("nav.users"))
        title_label

        add_btn = QPushButton(f"➕ {tr('users.add_user')}")
        add_btn.setObjectName("btn_primary")
        add_btn.setCursor(Qt.PointingHandCursor)
        add_btn.clicked.connect(self._add_user)

        edit_btn = QPushButton(f"✏️ {tr('users.edit_user')}")
        edit_btn.setObjectName("btn_success")
        edit_btn.setCursor(Qt.PointingHandCursor)
        edit_btn.clicked.connect(self._edit_user)

        delete_btn = QPushButton(f"🗑️ {tr('users.delete_user')}")
        delete_btn.setObjectName("btn_danger")
        delete_btn.setCursor(Qt.PointingHandCursor)
        delete_btn.clicked.connect(self._delete_user)

        reset_btn = QPushButton("🔑 Şifreyi Sıfırla")
        reset_btn.setObjectName("btn_warning")
        reset_btn.setCursor(Qt.PointingHandCursor)
        reset_btn.clicked.connect(self._reset_password)

        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Kullanıcı Ara...")
        self.search_input.setFixedWidth(200)
        self.search_input.textChanged.connect(self._filter_users)

        top_layout.addWidget(title_label)
        top_layout.addStretch()
        top_layout.addWidget(self.search_input)
        top_layout.addWidget(add_btn)
        top_layout.addWidget(edit_btn)
        top_layout.addWidget(reset_btn)
        top_layout.addWidget(delete_btn)

        layout.addLayout(top_layout)

        # Tablo
        self.table = QTableWidget()
        self.table.setColumnCount(4)
        self.table.setHorizontalHeaderLabels(
            ["ID", tr("users.username"), tr("users.email"), tr("users.role")]
        )
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.table.setSelectionBehavior(QTableWidget.SelectRows)
        self.table.setSelectionMode(QTableWidget.SingleSelection)
        self.table.setEditTriggers(QTableWidget.NoEditTriggers)

        layout.addWidget(self.table)

    def _load_data(self):
        self.table.setRowCount(0)
        try:
            users = self.service.list_users()
        except ServiceError as e:
            QMessageBox.critical(self, "Hata", f"Veri yüklenirken hata oluştu:\n{e}")
            return

        self.table.setRowCount(len(users))
        for row_idx, user in enumerate(users):
            id_item = QTableWidgetItem(str(user["id"]))
            id_item.setData(Qt.UserRole, user["id"])
            self.table.setItem(row_idx, 0, id_item)
            self.table.setItem(row_idx, 1, QTableWidgetItem(user["username"]))
            self.table.setItem(row_idx, 2, QTableWidgetItem(user["email"]))
            self.table.setItem(row_idx, 3, QTableWidgetItem(user["role"]))

    def _filter_users(self, text: str):
        text = text.lower()
        for row in range(self.table.rowCount()):
            username = self.table.item(row, 1).text().lower() if self.table.item(row, 1) else ""
            email = self.table.item(row, 2).text().lower() if self.table.item(row, 2) else ""
            if text in username or text in email:
                self.table.setRowHidden(row, False)
            else:
                self.table.setRowHidden(row, True)

    def _add_user(self):
        dialog = UserDialog(self)
        if dialog.exec():
            data = dialog.get_data()
            try:
                self.service.add_user(
                    data["username"], data["email"], data["password"], data["role"]
                )
                self._load_data()
            except ServiceError as e:
                QMessageBox.critical(
                    self, "Hata", f"Kullanıcı eklenirken hata oluştu:\n{e}"
                )

    def _edit_user(self):
        selected = self.table.selectedItems()
        if not selected:
            QMessageBox.information(
                self, "Bilgi", "Lütfen düzenlenecek kullanıcıyı seçin."
            )
            return

        row = selected[0].row()
        user_id = int(self.table.item(row, 0).data(Qt.UserRole))
        user_data = {
            "username": self.table.item(row, 1).text(),
            "email": self.table.item(row, 2).text(),
            "role": self.table.item(row, 3).text(),
        }

        dialog = UserDialog(self, user_data)
        if dialog.exec():
            data = dialog.get_data()
            try:
                self.service.update_user(
                    user_id,
                    data["username"],
                    data["email"],
                    data["role"],
                    data["password"] or None,
                )
                self._load_data()
            except ServiceError as e:
                QMessageBox.critical(
                    self, "Hata", f"Kullanıcı güncellenirken hata oluştu:\n{e}"
                )

    def _reset_password(self):
        selected = self.table.selectedItems()
        if not selected:
            QMessageBox.information(
                self, "Bilgi", "Lütfen şifresi sıfırlanacak kullanıcıyı seçin."
            )
            return

        row = selected[0].row()
        user_id = int(self.table.item(row, 0).data(Qt.UserRole))
        username = self.table.item(row, 1).text()

        new_password, ok = QInputDialog.getText(
            self,
            "Şifreyi Sıfırla",
            f"'{username}' kullanıcısı için yeni şifreyi girin:",
            QLineEdit.Password
        )

        if ok and new_password:
            try:
                self.service.reset_password(user_id, new_password)
                QMessageBox.information(self, "Başarılı", f"'{username}' kullanıcısının şifresi başarıyla sıfırlandı!")
            except ServiceError as e:
                QMessageBox.critical(self, "Hata", f"Şifre sıfırlanırken hata oluştu:\n{e}")

    def _delete_user(self):
        selected = self.table.selectedItems()
        if not selected:
            QMessageBox.information(
                self, "Bilgi", "Lütfen silinecek kullanıcıyı seçin."
            )
            return

        row = selected[0].row()
        user_id = int(self.table.item(row, 0).data(Qt.UserRole))
        username = self.table.item(row, 1).text()

        reply = QMessageBox.question(
            self,
            "Onay",
            f"'{username}' kullanıcısını silmek istediğinize emin misiniz?",
            QMessageBox.Yes | QMessageBox.No,
        )
        if reply == QMessageBox.Yes:
            try:
                self.service.delete_user(user_id)
                self._load_data()
            except ServiceError as e:
                QMessageBox.critical(
                    self, "Hata", f"Kullanıcı silinirken hata oluştu:\n{e}"
                )
