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


class AddPartDialog(QDialog):
    """Yeni parça ekleme diyaloğu."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle(tr("parts.add_new"))
        self.setMinimumWidth(350)

        layout = QVBoxLayout(self)

        lbl = QLabel(tr("parts.part_name"))
        layout.addWidget(lbl)

        self.name_input = QLineEdit()
        layout.addWidget(self.name_input)

        from config.session import SessionManager
        self.is_admin = SessionManager().role == "Admin"

        if self.is_admin:
            limit_lbl = QLabel("Kritik Stok Sınırı (Varsayılan: 10)")
            layout.addWidget(limit_lbl)
            from PySide6.QtWidgets import QSpinBox
            self.limit_input = QSpinBox()
            self.limit_input.setRange(0, 10000)
            self.limit_input.setValue(10)
            layout.addWidget(self.limit_input)

        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel, self)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)

        # Stil
        buttons.button(QDialogButtonBox.Ok).setText(tr("db.save"))
        buttons.button(QDialogButtonBox.Cancel).setText(tr("db.cancel"))

        layout.addWidget(buttons)


class PartsPage(QWidget):
    """Parçalar modülü."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._current_page = 1
        self._page_size = 50
        self._total_pages = 1
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
        self._table.setColumnCount(4)
        self._table.setAlternatingRowColors(True)
        self._table.verticalHeader().setVisible(False)
        self._table.setSelectionBehavior(QTableWidget.SelectRows)

        self._table.horizontalHeader().setSectionResizeMode(
            0, QHeaderView.ResizeToContents
        )
        self._table.horizontalHeader().setSectionResizeMode(1, QHeaderView.Stretch)
        self._table.horizontalHeader().setSectionResizeMode(
            2, QHeaderView.ResizeToContents
        )
        self._table.horizontalHeader().setSectionResizeMode(
            3, QHeaderView.ResizeToContents
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
            [tr("table.part_id"), tr("parts.part_name"), "Kritik Sınır", "İşlemler"]
        )

    def _load_parts(self):
        """PostgreSQL'den parçaları listeler."""
        self._table.blockSignals(True)
        self._update_headers()
        self._table.clearContents()

        search_query = self._search_input.text().strip()

        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                sql = "SELECT id, name, critical_limit FROM warehouse.parts"
                count_sql = "SELECT COUNT(*) FROM warehouse.parts"
                params = {}
                if search_query:
                    where_clause = " WHERE name ILIKE :search OR CAST(id AS VARCHAR) ILIKE :search"
                    sql += where_clause
                    count_sql += where_clause
                    params["search"] = f"%{search_query}%"

                # Toplam kayıt sayısı ve sayfa hesaplama
                total_records = db.execute(text(count_sql), params).scalar() or 0
                import math

                self._total_pages = (
                    math.ceil(total_records / self._page_size)
                    if total_records > 0
                    else 1
                )

                # Geçerli sayfa kontrolü
                if self._current_page > self._total_pages:
                    self._current_page = self._total_pages

                sql += " ORDER BY id DESC LIMIT :limit OFFSET :offset;"
                params["limit"] = self._page_size
                params["offset"] = (self._current_page - 1) * self._page_size

                self._page_info_lbl.setText(
                    f"Sayfa {self._current_page} / {self._total_pages} ({total_records} Kayıt)"
                )
                self._prev_btn.setEnabled(self._current_page > 1)
                self._next_btn.setEnabled(self._current_page < self._total_pages)

                rows = db.execute(text(sql), params).fetchall()
                self._table.setRowCount(len(rows))

                for r_idx, row in enumerate(rows):
                    id_item = QTableWidgetItem(str(row[0]))
                    id_item.setFlags(id_item.flags() & ~Qt.ItemIsEditable)

                    name_item = QTableWidgetItem(str(row[1]))
                    name_item.setFlags(name_item.flags() & ~Qt.ItemIsEditable)
                    name_item.setData(Qt.UserRole, row[0])

                    limit_item = QTableWidgetItem(str(row[2]) if row[2] is not None else "10")
                    limit_item.setFlags(limit_item.flags() & ~Qt.ItemIsEditable)

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
                            lambda checked, pid=row[0], pname=row[1], plimit=row[2]: self._edit_part(
                                pid, pname, plimit
                            )
                        )
                        action_layout.addWidget(edit_btn)

                    # Sil butonu
                    import os
                    from PySide6.QtGui import QIcon
                    from PySide6.QtCore import QSize

                    del_btn = QPushButton()
                    icon_path = os.path.join(
                        os.path.dirname(os.path.dirname(__file__)),
                        "assets",
                        "trash.svg",
                    )
                    if os.path.exists(icon_path):
                        del_btn.setIcon(QIcon(icon_path))
                        del_btn.setIconSize(QSize(20, 20))
                    else:
                        del_btn.setText("🗑️")
                    del_btn.setObjectName("table_delete_btn")
                    del_btn.setCursor(Qt.PointingHandCursor)
                    del_btn.clicked.connect(
                        lambda checked, p_id=row[0]: self._delete_part(p_id)
                    )
                    action_layout.addWidget(del_btn)

                    action_widget = QWidget()
                    action_widget.setLayout(action_layout)

                    self._table.setItem(r_idx, 0, id_item)
                    self._table.setItem(r_idx, 1, name_item)
                    self._table.setItem(r_idx, 2, limit_item)
                    self._table.setCellWidget(r_idx, 3, action_widget)
                    self._table.setRowHeight(r_idx, 44)
            finally:
                db.close()
        except Exception as e:
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
                from config.database import SessionLocal
                from sqlalchemy import text

                db = SessionLocal()
                try:
                    critical_limit = 10
                    if getattr(dialog, "is_admin", False):
                        critical_limit = dialog.limit_input.value()
                        
                    db.execute(
                        text("INSERT INTO warehouse.parts (name, critical_limit) VALUES (:name, :critical_limit);"),
                        {"name": name, "critical_limit": critical_limit},
                    )
                    db.commit()
                finally:
                    db.close()
                self._load_parts()
            except Exception as e:
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
                from config.database import SessionLocal
                from sqlalchemy import text

                db = SessionLocal()
                try:
                    db.execute(
                        text("DELETE FROM warehouse.parts WHERE id = :id;"),
                        {"id": part_id},
                    )
                    db.commit()
                finally:
                    db.close()
                self._load_parts()
            except Exception as e:
                QMessageBox.critical(self, "Hata", f"Parça silinemedi: {e}")

    def _edit_part(self, part_id: int, current_name: str, current_limit: int):
        from config.session import SessionManager
        is_admin = SessionManager().role == "Admin"

        dialog = QDialog(self)
        dialog.setWindowTitle("Düzenle")
        dialog.setMinimumWidth(350)
        
        layout = QVBoxLayout(dialog)
        
        layout.addWidget(QLabel("Yeni parça adını girin:"))
        name_input = QLineEdit()
        name_input.setText(current_name)
        layout.addWidget(name_input)
        
        limit_input = None
        if is_admin:
            layout.addWidget(QLabel("Kritik Stok Sınırı:"))
            from PySide6.QtWidgets import QSpinBox
            limit_input = QSpinBox()
            limit_input.setRange(0, 10000)
            limit_input.setValue(current_limit if current_limit is not None else 10)
            layout.addWidget(limit_input)
            
        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel, dialog)
        buttons.accepted.connect(dialog.accept)
        buttons.rejected.connect(dialog.reject)
        layout.addWidget(buttons)

        if dialog.exec() == QDialog.Accepted:
            new_name = name_input.text().strip()
            if not new_name:
                return
            
            try:
                from config.database import SessionLocal
                from sqlalchemy import text

                db = SessionLocal()
                try:
                    if is_admin and limit_input:
                        new_limit = limit_input.value()
                        db.execute(
                            text("UPDATE warehouse.parts SET name = :name, critical_limit = :critical_limit WHERE id = :id;"),
                            {"name": new_name, "critical_limit": new_limit, "id": part_id},
                        )
                    else:
                        db.execute(
                            text("UPDATE warehouse.parts SET name = :name WHERE id = :id;"),
                            {"name": new_name, "id": part_id},
                        )
                    db.commit()
                finally:
                    db.close()
                self._load_parts()
            except Exception as e:
                QMessageBox.critical(self, "Hata", f"Parça güncellenemedi: {e}")

    def _retranslate(self):
        """Dil değiştiğinde çevirileri yeniler."""
        self._title_lbl.setText(tr("parts.title"))
        self._subtitle_lbl.setText(tr("parts.subtitle"))
        self._add_btn.setText(tr("parts.add_new"))
        self._search_input.setPlaceholderText(tr("parts.search_placeholder"))
        self._load_parts()
