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
from ui.translations import tr, get_translator


class AddSupplierDialog(QDialog):
    """Yeni tedarikçi-parça ilişkisi / ürün ekleme formu."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Yeni Tedarikçi / Ürün Ekle")
        self.setMinimumWidth(420)

        layout = QVBoxLayout(self)

        form = QFormLayout()
        form.setSpacing(12)

        self.supplier_input = QLineEdit()
        self.supplier_input.setPlaceholderText("Tedarikçi Adı (örn. XYZ Elektronik)")
        form.addRow("Tedarikçi:", self.supplier_input)

        self.brand_input = QLineEdit()
        self.brand_input.setPlaceholderText("Marka")
        form.addRow("Marka:", self.brand_input)

        self.model_input = QLineEdit()
        self.model_input.setPlaceholderText("Model")
        form.addRow("Model:", self.model_input)

        self.item_code_input = QLineEdit()
        self.item_code_input.setPlaceholderText("Ürün Kodu")
        form.addRow("Ürün Kodu:", self.item_code_input)

        self.barcode_input = QLineEdit()
        self.barcode_input.setPlaceholderText("Barkod")
        form.addRow("Barkod:", self.barcode_input)

        layout.addLayout(form)

        buttons = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel, self
        )
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        buttons.button(QDialogButtonBox.Ok).setText("Kaydet")
        buttons.button(QDialogButtonBox.Cancel).setText("İptal")
        layout.addWidget(buttons)


class SuppliersPage(QWidget):
    """Tedarikçiler modülü."""

    COLUMNS = [
        ("Tedarikçi",   "supplier",  True),
        ("Marka",       "brand",     True),
        ("Model",       "model",     True),
        ("Ürün Kodu",   "item_code", True),
        ("Barkod",      "barcode",   True),
        ("",            "_delete",   False),
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

        self._subtitle_lbl = QLabel("Tedarikçi, marka, model, ürün kodu ve barkod bilgilerini yönetin")
        self._subtitle_lbl.setObjectName("page_subtitle")
        title_layout.addWidget(self._subtitle_lbl)

        header_layout.addWidget(title_section)
        header_layout.addStretch()

        self._add_btn = QPushButton("＋ Yeni Ekle")
        self._add_btn.setCursor(Qt.PointingHandCursor)
        self._add_btn.clicked.connect(self._add_record)
        header_layout.addWidget(self._add_btn)

        layout.addLayout(header_layout)

        # Arama çubuğu
        search_row = QHBoxLayout()
        search_row.setSpacing(8)

        self._search_supplier = QLineEdit()
        self._search_supplier.setPlaceholderText("Tedarikçi Filtrele...")
        self._search_supplier.textChanged.connect(self._load_data)
        search_row.addWidget(self._search_supplier)

        self._search_brand = QLineEdit()
        self._search_brand.setPlaceholderText("Marka Filtrele...")
        self._search_brand.textChanged.connect(self._load_data)
        search_row.addWidget(self._search_brand)

        self._search_model = QLineEdit()
        self._search_model.setPlaceholderText("Model Filtrele...")
        self._search_model.textChanged.connect(self._load_data)
        search_row.addWidget(self._search_model)

        self._search_item_code = QLineEdit()
        self._search_item_code.setPlaceholderText("Ürün Kodu Filtrele...")
        self._search_item_code.textChanged.connect(self._load_data)
        search_row.addWidget(self._search_item_code)

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
        self._table.setColumnWidth(5, 50)

        self._table.itemChanged.connect(self._on_item_changed)
        layout.addWidget(self._table)

        self._load_data()

    def showEvent(self, event):
        super().showEvent(event)
        self._load_data()

    def _update_headers(self):
        self._table.setHorizontalHeaderLabels(
            [col[0] for col in self.COLUMNS]
        )

    def _load_data(self):
        self._table.blockSignals(True)
        self._update_headers()
        self._table.clearContents()

        supplier_f  = self._search_supplier.text().strip()
        brand_f     = self._search_brand.text().strip()
        model_f     = self._search_model.text().strip()
        item_code_f = self._search_item_code.text().strip()

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

                if supplier_f:
                    sql += " AND supplier ILIKE :supplier"
                    params["supplier"] = f"%{supplier_f}%"
                if brand_f:
                    sql += " AND brand ILIKE :brand"
                    params["brand"] = f"%{brand_f}%"
                if model_f:
                    sql += " AND model ILIKE :model"
                    params["model"] = f"%{model_f}%"
                if item_code_f:
                    sql += " AND item_code ILIKE :item_code"
                    params["item_code"] = f"%{item_code_f}%"

                sql += " ORDER BY id DESC;"

                rows = db.execute(text(sql), params).fetchall()
                self._table.setRowCount(len(rows))

                for r_idx, row in enumerate(rows):
                    p_id = row[0]

                    def _item(val, field):
                        it = QTableWidgetItem(str(val) if val else "")
                        it.setData(Qt.UserRole, (p_id, field))
                        return it

                    self._table.setItem(r_idx, 0, _item(row[1], "supplier"))
                    self._table.setItem(r_idx, 1, _item(row[2], "brand"))
                    self._table.setItem(r_idx, 2, _item(row[3], "model"))
                    self._table.setItem(r_idx, 3, _item(row[4], "item_code"))
                    self._table.setItem(r_idx, 4, _item(row[5], "barcode"))

                    del_btn = QPushButton("🗑️")
                    del_btn.setCursor(Qt.PointingHandCursor)
                    del_btn.setToolTip("Bu kaydı sil")
                    del_btn.clicked.connect(
                        lambda checked, pid=p_id: self._delete_record(pid)
                    )
                    self._table.setCellWidget(r_idx, 5, del_btn)
                    self._table.setRowHeight(r_idx, 44)

            finally:
                db.close()
        except Exception as e:
            print(f"[Suppliers] Veri yüklenemedi: {e}")
        finally:
            self._table.blockSignals(False)

    def _on_item_changed(self, item: QTableWidgetItem):
        item_data = item.data(Qt.UserRole)
        if item_data is None:
            return

        p_id, field = item_data
        new_val = item.text().strip() or None

        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                extra = ""
                extra_params = {}
                if field in ("brand", "model"):
                    other = db.execute(
                        text(f"SELECT brand, model FROM warehouse.parts WHERE id = :id;"),
                        {"id": p_id},
                    ).fetchone()
                    if other:
                        b = new_val if field == "brand" else (other[0] or "")
                        m = new_val if field == "model" else (other[1] or "")
                        bm = f"{b} {m}".strip()
                        extra = ", brand_model = :bm"
                        extra_params["bm"] = bm if bm else None

                db.execute(
                    text(f"UPDATE warehouse.parts SET {field} = :val{extra} WHERE id = :id;"),
                    {"val": new_val, "id": p_id, **extra_params},
                )
                db.commit()
            finally:
                db.close()
        except Exception as e:
            QMessageBox.critical(self, "Hata", f"Güncelleme başarısız:\n{e}")
            self._load_data()

    def _add_record(self):
        dialog = AddSupplierDialog(self)
        if dialog.exec() != QDialog.Accepted:
            return

        supplier  = dialog.supplier_input.text().strip() or None
        brand     = dialog.brand_input.text().strip() or None
        model     = dialog.model_input.text().strip() or None
        item_code = dialog.item_code_input.text().strip() or None
        barcode   = dialog.barcode_input.text().strip() or None

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
