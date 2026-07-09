"""
RemaLab WMS - Locations Page
Depo lokasyonlarının (rafların, bölgelerin) eklenmesi, silinmesi ve listelenmesi.
"""

from PySide6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QTableWidget,
    QTableWidgetItem,
    QLineEdit,
    QPushButton,
    QHeaderView,
    QMessageBox,
    QDialog,
    QDialogButtonBox,
)
from PySide6.QtCore import Qt
from ui.translations import tr, get_translator
from services.location_service import LocationService
from services.exceptions import ServiceError


class AddLocationDialog(QDialog):
    """Yeni lokasyon ekleme diyaloğu."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle(tr("locations.add_new"))
        self.setMinimumWidth(350)
        self

        layout = QVBoxLayout(self)

        lbl = QLabel(tr("locations.location_name"))
        lbl
        layout.addWidget(lbl)

        self.name_input = QLineEdit()
        self.name_input.setPlaceholderText("Örn: A-12-03")
        self.name_input
        layout.addWidget(self.name_input)

        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel, self)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)

        buttons.button(QDialogButtonBox.Ok).setText(tr("db.save"))
        buttons.button(QDialogButtonBox.Ok)
        buttons.button(QDialogButtonBox.Cancel).setText(tr("db.cancel"))
        buttons.button(QDialogButtonBox.Cancel)

        layout.addWidget(buttons)


class LocationsPage(QWidget):
    """Lokasyonlar (Raf) modülü."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.service = LocationService()
        self._setup_ui()
        get_translator().language_changed.connect(self._retranslate)

    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(28, 28, 28, 28)
        layout.setSpacing(16)

        # Üst Bilgiler
        header_layout = QHBoxLayout()
        title_section = QWidget()
        title_layout = QVBoxLayout(title_section)
        title_layout.setContentsMargins(0, 0, 0, 0)
        title_layout.setSpacing(4)

        self._title_lbl = QLabel(tr("locations.title"))
        self._title_lbl
        title_layout.addWidget(self._title_lbl)

        self._subtitle_lbl = QLabel(tr("locations.subtitle"))
        self._subtitle_lbl
        title_layout.addWidget(self._subtitle_lbl)

        header_layout.addWidget(title_section)
        header_layout.addStretch()

        # Ekleme butonu
        self._add_btn = QPushButton(f"➕ {tr('locations.add_new')}")
        self._add_btn.setObjectName("btn_success")
        self._add_btn.setCursor(Qt.PointingHandCursor)
        self._add_btn.clicked.connect(self._add_location)
        header_layout.addWidget(self._add_btn)

        layout.addLayout(header_layout)

        # Arama çubuğu
        self._search_input = QLineEdit()
        self._search_input.setPlaceholderText(tr("locations.search_placeholder"))
        self._search_input
        self._search_input.textChanged.connect(self._load_locations)
        layout.addWidget(self._search_input)

        # Lokasyonlar Tablosu
        self._table = QTableWidget()
        self._table.setColumnCount(3)
        self._table.setAlternatingRowColors(True)
        self._table.verticalHeader().setVisible(False)
        self._table.setSelectionBehavior(QTableWidget.SelectRows)
        self._table.setEditTriggers(QTableWidget.NoEditTriggers)

        self._table.horizontalHeader().setSectionResizeMode(
            0, QHeaderView.ResizeToContents
        )
        self._table.horizontalHeader().setSectionResizeMode(1, QHeaderView.Stretch)
        self._table.horizontalHeader().setSectionResizeMode(
            2, QHeaderView.ResizeToContents
        )

        layout.addWidget(self._table)

        self._load_locations()

    def _update_headers(self):
        self._table.setHorizontalHeaderLabels(
            [tr("table.location_id"), tr("locations.location_name"), tr("db.delete")]
        )

    def _load_locations(self):
        """PostgreSQL'den lokasyonları listeler."""
        self._table.blockSignals(True)
        self._update_headers()
        self._table.clearContents()

        search_query = self._search_input.text().strip()

        try:
            locations = self.service.list_locations(search=search_query or None)
            self._table.setRowCount(len(locations))

            for r_idx, location in enumerate(locations):
                id_item = QTableWidgetItem(str(location["id"]))
                id_item.setFlags(id_item.flags() & ~Qt.ItemIsEditable)

                name_item = QTableWidgetItem(location["name"])
                name_item.setData(Qt.UserRole, location["id"])

                # İşlemler Butonları
                from config.session import SessionManager

                user_role = SessionManager().role

                action_layout = QHBoxLayout()
                action_layout.setContentsMargins(0, 0, 0, 0)
                action_layout.setSpacing(4)
                action_layout.setAlignment(Qt.AlignCenter)

                if user_role in ["Admin", "Depo Müdürü"]:
                    edit_btn = QPushButton("✏️")
                    edit_btn.setObjectName("table_delete_btn")
                    edit_btn.setCursor(Qt.PointingHandCursor)
                    edit_btn.clicked.connect(
                        lambda checked, lid=location["id"], lname=location[
                            "name"
                        ]: self._edit_location(lid, lname)
                    )
                    action_layout.addWidget(edit_btn)

                # Sil butonu
                del_btn = QPushButton()
                del_btn.setObjectName("table_delete_btn")
                import os
                from PySide6.QtGui import QIcon

                trash_path = os.path.join(
                    os.path.dirname(os.path.dirname(__file__)), "assets", "trash.svg"
                )
                if os.path.exists(trash_path):
                    del_btn.setIcon(QIcon(trash_path))
                else:
                    del_btn.setText("🗑️")
                del_btn.setCursor(Qt.PointingHandCursor)
                del_btn.clicked.connect(
                    lambda checked, l_id=location["id"]: self._delete_location(l_id)
                )
                action_layout.addWidget(del_btn)

                action_widget = QWidget()
                action_widget.setLayout(action_layout)

                self._table.setItem(r_idx, 0, id_item)
                self._table.setItem(r_idx, 1, name_item)
                self._table.setCellWidget(r_idx, 2, action_widget)
                self._table.setRowHeight(r_idx, 44)
        except ServiceError as e:
            print(f"[Error Loading Locations] {e}")
        finally:
            self._table.blockSignals(False)

    def _add_location(self):
        """Yeni lokasyon ekleme."""
        dialog = AddLocationDialog(self)
        if dialog.exec() == QDialog.Accepted:
            name = dialog.name_input.text().strip()
            if not name:
                return

            try:
                self.service.add_location(name)
                self._load_locations()
            except ServiceError as e:
                QMessageBox.critical(self, "Hata", f"Lokasyon eklenemedi: {e}")

    def _delete_location(self, loc_id: int):
        """Lokasyon silme."""
        reply = QMessageBox.question(
            self,
            tr("db.delete"),
            tr("locations.confirm_delete"),
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No,
        )
        if reply == QMessageBox.Yes:
            try:
                self.service.delete_location(loc_id)
                self._load_locations()
            except ServiceError as e:
                QMessageBox.critical(self, "Hata", f"Lokasyon silinemedi: {e}")

    def _edit_location(self, loc_id: int, current_name: str):
        """Lokasyon adını pop-up ile günceller."""
        from PySide6.QtWidgets import QInputDialog

        new_name, ok = QInputDialog.getText(
            self,
            "Lokasyon Düzenle",
            "Yeni lokasyon adını girin:",
            QLineEdit.Normal,
            current_name,
        )
        if ok and new_name.strip():
            try:
                self.service.update_name(loc_id, new_name.strip())
                self._load_locations()
            except ServiceError as e:
                QMessageBox.critical(self, "Hata", f"Güncelleme başarısız: {e}")

    def _retranslate(self):
        """Dil değiştiğinde metinleri günceller."""
        self._title_lbl.setText(tr("locations.title"))
        self._subtitle_lbl.setText(tr("locations.subtitle"))
        self._add_btn.setText(tr("locations.add_new"))
        self._search_input.setPlaceholderText(tr("locations.search_placeholder"))
        self._load_locations()
