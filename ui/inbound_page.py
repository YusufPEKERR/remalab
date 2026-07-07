"""
RemaLab WMS - Inbound Stock Entry Page
Depocu ve Admin yetkisindeki kullanıcıların yeni stok girişi yapabileceği ekran.
Barkod okuyucu entegrasyonu, otomatik odaklama ve akıllı if-else akışı ile birlikte.
"""

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QTableWidget, QTableWidgetItem, QPushButton,
    QHeaderView, QMessageBox, QDialog, QComboBox,
    QDoubleSpinBox, QSpinBox, QDialogButtonBox,
    QLineEdit
)
from PySide6.QtCore import Qt
from ui.translations import tr, get_translator


class QuickAddProductDialog(QDialog):
    """Bulunamayan barkodlar için Hızlı Ürün Ekleme modal formu."""

    def __init__(self, barcode: str, parent=None):
        super().__init__(parent)
        self.setWindowTitle(tr("inbound.quick_add_title"))
        self.setMinimumWidth(350)
        self.setStyleSheet("background-color: #0D1117; color: #F0F6FC;")

        layout = QVBoxLayout(self)
        layout.setSpacing(12)

        # Barkod (Read-only)
        lbl_barcode = QLabel("Barkod:")
        lbl_barcode.setStyleSheet("color: #8B949E; font-weight: bold;")
        layout.addWidget(lbl_barcode)

        self.barcode_input = QLineEdit(barcode)
        self.barcode_input.setReadOnly(True)
        self.barcode_input.setStyleSheet(
            "background-color: #161B22; border: 1px solid #30363D; padding: 8px; color: #8B949E; border-radius: 4px;"
        )
        layout.addWidget(self.barcode_input)

        # Ürün Adı
        lbl_name = QLabel(tr("parts.part_name"))
        lbl_name.setStyleSheet("color: #8B949E; font-weight: bold;")
        layout.addWidget(lbl_name)

        self.name_input = QLineEdit()
        self.name_input.setFocus()
        self.name_input.setStyleSheet(
            "background-color: #161B22; border: 1px solid #30363D; padding: 8px; color: #F0F6FC; border-radius: 4px;"
        )
        layout.addWidget(self.name_input)

        buttons = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel, self
        )
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        
        buttons.button(QDialogButtonBox.Ok).setText(tr("db.save"))
        buttons.button(QDialogButtonBox.Ok).setStyleSheet("background-color: #238636; color: white; padding: 8px 16px; border-radius: 4px; font-weight: bold;")
        buttons.button(QDialogButtonBox.Cancel).setText(tr("db.cancel"))
        buttons.button(QDialogButtonBox.Cancel).setStyleSheet("background-color: #21262D; color: #8B949E; padding: 8px 16px; border-radius: 4px;")
        
        layout.addWidget(buttons)


