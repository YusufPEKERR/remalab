"""
RemaLab WMS - Outbound Stock Entry Page
Depocu ve Admin yetkisindeki kullanıcıların depodan çıkış işlemlerini kaydedebileceği ekran.
"""

from PySide6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QTableWidget,
    QTableWidgetItem,
    QPushButton,
    QHeaderView,
    QMessageBox,
    QDialog,
    QComboBox,
    QSpinBox,
    QDialogButtonBox,
    QLineEdit,
)
from PySide6.QtCore import Qt
from ui.translations import tr, get_translator


class AddOutboundStockDialog(QDialog):
    """Yeni stok çıkış formu modal diyalog."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle(tr("outbound.add_new"))
        self.setMinimumWidth(400)
        self.setStyleSheet("background-color: #0D1117; color: #F0F6FC;")

        layout = QVBoxLayout(self)
        layout.setSpacing(14)

        # 1. Kaynak Stok Satırı Seçimi (Hangi lokasyondaki hangi parça çıkılacak?)
        lbl_stock = QLabel("Çıkış Yapılacak Stok (Parça & Lokasyon):")
        lbl_stock.setStyleSheet("color: #8B949E; font-weight: bold;")
        layout.addWidget(lbl_stock)

        self.stock_combo = QComboBox()
        self.stock_combo.setStyleSheet(
            "background-color: #161B22; border: 1px solid #30363D; padding: 8px; color: #F0F6FC; border-radius: 4px;"
        )
        layout.addWidget(self.stock_combo)

        # 2. Birim Adet
        lbl_qty = QLabel(tr("table.quantity"))
        lbl_qty.setStyleSheet("color: #8B949E; font-weight: bold;")
        layout.addWidget(lbl_qty)

        self.qty_spin = QSpinBox()
        self.qty_spin.setRange(1, 1000000)
        self.qty_spin.setValue(1)
        self.qty_spin.setStyleSheet(
            "background-color: #161B22; border: 1px solid #30363D; padding: 8px; color: #F0F6FC; border-radius: 4px;"
        )
        layout.addWidget(self.qty_spin)

        # 3. Alıcı / Müşteri / Gönderilen Yer
        lbl_dest = QLabel(tr("outbound.destination_label"))
        lbl_dest.setStyleSheet("color: #8B949E; font-weight: bold;")
        layout.addWidget(lbl_dest)

        self.dest_input = QLineEdit()
        self.dest_input.setPlaceholderText("Örn: RemaLab Kadıköy Şubesi")
        self.dest_input.setStyleSheet(
            "background-color: #161B22; border: 1px solid #30363D; padding: 8px; color: #F0F6FC; border-radius: 4px;"
        )
        layout.addWidget(self.dest_input)

        # Butonlar
        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel, self)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)

        buttons.button(QDialogButtonBox.Ok).setText(tr("db.save"))
        buttons.button(QDialogButtonBox.Ok).setStyleSheet(
            "background-color: #238636; color: white; padding: 8px 16px; border-radius: 4px; font-weight: bold;"
        )
        buttons.button(QDialogButtonBox.Cancel).setText(tr("db.cancel"))
        buttons.button(QDialogButtonBox.Cancel).setStyleSheet(
            "background-color: #21262D; color: #8B949E; padding: 8px 16px; border-radius: 4px;"
        )

        layout.addWidget(buttons)

        self._load_stocks()

    def _load_stocks(self):
        """Mevcut depoları ve parça stoklarını listeler."""
        self.stock_combo.clear()
        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                # Sadece stok miktarı > 0 olanları çıkar
                rows = db.execute(text("""
                    SELECT s.id, p.name, l.name, s.quantity, p.id, l.id
                    FROM warehouse.stock s
                    JOIN warehouse.parts p ON s.part_id = p.id
                    JOIN warehouse.locations l ON s.location_id = l.id
                    WHERE s.quantity > 0
                    ORDER BY p.name;
                """)).fetchall()

                for row in rows:
                    # veri olarak (stock_id, part_id, location_id, max_quantity) tuple sakla
                    self.stock_combo.addItem(
                        f"{row[1]} ({row[2]}) - Stok: {row[3]}",
                        (row[0], row[4], row[5], row[3]),
                    )
            finally:
                db.close()
        except Exception as e:
            print(f"[Error Loading Outbound Dialog Combos] {e}")


class OutboundPage(QWidget):
    """Depo Çıkış Modülü Ekranı."""

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
            unauth_lbl = QLabel(tr("outbound.unauthorized"))
            unauth_lbl.setStyleSheet(
                "color: #F85149; font-size: 16px; font-weight: bold;"
            )
            unauth_lbl.setAlignment(Qt.AlignCenter)
            self._layout.addWidget(unauth_lbl)
            return

        # Üst Bilgi
        header_layout = QHBoxLayout()
        title_section = QWidget()
        title_layout = QVBoxLayout(title_section)
        title_layout.setContentsMargins(0, 0, 0, 0)
        title_layout.setSpacing(4)

        self._title_lbl = QLabel(tr("outbound.title"))
        self._title_lbl.setStyleSheet(
            "color: #F0F6FC; font-size: 20px; font-weight: bold;"
        )
        title_layout.addWidget(self._title_lbl)

        self._subtitle_lbl = QLabel(tr("outbound.subtitle"))
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

        # Yeni Stok Çıkışı Butonu
        self._add_btn = QPushButton(tr("outbound.add_new"))
        self._add_btn.setStyleSheet(
            "background-color: #238636; color: white; padding: 8px 16px; "
            "border-radius: 6px; font-weight: bold;"
        )
        self._add_btn.setCursor(Qt.PointingHandCursor)
        self._add_btn.clicked.connect(self._add_outbound_stock)
        header_layout.addWidget(self._add_btn)

        self._layout.addLayout(header_layout)

        # Çıkış kayıtları tablosu
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
        """Sayfa her gösterildiğinde stok çıkış listesini yeniler."""
        super().showEvent(event)
        self._load_entries()

    def _update_headers(self):
        self._table.setHorizontalHeaderLabels(
            [
                tr("table.part_name"),
                tr("table.location"),
                tr("table.quantity"),
                tr("outbound.destination"),
                tr("outbound.date"),
                tr("inbound.created_by"),
            ]
        )

    def _load_entries(self):
        """Mevcut stok çıkışlarını PostgreSQL'den çeker."""
        self._update_headers()
        self._table.clearContents()

        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                rows = db.execute(text("""
                    SELECT p.name, l.name, e.quantity, e.destination, e.created_at, e.created_by
                    FROM warehouse.outbound_entries e
                    JOIN warehouse.parts p ON e.part_id = p.id
                    JOIN warehouse.locations l ON e.location_id = l.id
                    ORDER BY e.created_at DESC;
                """)).fetchall()

                self._table.setRowCount(len(rows))
                for r_idx, row in enumerate(rows):
                    self._table.setItem(r_idx, 0, QTableWidgetItem(str(row[0])))
                    self._table.setItem(r_idx, 1, QTableWidgetItem(str(row[1])))
                    self._table.setItem(r_idx, 2, QTableWidgetItem(str(row[2])))
                    self._table.setItem(r_idx, 3, QTableWidgetItem(str(row[3])))
                    self._table.setItem(r_idx, 4, QTableWidgetItem(str(row[4])[:16]))
                    self._table.setItem(r_idx, 5, QTableWidgetItem(str(row[5])))
                    self._table.setRowHeight(r_idx, 44)
            finally:
                db.close()
        except Exception as e:
            print(f"[Error Loading Outbounds] {e}")

    def _add_outbound_stock(self):
        """Stok çıkış formunu açar ve kaydeder."""
        dialog = AddOutboundStockDialog(self)
        if dialog.exec() == QDialog.Accepted:
            combo_data = dialog.stock_combo.currentData()
            if not combo_data:
                return

            stock_id, part_id, location_id, max_qty = combo_data
            qty = dialog.qty_spin.value()
            dest = dialog.dest_input.text().strip()
            created_by = "depocu_1"

            if not dest:
                QMessageBox.warning(self, "Hata", "Lütfen bir alıcı/hedef girin.")
                return

            if qty > max_qty:
                QMessageBox.warning(self, "Hata", tr("outbound.insufficient_stock"))
                return

            try:
                from config.database import SessionLocal
                from sqlalchemy import text

                db = SessionLocal()
                try:
                    # 1. Depo Çıkış Kaydı (inbound_entries benzeri)
                    db.execute(
                        text("""
                        INSERT INTO warehouse.outbound_entries (part_id, location_id, quantity, destination, created_by)
                        VALUES (:part_id, :loc_id, :qty, :dest, :created_by);
                    """),
                        {
                            "part_id": part_id,
                            "loc_id": location_id,
                            "qty": qty,
                            "dest": dest,
                            "created_by": created_by,
                        },
                    )

                    # 2. Stoktan Düş
                    db.execute(
                        text("""
                        UPDATE warehouse.stock SET quantity = quantity - :qty WHERE id = :id;
                    """),
                        {"qty": qty, "id": stock_id},
                    )

                    # 3. Stok Hareket Kaydı
                    db.execute(
                        text("""
                        INSERT INTO warehouse.stock_movements (type, quantity)
                        VALUES ('Outbound', :qty);
                    """),
                        {"qty": qty},
                    )

                    db.commit()
                    QMessageBox.information(self, "Başarılı", tr("outbound.success"))
                finally:
                    db.close()

                self._load_entries()
            except Exception as e:
                QMessageBox.critical(self, "Hata", f"Stok çıkışı kaydedilemedi: {e}")

    def _import_excel(self):
        """Excel'den veri aktarımı tetikler (sütun eşleştirme ile)."""
        from ui.excel_utils import import_excel_flow

        db_cols = ["part_id", "location_id", "quantity", "destination", "created_by"]
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
                    part_id_raw = row.get("part_id")
                    if pd.isna(part_id_raw):
                        continue
                    part_id = int(part_id_raw)

                    loc_id_raw = row.get("location_id")
                    if pd.isna(loc_id_raw):
                        continue
                    loc_id = int(loc_id_raw)

                    qty_raw = row.get("quantity")
                    qty = int(qty_raw) if not pd.isna(qty_raw) else 0
                    if qty <= 0:
                        continue

                    dest_raw = row.get("destination")
                    dest = str(dest_raw) if not pd.isna(dest_raw) else "excel_outbound"

                    created_by_raw = row.get("created_by")
                    created_by = (
                        str(created_by_raw)
                        if not pd.isna(created_by_raw)
                        else "excel_import"
                    )

                    # Stok kontrolü yapalım
                    existing = db.execute(
                        text("""
                        SELECT id, quantity FROM warehouse.stock 
                        WHERE part_id = :part_id AND location_id = :loc_id;
                    """),
                        {"part_id": part_id, "loc_id": loc_id},
                    ).fetchone()

                    if not existing or existing[1] < qty:
                        # Stok yetersizse bu satırı atla
                        continue

                    # 1. Outbound Giriş Kaydını Oluştur
                    db.execute(
                        text("""
                        INSERT INTO warehouse.outbound_entries (part_id, location_id, quantity, destination, created_by)
                        VALUES (:part_id, :loc_id, :qty, :dest, :created_by);
                    """),
                        {
                            "part_id": part_id,
                            "loc_id": loc_id,
                            "qty": qty,
                            "dest": dest,
                            "created_by": created_by,
                        },
                    )

                    # 2. Stoktan Düş
                    db.execute(
                        text("""
                        UPDATE warehouse.stock SET quantity = quantity - :qty WHERE id = :id;
                    """),
                        {"qty": qty, "id": existing[0]},
                    )

                    # 3. Stok Hareket Kaydı
                    db.execute(
                        text("""
                        INSERT INTO warehouse.stock_movements (type, quantity)
                        VALUES ('Outbound', :qty);
                    """),
                        {"qty": qty},
                    )

                db.commit()
            finally:
                db.close()
            self._load_entries()
        except Exception as e:
            QMessageBox.critical(
                self, "Hata", f"Veriler veritabanına kaydedilemedi: {e}"
            )

    def _export_excel(self):
        """Mevcut depo çıkış kayıtlarını Excel'e aktarır."""
        from ui.excel_utils import export_excel_flow

        data = []
        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                rows = db.execute(text("""
                    SELECT p.name, l.name, e.quantity, e.destination, e.created_at, e.created_by
                    FROM warehouse.outbound_entries e
                    JOIN warehouse.parts p ON e.part_id = p.id
                    JOIN warehouse.locations l ON e.location_id = l.id
                    ORDER BY e.created_at DESC;
                """)).fetchall()
                for r in rows:
                    data.append(
                        {
                            "Parça Adı": r[0],
                            "Lokasyon": r[1],
                            "Miktar": r[2],
                            "Alıcı/Müşteri": r[3],
                            "Tarih": str(r[4]),
                            "İşlemi Yapan": r[5],
                        }
                    )
            finally:
                db.close()
        except Exception as e:
            print(e)

        export_excel_flow(self, data, "Outbound_Entries.xlsx")

    def _retranslate(self):
        """Dili günceller."""
        if hasattr(self, "_title_lbl"):
            self._title_lbl.setText(tr("outbound.title"))
            self._subtitle_lbl.setText(tr("outbound.subtitle"))
            self._add_btn.setText(tr("outbound.add_new"))
            self._import_btn.setText(tr("excel.import"))
            self._export_btn.setText(tr("excel.export"))
            self._load_entries()
