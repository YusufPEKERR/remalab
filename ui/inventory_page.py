"""
RemaLab WMS - Inventory Status Page
Depodaki tüm parçaların detaylı envanter bilgilerini (Ürün Kodu, Barkod, Marka, Model, Renk, Ürün Ailesi, Ürün Kategorisi, Stok Durumu) listeler.
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
    QComboBox,
    QSpinBox,
    QDialogButtonBox,
)
from PySide6.QtCore import Qt
from ui.translations import tr, get_translator
from services.stock_service import StockService
from services.exceptions import InsufficientStockError, ServiceError


from ui.stock_transfer_dialog import StockTransferDialog


class InventoryPage(QWidget):
    """Envanter durumu modülü."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.service = StockService()
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
        self._title_lbl
        title_layout.addWidget(self._title_lbl)

        self._subtitle_lbl = QLabel(tr("inventory.subtitle"))
        self._subtitle_lbl
        title_layout.addWidget(self._subtitle_lbl)

        header_layout.addWidget(title_section)
        header_layout.addStretch()

        # Excel Import/Export Butonları
        self._import_btn = QPushButton(f"📥 {tr('excel.import')}")
        self._import_btn.setObjectName("btn_success")
        self._import_btn.setCursor(Qt.PointingHandCursor)
        self._import_btn.clicked.connect(self._import_excel)
        header_layout.addWidget(self._import_btn)

        self._export_btn = QPushButton(f"📤 {tr('excel.export')}")
        self._export_btn.setObjectName("btn_primary")
        self._export_btn.setCursor(Qt.PointingHandCursor)
        self._export_btn.clicked.connect(self._export_excel)
        header_layout.addWidget(self._export_btn)

        # Stok Transfer Butonu
        self._transfer_btn = QPushButton(f"↻ {tr('warehouse.transfer_stock')}")
        self._transfer_btn.setObjectName("btn_warning")
        self._transfer_btn.setCursor(Qt.PointingHandCursor)
        self._transfer_btn.clicked.connect(self._transfer_stock)
        header_layout.addWidget(self._transfer_btn)

        layout.addLayout(header_layout)

        # Sütun bazlı filtreleme paneli
        self._filter_layout = QHBoxLayout()
        self._filter_layout.setSpacing(8)

        self._search_input = QLineEdit()
        self._search_input.setPlaceholderText(
            "Ara (ID, Barkod, Ürün Kodu, Marka/Model, Kategori, Renk)..."
        )
        self._search_input.textChanged.connect(self._load_inventory)
        self._filter_layout.addWidget(self._search_input)

        layout.addLayout(self._filter_layout)

        # Envanter tablosu
        self._table = QTableWidget()
        self._table.setColumnCount(4)
        self._table.setAlternatingRowColors(True)
        self._table.verticalHeader().setVisible(False)
        self._table.setEditTriggers(QTableWidget.NoEditTriggers)
        self._table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        layout.addWidget(self._table)

        self._load_inventory()

    def showEvent(self, event):
        """Sayfa her gösterildiğinde envanteri günceller."""
        super().showEvent(event)
        self._load_inventory()

    def _update_headers(self):
        self._table.setHorizontalHeaderLabels(
            [
                tr("table.part_id"),
                tr("parts.part_name"),
                tr("table.barcode"),
                tr("table.stock_status"),
            ]
        )

    def _load_inventory(self):
        """PostgreSQL'den detaylı envanter bilgilerini çeker."""
        self._table.blockSignals(True)
        self._update_headers()
        self._table.clearContents()

        search_q = self._search_input.text().strip()

        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                sql = """
                    SELECT p.id, p.name, p.barcode, COALESCE(SUM(s.quantity), 0) as total_stock
                    FROM warehouse.parts p
                    LEFT JOIN warehouse.stock s ON p.id = s.part_id
                """
                params = {}

                if search_q:
                    sql += """ WHERE 
                        p.name ILIKE :q OR 
                        p.barcode ILIKE :q OR 
                        CAST(p.id AS VARCHAR) ILIKE :q
                    """
                    params["q"] = f"%{search_q}%"

                sql += " GROUP BY p.id ORDER BY p.id DESC;"

                rows = db.execute(text(sql), params).fetchall()
                self._table.setRowCount(len(rows))

                for r_idx, row in enumerate(rows):
                    p_id = row[0]
                    p_name = row[1]
                    p_barcode = row[2] or ""
                    total_stock = row[3]

                    id_item = QTableWidgetItem(str(p_id))
                    name_item = QTableWidgetItem(p_name)
                    barcode_item = QTableWidgetItem(p_barcode)
                    stock_item = QTableWidgetItem(str(total_stock))

                    if total_stock == 0:
                        stock_item.setForeground(Qt.red)

                    self._table.setItem(r_idx, 0, id_item)
                    self._table.setItem(r_idx, 1, name_item)
                    self._table.setItem(r_idx, 2, barcode_item)
                    self._table.setItem(r_idx, 3, stock_item)

                    self._table.setRowHeight(r_idx, 36)

            finally:
                db.close()
        except Exception as e:
            print(f"[Error Loading Inventory] {e}")
        finally:
            self._table.blockSignals(False)

    def _import_excel(self):
        """Excel'den envanter verisi aktarımı tetikler."""
        from ui.excel_utils import import_excel_flow

        db_cols = [
            "name",
            "barcode",
        ]
        import_excel_flow(self, db_cols, self._save_imported_data)

    def _save_imported_data(self, df):
        """Eşleştirilen ve DataFrame haline gelen veriyi PostgreSQL'e yazar."""
        import pandas as pd

        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                for _, row in df.iterrows():
                    name_raw = row.get("name")
                    p_name = str(name_raw).strip() if not pd.isna(name_raw) else None

                    barcode_raw = row.get("barcode")
                    barcode = (
                        str(barcode_raw).strip() if not pd.isna(barcode_raw) else None
                    )

                    # Eşleştirme için en azından ad bulunmalı
                    if not p_name:
                        continue

                    # Mevcut isme veya barkoda göre kontrol et, varsa güncelle, yoksa ekle
                    existing = None
                    if barcode:
                        existing = db.execute(
                            text(
                                "SELECT id FROM warehouse.parts WHERE barcode = :barcode LIMIT 1;"
                            ),
                            {"barcode": barcode},
                        ).fetchone()

                    if not existing and p_name:
                        existing = db.execute(
                            text(
                                "SELECT id FROM warehouse.parts WHERE name = :name LIMIT 1;"
                            ),
                            {"name": p_name},
                        ).fetchone()

                    if existing:
                        db.execute(
                            text("""
                            UPDATE warehouse.parts 
                            SET name = COALESCE(:name, name),
                                barcode = COALESCE(:barcode, barcode)
                            WHERE id = :id;
                        """),
                            {
                                "name": p_name,
                                "barcode": barcode,
                                "id": existing[0],
                            },
                        )
                    else:
                        db.execute(
                            text("""
                            INSERT INTO warehouse.parts (name, barcode)
                            VALUES (:name, :barcode);
                        """),
                            {
                                "name": p_name,
                                "barcode": barcode,
                            },
                        )

                db.commit()
            finally:
                db.close()
            self._load_inventory()
        except Exception as e:
            QMessageBox.critical(
                self, "Hata", f"Veriler veritabanına kaydedilemedi: {e}"
            )

    def _export_excel(self):
        """Tüm envanter durumunu Excel olarak dışa aktarır."""
        from ui.excel_utils import export_excel_flow

        data = []
        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                rows = db.execute(text("""
                    SELECT p.id, p.name, p.barcode, COALESCE(SUM(s.quantity), 0) as total_stock
                    FROM warehouse.parts p
                    LEFT JOIN warehouse.stock s ON p.id = s.part_id
                    GROUP BY p.id ORDER BY p.id DESC;
                """)).fetchall()
                for r in rows:
                    data.append(
                        {
                            "ID": r[0],
                            "Parça Adı": r[1],
                            "Barkod": r[2],
                            "Mevcut Stok": r[3],
                        }
                    )
            finally:
                db.close()
        except Exception as e:
            print(e)

        export_excel_flow(self, data, "Warehouse_Inventory.xlsx")

    def _transfer_stock(self):
        """Stok transfer operasyonu."""
        dialog = StockTransferDialog(self)
        if dialog.exec() == QDialog.Accepted:
            source_stock_id = dialog.source_stock_id
            target_location_id = dialog.target_loc_combo.currentData()
            transfer_qty = dialog.qty_spin.value()

            if source_stock_id is None or target_location_id is None:
                return

            try:
                self.service.transfer(source_stock_id, target_location_id, transfer_qty)
                QMessageBox.information(
                    self, "Başarılı", tr("warehouse.transfer_success")
                )
                self._load_inventory()
            except InsufficientStockError:
                QMessageBox.warning(self, "Hata", tr("warehouse.insufficient_stock"))
            except ServiceError as e:
                QMessageBox.critical(self, "Hata", f"Stok transfer edilemedi: {e}")

    def _retranslate(self):
        """Dil değiştiğinde çevirileri yeniler."""
        self._title_lbl.setText(tr("inventory.title"))
        self._subtitle_lbl.setText(tr("inventory.subtitle"))
        self._import_btn.setText(tr("excel.import"))
        self._export_btn.setText(tr("excel.export"))
        self._load_inventory()
