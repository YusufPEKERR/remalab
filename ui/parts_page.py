"""
RemaLab WMS - Parts Page
Depodaki parçaların eklenmesi, silinmesi ve listelenmesi.
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
    QComboBox,
)
from PySide6.QtCore import Qt
from ui.translations import tr, get_translator
from services.part_service import PartService
from services.exceptions import ServiceError


class AddPartDialog(QDialog):
    """Yeni parça ekleme diyaloğu."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle(tr("parts.add_new"))
        self.setMinimumWidth(350)
        self

        layout = QVBoxLayout(self)

        lbl = QLabel(tr("parts.part_name"))
        lbl
        layout.addWidget(lbl)

        self.name_input = QLineEdit()
        self.name_input
        layout.addWidget(self.name_input)

        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel, self)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)

        # Stil
        buttons.button(QDialogButtonBox.Ok).setText(tr("db.save"))
        buttons.button(QDialogButtonBox.Ok)
        buttons.button(QDialogButtonBox.Cancel).setText(tr("db.cancel"))
        buttons.button(QDialogButtonBox.Cancel)

        layout.addWidget(buttons)


class PartsPage(QWidget):
    """Parçalar modülü."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.service = PartService()
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

        self._title_lbl = QLabel(tr("parts.title"))
        self._title_lbl
        title_layout.addWidget(self._title_lbl)

        self._subtitle_lbl = QLabel(tr("parts.subtitle"))
        self._subtitle_lbl
        title_layout.addWidget(self._subtitle_lbl)

        header_layout.addWidget(title_section)
        header_layout.addStretch()

        # Ekleme butonu
        self._add_btn = QPushButton(tr("parts.add_new"))
        self._add_btn
        self._add_btn.setCursor(Qt.PointingHandCursor)
        self._add_btn.clicked.connect(self._add_part)
        header_layout.addWidget(self._add_btn)

        layout.addLayout(header_layout)

        # Arama çubuğu
        self._search_input = QLineEdit()
        self._search_input.setPlaceholderText(tr("parts.search_placeholder"))
        self._search_input
        self._search_input.textChanged.connect(self._on_search_changed)
        layout.addWidget(self._search_input)

        # Parçalar Tablosu
        self._table = QTableWidget()
        self._table.setColumnCount(3)
        self._table.setAlternatingRowColors(True)
        self._table.verticalHeader().setVisible(False)
        self._table.setSelectionBehavior(QTableWidget.SelectRows)
        self._table

        self._table.horizontalHeader().setSectionResizeMode(
            0, QHeaderView.ResizeToContents
        )
        self._table.horizontalHeader().setSectionResizeMode(1, QHeaderView.Stretch)
        self._table.horizontalHeader().setSectionResizeMode(
            2, QHeaderView.ResizeToContents
        )

        layout.addWidget(self._table)

        # Sayfalama Kontrolleri
        pagination_layout = QHBoxLayout()
        
        size_lbl = QLabel("Sayfa Başına:")
        pagination_layout.addWidget(size_lbl)
        
        self._page_size_combo = QComboBox()
        self._page_size_combo.addItems(["5", "10", "15", "20", "25", "50"])
        self._page_size_combo.setCurrentText("50")
        self._page_size_combo.currentTextChanged.connect(self._on_page_size_changed)
        pagination_layout.addWidget(self._page_size_combo)
        
        pagination_layout.addStretch()
        
        self._prev_btn = QPushButton("⬅ Önceki")
        self._prev_btn.setCursor(Qt.PointingHandCursor)
        self._prev_btn.clicked.connect(self._prev_page)
        pagination_layout.addWidget(self._prev_btn)
        
        self._page_info_lbl = QLabel("Sayfa 1 / 1")
        pagination_layout.addWidget(self._page_info_lbl)
        
        self._next_btn = QPushButton("Sonraki ➡")
        self._next_btn.setCursor(Qt.PointingHandCursor)
        self._next_btn.clicked.connect(self._next_page)
        pagination_layout.addWidget(self._next_btn)
        
        layout.addLayout(pagination_layout)

        self._load_parts()

    def _on_search_changed(self):
        self._current_page = 1
        self._load_parts()

    def _on_page_size_changed(self, text):
        self._page_size = int(text)
        self._current_page = 1
        self._load_parts()

    def _prev_page(self):
        if self._current_page > 1:
            self._current_page -= 1
            self._load_parts()

    def _next_page(self):
        if self._current_page < self._total_pages:
            self._current_page += 1
            self._load_parts()

    def _update_headers(self):
        self._table.setHorizontalHeaderLabels(
            [tr("table.part_id"), tr("parts.part_name"), "İşlemler"]
        )

    def _load_parts(self):
        """PostgreSQL'den parçaları listeler."""
        self._table.blockSignals(True)
        self._update_headers()
        self._table.clearContents()

        search_query = self._search_input.text().strip()

        try:
            parts = self.service.list_parts(search=search_query or None)
            self._table.setRowCount(len(parts))

            for r_idx, part in enumerate(parts):
                id_item = QTableWidgetItem(str(part["id"]))
                id_item.setFlags(id_item.flags() & ~Qt.ItemIsEditable)

                name_item = QTableWidgetItem(part["name"])
                name_item.setData(Qt.UserRole, part["id"])

                # İşlemler Butonları
                from config.session import SessionManager
                user_role = SessionManager().role
                
                action_layout = QHBoxLayout()
                action_layout.setContentsMargins(0, 0, 0, 0)
                action_layout.setSpacing(4)
                action_layout.setAlignment(Qt.AlignCenter)

                if user_role in ["Admin", "Depo Müdürü"]:
                    edit_btn = QPushButton("✏️")
                    edit_btn.setObjectName("table_delete_btn") # Same transparent flat style
                    edit_btn.setCursor(Qt.PointingHandCursor)
                    edit_btn.clicked.connect(lambda checked, pid=part["id"], pname=part["name"]: self._edit_part(pid, pname))
                    action_layout.addWidget(edit_btn)

                del_btn = QPushButton()
                del_btn.setObjectName("table_delete_btn")
                import os
                from PySide6.QtGui import QIcon
                trash_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets", "trash.svg")
                if os.path.exists(trash_path):
                    del_btn.setIcon(QIcon(trash_path))
                else:
                    del_btn.setText("🗑️")
                del_btn.setCursor(Qt.PointingHandCursor)
                del_btn.clicked.connect(
                    lambda checked, p_id=part["id"]: self._delete_part(p_id)
                )
                action_layout.addWidget(del_btn)

                action_widget = QWidget()
                action_widget.setLayout(action_layout)

                self._table.setItem(r_idx, 0, id_item)
                self._table.setItem(r_idx, 1, name_item)
                self._table.setCellWidget(r_idx, 2, action_widget)
                self._table.setRowHeight(r_idx, 44)
        except ServiceError as e:
            print(f"[Error Loading Parts] {e}")
        finally:
            self._table.blockSignals(False)

    def _add_part(self):
        """Yeni parça ekleme."""
        dialog = AddPartDialog(self)
        if dialog.exec() == QDialog.Accepted:
            name = dialog.name_input.text().strip()
            if not name:
                return

            try:
                self.service.add_part(name)
                self._load_parts()
            except ServiceError as e:
                QMessageBox.critical(self, "Hata", f"Parça eklenemedi: {e}")

    def _delete_part(self, part_id: int):
        """Parça silme."""
        reply = QMessageBox.question(
            self,
            tr("db.delete"),
            tr("parts.confirm_delete"),
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No,
        )
        if reply == QMessageBox.Yes:
            try:
                self.service.delete_part(part_id)
                self._load_parts()
            except ServiceError as e:
                QMessageBox.critical(self, "Hata", f"Parça silinemedi: {e}")

    def _edit_part(self, part_id: int, current_name: str):
        from PySide6.QtWidgets import QInputDialog
        dialog = QInputDialog(self)
        dialog.setWindowTitle("Düzenle")
        dialog.setLabelText("Yeni parça adını girin:")
        dialog.setTextValue(current_name)
        
        # İçindeki yazıya göre dinamik genişlik ayarlama
        calculated_width = max(350, len(current_name) * 10 + 100)
        dialog.setMinimumWidth(calculated_width)
        dialog.resize(calculated_width, dialog.height())

        ok = dialog.exec()
        new_name = dialog.textValue()

        try:
            self.service.update_name(part_id, new_name)
        except ServiceError as e:
            QMessageBox.critical(self, "Hata", f"Güncelleme başarısız: {e}")
            self._load_parts()

    def _retranslate(self):
        """Dil değiştiğinde çevirileri yeniler."""
        self._title_lbl.setText(tr("parts.title"))
        self._subtitle_lbl.setText(tr("parts.subtitle"))
        self._add_btn.setText(tr("parts.add_new"))
        self._search_input.setPlaceholderText(tr("parts.search_placeholder"))
        self._load_parts()
