"""
RemaLab WMS - Inventory Status Page
Depodaki tüm parçaların detaylı envanter bilgilerini (Ürün Kodu, Barkod, Marka, Model, Renk, Ürün Ailesi, Ürün Kategorisi, Stok Durumu) listeler.
"""

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QTableWidget, QTableWidgetItem, QLineEdit,
    QPushButton, QHeaderView, QMessageBox
)
from PySide6.QtCore import Qt
from ui.translations import tr, get_translator


class InventoryPage(QWidget):
    """Envanter durumu modülü."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._setup_ui()
        get_translator().language_changed.connect(self._retranslate)

    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(28, 28, 28, 28)
        layout.setSpacing(16)

        # Üst Başlık
        header_layout = QHBoxLayout()
        title_section = QWidget()
        title_layout = QVBoxLayout(title_section)
        title_layout.setContentsMargins(0, 0, 0, 0)
        title_layout.setSpacing(4)

        self._title_lbl = QLabel(tr("inventory.title"))
        self._title_lbl.setStyleSheet("color: #F0F6FC; font-size: 20px; font-weight: bold;")
        title_layout.addWidget(self._title_lbl)

        self._subtitle_lbl = QLabel(tr("inventory.subtitle"))
        self._subtitle_lbl.setStyleSheet("color: #8B949E; font-size: 13px;")
        title_layout.addWidget(self._subtitle_lbl)

        header_layout.addWidget(title_section)
        header_layout.addStretch()

        layout.addLayout(header_layout)

        # Arama çubuğu
        self._search_input = QLineEdit()
        self._search_input.setPlaceholderText("Kod, Barkod, Marka veya Model ara...")
        self._search_input.setStyleSheet(
            "background-color: #161B22; border: 1px solid #30363D; "
            "border-radius: 6px; padding: 10px; color: #F0F6FC;"
        )
        self._search_input.textChanged.connect(self._load_inventory)
        layout.addWidget(self._search_input)

        # Envanter tablosu
        self._table = QTableWidget()
        self._table.setColumnCount(8)
        self._table.setAlternatingRowColors(True)
        self._table.verticalHeader().setVisible(False)
        self._table.setStyleSheet("""
            QTableWidget { background-color: #0D1117; alternate-background-color: #161B22; border: none; color: #F0F6FC; }
            QTableWidget::item { color: #F0F6FC; padding: 8px; }
            QHeaderView::section { background-color: #161B22; color: #8B949E; border: none; font-weight: bold; }
        """)
        self._table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self._table.itemChanged.connect(self._on_item_changed)
        layout.addWidget(self._table)

        self._load_inventory()

    def showEvent(self, event):
        """Sayfa her gösterildiğinde envanteri günceller."""
        super().showEvent(event)
        self._load_inventory()

    def _update_headers(self):
        self._table.setHorizontalHeaderLabels([
            tr("table.item_code"),
            tr("table.barcode"),
            tr("table.brand"),
            tr("table.model"),
            tr("table.color"),
            tr("table.product_family"),
            tr("table.item_category"),
            tr("table.stock_status")
        ])

    def _load_inventory(self):
        """PostgreSQL'den detaylı envanter bilgilerini çeker."""
        self._table.blockSignals(True)
        self._update_headers()
        self._table.clearContents()

        search_query = self._search_input.text().strip()

        try:
            from config.database import SessionLocal
            from sqlalchemy import text
            db = SessionLocal()
            try:
                # warehouse.parts tablosundan detaylar ve warehouse.stock üzerinden toplam miktarlar
                sql = """
                    SELECT p.id, p.item_code, p.barcode, p.brand, p.model, p.color, p.product_family, p.item_category,
                           COALESCE(SUM(s.quantity), 0) as total_stock
                    FROM warehouse.parts p
                    LEFT JOIN warehouse.stock s ON p.id = s.part_id
                """
                params = {}
                if search_query:
                    sql += """
                        WHERE p.item_code ILIKE :search 
                           OR p.barcode ILIKE :search 
                           OR p.brand ILIKE :search 
                           OR p.model ILIKE :search
                           OR p.name ILIKE :search
                    """
                    params["search"] = f"%{search_query}%"
                
                sql += " GROUP BY p.id ORDER BY p.id DESC;"

                rows = db.execute(text(sql), params).fetchall()
                self._table.setRowCount(len(rows))

                for r_idx, row in enumerate(rows):
                    p_id = row[0]
                    
                    # 1. Ürün Kodu (Editable)
                    item_code_item = QTableWidgetItem(str(row[1]) if row[1] else "")
                    item_code_item.setData(Qt.UserRole, (p_id, "item_code"))
                    
                    # 2. Barkod (Editable)
                    barcode_item = QTableWidgetItem(str(row[2]) if row[2] else "")
                    barcode_item.setData(Qt.UserRole, (p_id, "barcode"))

                    # 3. Marka (Editable)
                    brand_item = QTableWidgetItem(str(row[3]) if row[3] else "")
                    brand_item.setData(Qt.UserRole, (p_id, "brand"))

                    # 4. Model (Editable)
                    model_item = QTableWidgetItem(str(row[4]) if row[4] else "")
                    model_item.setData(Qt.UserRole, (p_id, "model"))

                    # 5. Renk (Editable)
                    color_item = QTableWidgetItem(str(row[5]) if row[5] else "")
                    color_item.setData(Qt.UserRole, (p_id, "color"))

                    # 6. Ürün Ailesi (Editable)
                    family_item = QTableWidgetItem(str(row[6]) if row[6] else "")
                    family_item.setData(Qt.UserRole, (p_id, "product_family"))

                    # 7. Ürün Kategorisi (Editable)
                    category_item = QTableWidgetItem(str(row[7]) if row[7] else "")
                    category_item.setData(Qt.UserRole, (p_id, "item_category"))

                    # 8. Stok Durumu (Miktar olarak gösterilsin, Read-only)
                    qty = row[8]
                    status_text = f"{qty} Adet"
                    if qty == 0:
                        status_text = f"Tükendi ({qty})"
                    elif qty < 5:
                        status_text = f"Kritik ({qty})"
                    status_item = QTableWidgetItem(status_text)
                    status_item.setFlags(status_item.flags() & ~Qt.ItemIsEditable)

                    # Renk kodlaması stok durumuna göre
                    if qty == 0:
                        status_item.setForeground(Qt.red)
                    elif qty < 5:
                        status_item.setForeground(Qt.yellow)
                    else:
                        status_item.setForeground(Qt.green)

                    self._table.setItem(r_idx, 0, item_code_item)
                    self._table.setItem(r_idx, 1, barcode_item)
                    self._table.setItem(r_idx, 2, brand_item)
                    self._table.setItem(r_idx, 3, model_item)
                    self._table.setItem(r_idx, 4, color_item)
                    self._table.setItem(r_idx, 5, family_item)
                    self._table.setItem(r_idx, 6, category_item)
                    self._table.setItem(r_idx, 7, status_item)
                    self._table.setRowHeight(r_idx, 44)
            finally:
                db.close()
        except Exception as e:
            print(f"[Error Loading Inventory] {e}")
        finally:
            self._table.blockSignals(False)

    def _on_item_changed(self, item: QTableWidgetItem):
        """Satır içi envanter alanları düzenleme kaydı."""
        item_data = item.data(Qt.UserRole)
        if item_data is None:
            return

        part_id, field_name = item_data
        new_value = item.text().strip()

        # Boş girdiler null olarak kaydedilsin
        db_val = new_value if new_value else None

        try:
            from config.database import SessionLocal
            from sqlalchemy import text
            db = SessionLocal()
            try:
                # Güvenli dinamik update sorgusu
                db.execute(
                    text(f"UPDATE warehouse.parts SET {field_name} = :val WHERE id = :id;"),
                    {"val": db_val, "id": part_id}
                )
                db.commit()
            finally:
                db.close()
        except Exception as e:
            QMessageBox.critical(self, "Hata", f"Güncelleme başarısız: {e}")
            self._load_inventory()

    def _retranslate(self):
        """Dil değiştiğinde çevirileri yeniler."""
        self._title_lbl.setText(tr("inventory.title"))
        self._subtitle_lbl.setText(tr("inventory.subtitle"))
        self._load_inventory()
