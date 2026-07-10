from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QComboBox, QSpinBox,
    QDialogButtonBox, QLineEdit, QMessageBox, QGroupBox, QFormLayout
)
from PySide6.QtCore import Qt
from ui.translations import tr

class StockTransferDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle(tr("warehouse.transfer_stock"))
        self.setMinimumWidth(450)

        self.source_stock_id = None
        self.max_qty = 0

        layout = QVBoxLayout(self)

        # Barkod/QR Alanı
        qr_group = QGroupBox("QR / Barkod / Ürün Kodu Okutma")
        qr_layout = QHBoxLayout(qr_group)
        self.qr_input = QLineEdit()
        self.qr_input.setPlaceholderText("Okutun veya yazıp Enter'a basın...")
        self.qr_input.returnPressed.connect(self._on_qr_scanned)
        qr_layout.addWidget(self.qr_input)
        layout.addWidget(qr_group)

        # Kaynak Seçimleri
        src_group = QGroupBox("Kaynak Bilgileri")
        src_layout = QFormLayout(src_group)

        self.source_loc_combo = QComboBox()
        self.source_loc_combo.currentIndexChanged.connect(self._on_loc_changed)
        src_layout.addRow("Kaynak Lokasyon:", self.source_loc_combo)

        self.brand_model_combo = QComboBox()
        self.brand_model_combo.currentIndexChanged.connect(self._on_brand_model_changed)
        src_layout.addRow("Marka ve Model:", self.brand_model_combo)

        self.product_combo = QComboBox()
        self.product_combo.currentIndexChanged.connect(self._on_prod_changed)
        src_layout.addRow("Ürün (Parça):", self.product_combo)

        layout.addWidget(src_group)

        # Hedef & Miktar
        tgt_group = QGroupBox("Transfer Bilgileri")
        tgt_layout = QFormLayout(tgt_group)

        self.target_loc_combo = QComboBox()
        tgt_layout.addRow("Hedef Lokasyon:", self.target_loc_combo)

        self.qty_spin = QSpinBox()
        self.qty_spin.setRange(0, 99999)
        tgt_layout.addRow("Transfer Miktarı:", self.qty_spin)

        layout.addWidget(tgt_group)

        # Mevcut Miktar Bilgisi
        self.info_lbl = QLabel("Seçilen Ürün Stok Miktarı: 0")
        self.info_lbl.setStyleSheet("color: gray;")
        layout.addWidget(self.info_lbl)

        # Butonlar
        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel, self)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        
        self.btn_ok = buttons.button(QDialogButtonBox.Ok)
        self.btn_ok.setText(tr("warehouse.transfer_stock"))
        self.btn_ok.setEnabled(False)
        buttons.button(QDialogButtonBox.Cancel).setText(tr("db.cancel"))

        layout.addWidget(buttons)

        self._load_initial_data()

    def _load_initial_data(self):
        try:
            from config.database import SessionLocal
            from sqlalchemy import text
            db = SessionLocal()
            try:
                # Hedef Lokasyonlar
                locs = db.execute(text("SELECT id, name FROM warehouse.locations ORDER BY name;")).fetchall()
                for row in locs:
                    self.target_loc_combo.addItem(row[1], row[0])

                # Kaynak Lokasyonlar (Sadece stoku olanlar)
                src_locs = db.execute(text("""
                    SELECT DISTINCT l.id, l.name 
                    FROM warehouse.locations l
                    JOIN warehouse.stock s ON s.location_id = l.id
                    WHERE s.quantity > 0
                    ORDER BY l.name;
                """)).fetchall()
                
                self.source_loc_combo.blockSignals(True)
                self.source_loc_combo.addItem("--- Lokasyon Seçin ---", None)
                for row in src_locs:
                    self.source_loc_combo.addItem(row[1], row[0])
                self.source_loc_combo.blockSignals(False)

            finally:
                db.close()
        except Exception as e:
            print(f"[Error Init Data] {e}")

    def _on_loc_changed(self):
        loc_id = self.source_loc_combo.currentData()
        self.brand_model_combo.blockSignals(True)
        self.brand_model_combo.clear()
        self.product_combo.blockSignals(True)
        self.product_combo.clear()
        self.product_combo.blockSignals(False)
        self._update_qty_info(0, None)

        if not loc_id:
            self.brand_model_combo.blockSignals(False)
            return

        try:
            from config.database import SessionLocal
            from sqlalchemy import text
            db = SessionLocal()
            try:
                bms = db.execute(text("""
                    SELECT DISTINCT COALESCE(NULLIF(TRIM(p.brand_model), ''), 'Marka/Model Belirtilmemiş') 
                    FROM warehouse.parts p
                    JOIN warehouse.stock s ON s.part_id = p.id
                    WHERE s.location_id = :loc AND s.quantity > 0
                    ORDER BY 1;
                """), {"loc": loc_id}).fetchall()

                self.brand_model_combo.addItem("--- Marka/Model Seçin ---", None)
                for row in bms:
                    self.brand_model_combo.addItem(row[0], row[0])
            finally:
                db.close()
        except Exception as e:
            print(e)
        finally:
            self.brand_model_combo.blockSignals(False)

    def _on_brand_model_changed(self):
        loc_id = self.source_loc_combo.currentData()
        bm_name = self.brand_model_combo.currentData()

        self.product_combo.blockSignals(True)
        self.product_combo.clear()
        self._update_qty_info(0, None)

        if not loc_id or not bm_name:
            self.product_combo.blockSignals(False)
            return

        try:
            from config.database import SessionLocal
            from sqlalchemy import text
            db = SessionLocal()
            try:
                q = ""
                if bm_name == 'Marka/Model Belirtilmemiş':
                    q = "(p.brand_model IS NULL OR TRIM(p.brand_model) = '')"
                else:
                    q = "p.brand_model = :bm"
                
                sql = f"""
                    SELECT p.id, p.name, s.quantity, s.id as stock_id
                    FROM warehouse.parts p
                    JOIN warehouse.stock s ON s.part_id = p.id
                    WHERE s.location_id = :loc AND s.quantity > 0 AND ({q})
                    ORDER BY p.name;
                """
                params = {"loc": loc_id}
                if bm_name != 'Marka/Model Belirtilmemiş':
                    params["bm"] = bm_name
                    
                prods = db.execute(text(sql), params).fetchall()

                self.product_combo.addItem("--- Ürün Seçin ---", None)
                for row in prods:
                    self.product_combo.addItem(f"{row[1]} (Mevcut: {row[2]})", {"stock_id": row[3], "qty": row[2]})
            finally:
                db.close()
        except Exception as e:
            print(e)
        finally:
            self.product_combo.blockSignals(False)

    def _on_prod_changed(self):
        data = self.product_combo.currentData()
        if data:
            self._update_qty_info(data["qty"], data["stock_id"])
        else:
            self._update_qty_info(0, None)

    def _update_qty_info(self, max_qty, stock_id):
        self.max_qty = max_qty
        self.source_stock_id = stock_id
        self.info_lbl.setText(f"Seçilen Ürün Stok Miktarı: {self.max_qty}")
        if stock_id and self.max_qty > 0:
            self.qty_spin.setRange(0, self.max_qty)
            self.qty_spin.setValue(1)
            self.btn_ok.setEnabled(True)
        else:
            self.qty_spin.setRange(0, 99999)
            self.qty_spin.setValue(0)
            self.btn_ok.setEnabled(False)

    def _on_qr_scanned(self):
        qr_text = self.qr_input.text().strip()
        if not qr_text:
            return

        try:
            from config.database import SessionLocal
            from sqlalchemy import text
            db = SessionLocal()
            try:
                part = db.execute(text("""
                    SELECT p.id, COALESCE(NULLIF(TRIM(p.brand_model), ''), 'Marka/Model Belirtilmemiş'), p.name, s.location_id, s.quantity, s.id as stock_id
                    FROM warehouse.parts p
                    JOIN warehouse.stock s ON s.part_id = p.id
                    WHERE (p.barcode = :val OR p.item_code = :val OR p.name = :val OR CAST(p.id AS VARCHAR) = :val)
                      AND s.quantity > 0
                    LIMIT 1;
                """), {"val": qr_text}).fetchone()

                if part:
                    p_bm = part[1]
                    if not p_bm or p_bm.strip() == '':
                        p_bm = 'Marka/Model Belirtilmemiş'
                    l_id = part[3]
                    
                    idx = self.source_loc_combo.findData(l_id)
                    if idx >= 0:
                        self.source_loc_combo.setCurrentIndex(idx)
                        
                        idx_bm = self.brand_model_combo.findData(p_bm)
                        if idx_bm >= 0:
                            self.brand_model_combo.setCurrentIndex(idx_bm)
                            
                            for i in range(self.product_combo.count()):
                                data = self.product_combo.itemData(i)
                                if data and isinstance(data, dict) and data.get("stock_id") == part[5]:
                                    self.product_combo.setCurrentIndex(i)
                                    break
                else:
                    QMessageBox.warning(self, "Bulunamadı", "Bu QR/Barkod ile stokta ürün bulunamadı.")
            finally:
                db.close()
        except Exception as e:
            print(f"[QR Error] {e}")
