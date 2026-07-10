"""
RemaLab WMS - Suppliers Page
Tedarikçi (supplier), marka, model, ürün kodu ve barkod alanlarını listeleyip yönetmeye yarayan modül.
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
    QFormLayout,
)
from PySide6.QtCore import Qt
from ui.translations import get_translator


class AddSupplierDialog(QDialog):
    """Yeni tedarikçi-parça ilişkisi / ürün ekleme formu."""

    def __init__(self, parent=None, initial_data=None):
        super().__init__(parent)
        self.setWindowTitle(
            "Yeni Tedarikçi / Ürün Ekle"
            if not initial_data
            else "Tedarikçi / Ürün Düzenle"
        )
        self.setMinimumWidth(420)

        layout = QVBoxLayout(self)

        form = QFormLayout()
        form.setSpacing(12)

        from PySide6.QtWidgets import QComboBox, QLineEdit
        
        self.supplier_input = QLineEdit()
        self.supplier_input.setPlaceholderText("Tedarikçi Adı (örn. XYZ Elektronik)")
        form.addRow("Tedarikçi:", self.supplier_input)

        self.brand_input = QComboBox()
        self.brand_input.setEditable(False)
        self.brand_input.setPlaceholderText("Marka seçin")
        form.addRow("Marka:", self.brand_input)

        self.model_input = QComboBox()
        self.model_input.setEditable(False)
        self.model_input.setPlaceholderText("Model seçin")
        form.addRow("Model:", self.model_input)

        self.item_code_input = QComboBox()
        self.item_code_input.setEditable(False)
        self.item_code_input.setPlaceholderText("Ürün Kodu seçin")
        form.addRow("Ürün Kodu:", self.item_code_input)

        self.barcode_input = QComboBox()
        self.barcode_input.setEditable(False)
        self.barcode_input.setPlaceholderText("Barkod seçin")
        form.addRow("Barkod:", self.barcode_input)
        
        self._load_existing_data()

        layout.addLayout(form)

        if initial_data:
            self.supplier_input.setText(initial_data.get("supplier", "") or "")
            self.brand_input.setCurrentText(initial_data.get("brand", "") or "")
            self.model_input.setCurrentText(initial_data.get("model", "") or "")
            self.item_code_input.setCurrentText(initial_data.get("item_code", "") or "")
            self.barcode_input.setCurrentText(initial_data.get("barcode", "") or "")

        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel, self)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        buttons.button(QDialogButtonBox.Ok).setText("Kaydet")
        buttons.button(QDialogButtonBox.Cancel).setText("İptal")
        layout.addWidget(buttons)

    def _load_existing_data(self):
        try:
            from config.database import SessionLocal
            from sqlalchemy import text
            db = SessionLocal()
            try:
                def get_distinct(column):
                    res = db.execute(text(f"SELECT DISTINCT {column} FROM warehouse.parts WHERE {column} IS NOT NULL AND {column} != '' ORDER BY {column}"))
                    return [str(row[0]) for row in res.fetchall()]
                
                self.brand_input.addItems(get_distinct("brand"))
                self.brand_input.setCurrentIndex(-1)
                
                self.model_input.addItems(get_distinct("model"))
                self.model_input.setCurrentIndex(-1)
                
                self.item_code_input.addItems(get_distinct("item_code"))
                self.item_code_input.setCurrentIndex(-1)
                
                self.barcode_input.addItems(get_distinct("barcode"))
                self.barcode_input.setCurrentIndex(-1)
            finally:
                db.close()
        except Exception as e:
            print(f"[AddSupplierDialog] Veriler yüklenirken hata: {e}")


class SuppliersPage(QWidget):
    """Tedarikçiler modülü."""

    COLUMNS = [
        ("Tedarikçi", "supplier", False),
        ("Marka", "brand", False),
        ("Model", "model", False),
        ("Ürün Kodu", "item_code", False),
        ("Barkod", "barcode", False),
        ("İşlemler", "_delete", False),
    ]

    def __init__(self, parent=None):
        super().__init__(parent)
        self._ensure_supplier_column()
        self._setup_ui()
        get_translator().language_changed.connect(self._retranslate)

    def _ensure_supplier_column(self):
        """warehouse.parts tablosuna supplier sütunu yoksa ekler."""
        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                db.execute(
                    text(
                        "ALTER TABLE warehouse.parts ADD COLUMN IF NOT EXISTS supplier VARCHAR(255);"
                    )
                )
                db.commit()
            finally:
                db.close()
        except Exception as e:
            print(f"[Suppliers] supplier kolonu eklenemedi: {e}")

    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(28, 28, 28, 28)
        layout.setSpacing(16)

        # Başlık
        header_layout = QHBoxLayout()
        title_section = QWidget()
        title_layout = QVBoxLayout(title_section)
        title_layout.setContentsMargins(0, 0, 0, 0)
        title_layout.setSpacing(4)

        self._title_lbl = QLabel("Tedarikçiler")
        self._title_lbl.setObjectName("page_title")
        title_layout.addWidget(self._title_lbl)

        self._subtitle_lbl = QLabel(
            "Tedarikçi, marka, model, ürün kodu ve barkod bilgilerini yönetin"
        )
        self._subtitle_lbl.setObjectName("page_subtitle")
        title_layout.addWidget(self._subtitle_lbl)

        header_layout.addWidget(title_section)
        header_layout.addStretch()

        self._add_btn = QPushButton("＋ Yeni Ekle")
        self._add_btn.setObjectName("btn_success")
        self._add_btn.setCursor(Qt.PointingHandCursor)
        self._add_btn.clicked.connect(self._add_record)
        header_layout.addWidget(self._add_btn)

        layout.addLayout(header_layout)

        # Arama çubuğu
        search_row = QHBoxLayout()
        search_row.setSpacing(8)

        self._search_input = QLineEdit()
        self._search_input.setPlaceholderText(
            "Ara (ID, Tedarikçi, Marka, Model, Ürün Kodu, Barkod)..."
        )
        self._search_input.textChanged.connect(self._load_data)
        search_row.addWidget(self._search_input)

        layout.addLayout(search_row)

        # Tablo
        self._table = QTableWidget()
        self._table.setColumnCount(len(self.COLUMNS))
        self._table.setAlternatingRowColors(True)
        self._table.verticalHeader().setVisible(False)
        self._table.setSelectionBehavior(QTableWidget.SelectRows)

        hh = self._table.horizontalHeader()
        hh.setSectionResizeMode(0, QHeaderView.Stretch)
        hh.setSectionResizeMode(1, QHeaderView.Stretch)
        hh.setSectionResizeMode(2, QHeaderView.Stretch)
        hh.setSectionResizeMode(3, QHeaderView.ResizeToContents)
        hh.setSectionResizeMode(4, QHeaderView.ResizeToContents)
        hh.setSectionResizeMode(5, QHeaderView.Fixed)
        self._table.setColumnWidth(5, 100)

        layout.addWidget(self._table)

        self._load_data()

    def showEvent(self, event):
        super().showEvent(event)
        self._load_data()

    def _update_headers(self):
        self._table.setHorizontalHeaderLabels([col[0] for col in self.COLUMNS])

    def _load_data(self):
        self._table.blockSignals(True)
        self._update_headers()
        self._table.clearContents()

        search_q = self._search_input.text().strip()

        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                # Sadece supplier değeri olanları veya en az bir alanı dolu olanları getirelim?
                # User'ın isteğine göre tüm parçaları listeleyelim, böylece supplier'ı eksik olanları da görebilsinler.
                sql = """
                    SELECT id, supplier, brand, model, item_code, barcode
                    FROM warehouse.parts
                    WHERE 1=1
                """
                params = {}

                if search_q:
                    sql += " AND (supplier ILIKE :q OR brand ILIKE :q OR model ILIKE :q OR item_code ILIKE :q OR barcode ILIKE :q OR CAST(id AS VARCHAR) ILIKE :q)"
                    params["q"] = f"%{search_q}%"

                sql += " ORDER BY id DESC;"

                rows = db.execute(text(sql), params).fetchall()
                self._table.setRowCount(len(rows))

                for r_idx, row in enumerate(rows):
                    p_id = row[0]

                    def _item(val, field):
                        it = QTableWidgetItem(str(val) if val else "")
                        it.setFlags(it.flags() & ~Qt.ItemIsEditable)
                        it.setData(Qt.UserRole, (p_id, field))
                        return it

                    self._table.setItem(r_idx, 0, _item(row[1], "supplier"))
                    self._table.setItem(r_idx, 1, _item(row[2], "brand"))
                    self._table.setItem(r_idx, 2, _item(row[3], "model"))
                    self._table.setItem(r_idx, 3, _item(row[4], "item_code"))
                    self._table.setItem(r_idx, 4, _item(row[5], "barcode"))

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
                        edit_btn.setToolTip("Bu kaydı düzenle")

                        row_data = {
                            "supplier": row[1],
                            "brand": row[2],
                            "model": row[3],
                            "item_code": row[4],
                            "barcode": row[5],
                        }

                        edit_btn.clicked.connect(
                            lambda checked, pid=p_id, rdata=row_data: self._edit_record(
                                pid, rdata
                            )
                        )
                        action_layout.addWidget(edit_btn)

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
                    del_btn.setToolTip("Bu kaydı sil")
                    del_btn.clicked.connect(
                        lambda checked, pid=p_id: self._delete_record(pid)
                    )
                    action_layout.addWidget(del_btn)

                    action_widget = QWidget()
                    action_widget.setLayout(action_layout)

                    self._table.setCellWidget(r_idx, 5, action_widget)
                    self._table.setRowHeight(r_idx, 44)

            finally:
                db.close()
        except Exception as e:
            print(f"[Suppliers] Veri yüklenemedi: {e}")
        finally:
            self._table.blockSignals(False)

    def _edit_record(self, part_id: int, initial_data: dict):
        dialog = AddSupplierDialog(self, initial_data)
        if dialog.exec() == QDialog.Accepted:
            supplier = dialog.supplier_input.text().strip()
            brand = dialog.brand_input.currentText().strip()
            model = dialog.model_input.currentText().strip()
            item_code = dialog.item_code_input.currentText().strip()
            barcode = dialog.barcode_input.currentText().strip()

            brand_model = f"{brand} {model}".strip()
            name = brand_model or (supplier if supplier else "Bilinmeyen Ürün")

            try:
                from config.database import SessionLocal
                from sqlalchemy import text

                db = SessionLocal()
                try:
                    db.execute(
                        text("""
                            UPDATE warehouse.parts
                            SET name = :name,
                                supplier = :supplier,
                                brand = :brand,
                                model = :model,
                                brand_model = :brand_model,
                                item_code = :item_code,
                                barcode = :barcode
                            WHERE id = :id;
                        """),
                        {
                            "name": name,
                            "supplier": supplier or None,
                            "brand": brand or None,
                            "model": model or None,
                            "brand_model": brand_model or None,
                            "item_code": item_code or None,
                            "barcode": barcode or None,
                            "id": part_id,
                        },
                    )
                    db.commit()
                finally:
                    db.close()
                self._load_data()
            except Exception as e:
                QMessageBox.critical(self, "Hata", f"Kayıt güncellenemedi:\n{e}")

    def _add_record(self):
        dialog = AddSupplierDialog(self)
        if dialog.exec() != QDialog.Accepted:
            return

        supplier = dialog.supplier_input.text().strip() or None
        brand = dialog.brand_input.currentText().strip() or None
        model = dialog.model_input.currentText().strip() or None
        item_code = dialog.item_code_input.currentText().strip() or None
        barcode = dialog.barcode_input.currentText().strip() or None

        brand_model = f"{brand or ''} {model or ''}".strip() or None
        name = brand_model or (supplier if supplier else "Bilinmeyen Ürün")

        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                db.execute(
                    text("""
                        INSERT INTO warehouse.parts
                            (name, supplier, brand, model, brand_model, item_code, barcode)
                        VALUES
                            (:name, :supplier, :brand, :model, :brand_model, :item_code, :barcode);
                    """),
                    {
                        "name": name,
                        "supplier": supplier,
                        "brand": brand,
                        "model": model,
                        "brand_model": brand_model,
                        "item_code": item_code,
                        "barcode": barcode,
                    },
                )
                db.commit()
            finally:
                db.close()
            self._load_data()
        except Exception as e:
            QMessageBox.critical(self, "Hata", f"Kayıt eklenemedi:\n{e}")

    def _delete_record(self, part_id: int):
        reply = QMessageBox.question(
            self,
            "Sil",
            "Bu kaydı silmek istediğinize emin misiniz?\n(İlgili stok kayıtları da silinecektir.)",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No,
        )
        if reply != QMessageBox.Yes:
            return

        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                db.execute(
                    text("DELETE FROM warehouse.stock WHERE part_id = :id;"),
                    {"id": part_id},
                )
                db.execute(
                    text("DELETE FROM warehouse.parts WHERE id = :id;"),
                    {"id": part_id},
                )
                db.commit()
            finally:
                db.close()
            self._load_data()
        except Exception as e:
            QMessageBox.critical(self, "Hata", f"Kayıt silinemedi:\n{e}")

    def _retranslate(self):
        self._load_data()