class AddInboundStockDialog(QDialog):
    """Yeni stok girişi ekleme modal formu."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle(tr("inbound.add_new"))
        self.setMinimumWidth(450)
        self.setStyleSheet("background-color: #0D1117; color: #F0F6FC;")

        layout = QVBoxLayout(self)
        layout.setSpacing(14)

        # 1. Barkod Girişi (Okuyucu için ilk odak alanı)
        lbl_barcode = QLabel(tr("inbound.barcode"))
        lbl_barcode.setStyleSheet("color: #58A6FF; font-weight: bold;")
        layout.addWidget(lbl_barcode)

        self.barcode_input = QLineEdit()
        self.barcode_input.setPlaceholderText("Barkodu okutun ve Enter'a basın...")
        self.barcode_input.setStyleSheet(
            "background-color: #161B22; border: 2px solid #1F6FEB; padding: 10px; color: #F0F6FC; border-radius: 6px; font-size: 14px;"
        )
        self.barcode_input.returnPressed.connect(self._on_barcode_scanned)
        layout.addWidget(self.barcode_input)

        # 2. Parça Dropdown
        lbl_part = QLabel(tr("parts.part_name"))
        lbl_part.setStyleSheet("color: #8B949E; font-weight: bold;")
        layout.addWidget(lbl_part)

        self.part_combo = QComboBox()
        self.part_combo.setStyleSheet(
            "background-color: #161B22; border: 1px solid #30363D; padding: 8px; color: #F0F6FC; border-radius: 4px;"
        )
        layout.addWidget(self.part_combo)

        # 3. Birim Adet
        lbl_qty = QLabel(tr("table.quantity"))
        lbl_qty.setStyleSheet("color: #8B949E; font-weight: bold;")
        layout.addWidget(lbl_qty)

        self.qty_spin = QSpinBox()
        self.qty_spin.setRange(1, 1000000)
        self.qty_spin.setValue(1)
        self.qty_spin.setStyleSheet(
            "background-color: #161B22; border: 1px solid #30363D; padding: 8px; color: #F0F6FC; border-radius: 4px;"
        )
        self.qty_spin.valueChanged.connect(self._calculate_total)
        layout.addWidget(self.qty_spin)

        # 4. Birim Fiyat
        lbl_price = QLabel(tr("inbound.unit_price"))
        lbl_price.setStyleSheet("color: #8B949E; font-weight: bold;")
        layout.addWidget(lbl_price)

        self.price_spin = QDoubleSpinBox()
        self.price_spin.setRange(0.01, 1000000.00)
        self.price_spin.setDecimals(2)
        self.price_spin.setValue(1.00)
        self.price_spin.setSuffix(" TL")
        self.price_spin.setStyleSheet(
            "background-color: #161B22; border: 1px solid #30363D; padding: 8px; color: #F0F6FC; border-radius: 4px;"
        )
        self.price_spin.valueChanged.connect(self._calculate_total)
        layout.addWidget(self.price_spin)

        # 5. Toplam Maliyet (Read-only / calculated)
        lbl_total = QLabel(tr("inbound.total_cost"))
        lbl_total.setStyleSheet("color: #8B949E; font-weight: bold;")
        layout.addWidget(lbl_total)

        self.total_cost_lbl = QLabel("1.00 TL")
        self.total_cost_lbl.setStyleSheet(
            "font-size: 16px; font-weight: bold; color: #58A6FF; padding: 8px; background-color: #161B22; border-radius: 4px;"
        )
        layout.addWidget(self.total_cost_lbl)

        # 6. Lokasyon Seçimi
        lbl_loc = QLabel(tr("table.location"))
        lbl_loc.setStyleSheet("color: #8B949E; font-weight: bold;")
        layout.addWidget(lbl_loc)

        self.loc_combo = QComboBox()
        self.loc_combo.setStyleSheet(
            "background-color: #161B22; border: 1px solid #30363D; padding: 8px; color: #F0F6FC; border-radius: 4px;"
        )
        layout.addWidget(self.loc_combo)

        # Butonlar
        buttons = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel, self
        )
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        
        buttons.button(QDialogButtonBox.Ok).setText(tr("db.save"))
        buttons.button(QDialogButtonBox.Ok).setStyleSheet("background-color: #238636; color: white; padding: 8px 16px; border-radius: 4px; font-weight: bold;")
        buttons.button(QDialogButtonBox.Cancel).setText(tr("db.cancel"))
        buttons.button(QDialogButtonBox.Cancel).setStyleSheet("background-color: #21262D; color: #8B949E; padding: 8px 16px; border-radius: 4px;")
        
        layout.addWidget(buttons)

        self._load_combos()
        self._calculate_total()

        # Otomatik odaklanma tetikleme
        self.barcode_input.setFocus()

    def _calculate_total(self):
        qty = self.qty_spin.value()
        price = self.price_spin.value()
        total = qty * price
        self.total_cost_lbl.setText(f"{total:,.2f} TL")

    def _load_combos(self, select_part_id: int = None):
        """Parça ve lokasyon listesini yükler."""
        self.part_combo.clear()
        self.loc_combo.clear()
        try:
            from config.database import SessionLocal
            from sqlalchemy import text
            db = SessionLocal()
            try:
                # Parçalar
                parts = db.execute(text("SELECT id, name FROM warehouse.parts ORDER BY name;")).fetchall()
                for row in parts:
                    self.part_combo.addItem(row[1], row[0])

                # Lokasyonlar
                locs = db.execute(text("SELECT id, name FROM warehouse.locations ORDER BY name;")).fetchall()
                for row in locs:
                    self.loc_combo.addItem(row[1], row[0])

                # Seçim yönlendirmesi
                if select_part_id:
                    idx = self.part_combo.findData(select_part_id)
                    if idx != -1:
                        self.part_combo.setCurrentIndex(idx)
            finally:
                db.close()
        except Exception as e:
            print(f"[Error Loading Dialog Combos] {e}")

    def _on_barcode_scanned(self):
        """Barkod okutulduğunda if-else karar akışı."""
        barcode_val = self.barcode_input.text().strip()
        if not barcode_val:
            return

        try:
            from config.database import SessionLocal
            from sqlalchemy import text
            db = SessionLocal()
            try:
                # Barkodu veritabanında sorgula
                part = db.execute(
                    text("SELECT id, name FROM warehouse.parts WHERE barcode = :barcode;"),
                    {"barcode": barcode_val}
                ).fetchone()

                if part:
                    # SENARYO A: Ürün Bulundu
                    idx = self.part_combo.findData(part[0])
                    if idx != -1:
                        self.part_combo.setCurrentIndex(idx)
                    # Adet alanına odaklan
                    self.qty_spin.setFocus()
                    self.qty_spin.selectAll()
                else:
                    # SENARYO B: Ürün Bulunamadı
                    reply = QMessageBox.question(
                        self,
                        tr("inbound.barcode_error_title"),
                        tr("inbound.barcode_error_msg"),
                        QMessageBox.Yes | QMessageBox.No,
                        QMessageBox.Yes
                    )

                    if reply == QMessageBox.Yes:
                        # Hızlı Ürün Ekleme Modalı
                        quick_dialog = QuickAddProductDialog(barcode_val, self)
                        if quick_dialog.exec() == QDialog.Accepted:
                            p_name = quick_dialog.name_input.text().strip()
                            if p_name:
                                # Yeni ürünü veritabanına kaydet
                                res = db.execute(
                                    text("INSERT INTO warehouse.parts (name, barcode) VALUES (:name, :barcode) RETURNING id;"),
                                    {"name": p_name, "barcode": barcode_val}
                                )
                                new_part_id = res.scalar()
                                db.commit()
                                
                                # Combobox'ı yenile ve yeni ürünü seçtir
                                self._load_combos(select_part_id=new_part_id)
                                self.qty_spin.setFocus()
                                self.qty_spin.selectAll()
                            else:
                                self._reset_barcode()
                        else:
                            self._reset_barcode()
                    else:
                        # HAYIR tıklandıysa
                        self._reset_barcode()

            finally:
                db.close()
        except Exception as e:
            QMessageBox.critical(self, "Hata", f"Sorgulama hatası: {e}")
            self._reset_barcode()

    def _reset_barcode(self):
        """Barkod giriş alanını temizler ve odağı tekrar oraya çeker."""
        self.barcode_input.clear()
        self.barcode_input.setFocus()


class InboundPage(QWidget):
    """Yeni Stok Girişi Modülü."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._current_role = "warehouse_worker"
        self._setup_ui()
        get_translator().language_changed.connect(self._retranslate)

    def _setup_ui(self):
        self._layout = QVBoxLayout(self)
        self._layout.setContentsMargins(28, 28, 28, 28)
        self._layout.setSpacing(16)

        if self._current_role not in ["admin", "warehouse_worker"]:
            unauth_lbl = QLabel(tr("inbound.unauthorized"))
            unauth_lbl.setStyleSheet("color: #F85149; font-size: 16px; font-weight: bold;")
            unauth_lbl.setAlignment(Qt.AlignCenter)
            self._layout.addWidget(unauth_lbl)
            return

        # Üst Bilgi
        header_layout = QHBoxLayout()
        title_section = QWidget()
        title_layout = QVBoxLayout(title_section)
        title_layout.setContentsMargins(0, 0, 0, 0)
        title_layout.setSpacing(4)

        self._title_lbl = QLabel(tr("inbound.title"))
        self._title_lbl.setStyleSheet("color: #F0F6FC; font-size: 20px; font-weight: bold;")
        title_layout.addWidget(self._title_lbl)

        self._subtitle_lbl = QLabel(tr("inbound.subtitle"))
        self._subtitle_lbl.setStyleSheet("color: #8B949E; font-size: 13px;")
        title_layout.addWidget(self._subtitle_lbl)

        header_layout.addWidget(title_section)
        header_layout.addStretch()

        # Excel Import/Export Butonları
        self._import_btn = QPushButton(tr("excel.import"))
        self._import_btn.setStyleSheet(
            "background-color: #21262D; border: 1px solid #30363D; color: #C9D1D9; padding: 8px 16px; "
            "border-radius: 6px; font-weight: bold;"
        )
        self._import_btn.setCursor(Qt.PointingHandCursor)
        self._import_btn.clicked.connect(self._import_excel)
        header_layout.addWidget(self._import_btn)

        self._export_btn = QPushButton(tr("excel.export"))
        self._export_btn.setStyleSheet(
            "background-color: #21262D; border: 1px solid #30363D; color: #C9D1D9; padding: 8px 16px; "
            "border-radius: 6px; font-weight: bold;"
        )
        self._export_btn.setCursor(Qt.PointingHandCursor)
        self._export_btn.clicked.connect(self._export_excel)
        header_layout.addWidget(self._export_btn)

        # Yeni Stok Ekle Butonu
        self._add_btn = QPushButton(tr("inbound.add_new"))
        self._add_btn.setStyleSheet(
            "background-color: #238636; color: white; padding: 8px 16px; "
            "border-radius: 6px; font-weight: bold;"
        )
        self._add_btn.setCursor(Qt.PointingHandCursor)
        self._add_btn.clicked.connect(self._add_inbound_stock)
        header_layout.addWidget(self._add_btn)

        self._layout.addLayout(header_layout)

        # Stok Giriş Tablosu
        self._table = QTableWidget()
        self._table.setColumnCount(6)
        self._table.setAlternatingRowColors(True)
        self._table.verticalHeader().setVisible(False)
        self._table.setSelectionBehavior(QTableWidget.SelectRows)
        self._table.setStyleSheet("""
            QTableWidget { background-color: #0D1117; alternate-background-color: #161B22; border: none; color: #F0F6FC; }
            QTableWidget::item { color: #F0F6FC; padding: 8px; }
            QHeaderView::section { background-color: #161B22; color: #8B949E; border: none; font-weight: bold; }
        """)
        self._table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self._layout.addWidget(self._table)

        self._load_entries()

    def showEvent(self, event):
        """Sayfa her gösterildiğinde stok girişlerini yeniler."""
        super().showEvent(event)
        self._load_entries()

    def _update_headers(self):
        self._table.setHorizontalHeaderLabels([
            tr("table.part_name"),
            tr("table.quantity"),
            tr("inbound.unit_price"),
            tr("inbound.total_cost"),
            tr("inbound.date"),
            tr("inbound.created_by")
        ])

    def _load_entries(self):
        """Mevcut stok girişlerini PostgreSQL'den çeker."""
        self._update_headers()
        self._table.clearContents()

        try:
            from config.database import SessionLocal
            from sqlalchemy import text
            db = SessionLocal()
            try:
                rows = db.execute(text("""
                    SELECT p.name, e.quantity, e.unit_price, e.total_cost, e.created_at, e.created_by
                    FROM warehouse.inbound_entries e
                    JOIN warehouse.parts p ON e.part_id = p.id
                    ORDER BY e.created_at DESC;
                """)).fetchall()

                self._table.setRowCount(len(rows))
                for r_idx, row in enumerate(rows):
                    self._table.setItem(r_idx, 0, QTableWidgetItem(str(row[0])))
                    self._table.setItem(r_idx, 1, QTableWidgetItem(str(row[1])))
                    self._table.setItem(r_idx, 2, QTableWidgetItem(f"{row[2]:,.2f} TL"))
                    self._table.setItem(r_idx, 3, QTableWidgetItem(f"{row[3]:,.2f} TL"))
                    self._table.setItem(r_idx, 4, QTableWidgetItem(str(row[4])[:16]))
                    self._table.setItem(r_idx, 5, QTableWidgetItem(str(row[5])))
                    self._table.setRowHeight(r_idx, 44)
            finally:
                db.close()
        except Exception as e:
            print(f"[Error Loading Inbounds] {e}")

    def _add_inbound_stock(self):
        """Stok giriş formunu açar ve kaydeder."""
        dialog = AddInboundStockDialog(self)
        if dialog.exec() == QDialog.Accepted:
            part_id = dialog.part_combo.currentData()
            location_id = dialog.loc_combo.currentData()
            qty = dialog.qty_spin.value()
            price = dialog.price_spin.value()
            total = qty * price
            created_by = "depocu_1"

            if part_id is None or location_id is None:
                QMessageBox.warning(self, "Hata", "Lütfen tüm seçimleri yapın.")
                return

            try:
                from config.database import SessionLocal
                from sqlalchemy import text
                db = SessionLocal()
                try:
                    # 1. Inbound Giriş Kaydını Oluştur
                    db.execute(text("""
                        INSERT INTO warehouse.inbound_entries (part_id, quantity, unit_price, total_cost, created_by)
                        VALUES (:part_id, :qty, :price, :total, :created_by);
                    """), {"part_id": part_id, "qty": qty, "price": price, "total": total, "created_by": created_by})

                    # 2. Stok Miktarını Güncelle veya Ekle
                    existing = db.execute(text("""
                        SELECT id FROM warehouse.stock 
                        WHERE part_id = :part_id AND location_id = :loc_id;
                    """), {"part_id": part_id, "loc_id": location_id}).fetchone()

                    if existing:
                        db.execute(text("""
                            UPDATE warehouse.stock SET quantity = quantity + :qty WHERE id = :id;
                        """), {"qty": qty, "id": existing[0]})
                    else:
                        db.execute(text("""
                            INSERT INTO warehouse.stock (part_id, location_id, quantity)
                            VALUES (:part_id, :loc_id, :qty);
                        """), {"part_id": part_id, "loc_id": location_id, "qty": qty})

                    # 3. Stok Hareket Kaydı
                    db.execute(text("""
                        INSERT INTO warehouse.stock_movements (type, quantity)
                        VALUES ('Inbound', :qty);
                    """), {"qty": qty})

                    db.commit()
                    QMessageBox.information(self, "Başarılı", "Stok girişi başarıyla yapıldı.")
                finally:
                    db.close()

                self._load_entries()
            except Exception as e:
                QMessageBox.critical(self, "Hata", f"Stok kaydedilemedi: {e}")

    def _import_excel(self):
        """Excel'den veri aktarımı tetikler (sütun eşleştirme ile)."""
        from ui.excel_utils import import_excel_flow
        db_cols = ["part_id", "quantity", "unit_price", "total_cost", "location_id", "created_by"]
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
                    # NaN/Null korumalı güvenli tip dönüşümleri
                    part_id_raw = row.get("part_id")
                    if pd.isna(part_id_raw): continue
                    part_id = int(part_id_raw)

                    qty_raw = row.get("quantity")
                    qty = int(qty_raw) if not pd.isna(qty_raw) else 0
                    if qty <= 0: continue

                    price_raw = row.get("unit_price")
                    price = float(price_raw) if not pd.isna(price_raw) else 1.0

                    total_raw = row.get("total_cost")
                    total = float(total_raw) if not pd.isna(total_raw) else (qty * price)

                    loc_id_raw = row.get("location_id")
                    loc_id = int(loc_id_raw) if not pd.isna(loc_id_raw) else 1

                    created_by_raw = row.get("created_by")
                    created_by = str(created_by_raw) if not pd.isna(created_by_raw) else "excel_import"

                    # 1. Inbound Giriş Kaydını Oluştur
                    db.execute(text("""
                        INSERT INTO warehouse.inbound_entries (part_id, quantity, unit_price, total_cost, created_by)
                        VALUES (:part_id, :qty, :price, :total, :created_by);
                    """), {"part_id": part_id, "qty": qty, "price": price, "total": total, "created_by": created_by})

                    # 2. Stok Miktarını Güncelle veya Ekle
                    existing = db.execute(text("""
                        SELECT id FROM warehouse.stock 
                        WHERE part_id = :part_id AND location_id = :loc_id;
                    """), {"part_id": part_id, "loc_id": loc_id}).fetchone()

                    if existing:
                        db.execute(text("""
                            UPDATE warehouse.stock SET quantity = quantity + :qty WHERE id = :id;
                        """), {"qty": qty, "id": existing[0]})
                    else:
                        db.execute(text("""
                            INSERT INTO warehouse.stock (part_id, location_id, quantity)
                            VALUES (:part_id, :loc_id, :qty);
                        """), {"part_id": part_id, "loc_id": loc_id, "qty": qty})

                    # 3. Stok Hareket Kaydı
                    db.execute(text("""
                        INSERT INTO warehouse.stock_movements (type, quantity)
                        VALUES ('Inbound', :qty);
                    """), {"qty": qty})

                db.commit()
            finally:
                db.close()
            self._load_entries()
        except Exception as e:
            QMessageBox.critical(self, "Hata", f"Veriler veritabanına kaydedilemedi: {e}")

    def _export_excel(self):
        """Mevcut tablo kayıtlarını Excel'e aktarır."""
        from ui.excel_utils import export_excel_flow
        data = []
        try:
            from config.database import SessionLocal
            from sqlalchemy import text
            db = SessionLocal()
            try:
                rows = db.execute(text("""
                    SELECT p.name, e.quantity, e.unit_price, e.total_cost, e.created_at, e.created_by
                    FROM warehouse.inbound_entries e
                    JOIN warehouse.parts p ON e.part_id = p.id
                    ORDER BY e.created_at DESC;
                """)).fetchall()
                for r in rows:
                    data.append({
                        "Parça Adı": r[0],
                        "Miktar": r[1],
                        "Birim Fiyat": float(r[2]),
                        "Toplam Maliyet": float(r[3]),
                        "Tarih": str(r[4]),
                        "İşlemi Yapan": r[5]
                    })
            finally:
                db.close()
        except Exception as e:
            print(e)

        export_excel_flow(self, data, "Inbound_Entries.xlsx")

    def _retranslate(self):
        """Dili günceller."""
        if hasattr(self, "_title_lbl"):
            self._title_lbl.setText(tr("inbound.title"))
            self._subtitle_lbl.setText(tr("inbound.subtitle"))
            self._add_btn.setText(tr("inbound.add_new"))
            self._import_btn.setText(tr("excel.import"))
            self._export_btn.setText(tr("excel.export"))
            self._load_entries()
