"""
RemaLab WMS - Warehouse Page
Depodaki parça stok durumu ve lokasyonlar arası stok transfer işlemleri.
"""

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QTableWidget, QTableWidgetItem, QPushButton,
    QHeaderView, QMessageBox, QDialog, QComboBox,
    QSpinBox, QDialogButtonBox, QProgressBar
)
from PySide6.QtCore import Qt
from ui.translations import tr, get_translator


class StockTransferDialog(QDialog):
    """Stok transfer diyaloğu."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle(tr("warehouse.transfer_stock"))
        self.setMinimumWidth(400)
        self.setStyleSheet("background-color: #0D1117; color: #F0F6FC;")

        layout = QVBoxLayout(self)

        # 1. Kaynak Lokasyon & Parça seçimi
        lbl1 = QLabel(tr("warehouse.source_location") + " (Stok Satırı)")
        lbl1.setStyleSheet("color: #8B949E; font-weight: bold;")
        layout.addWidget(lbl1)

        self.source_combo = QComboBox()
        self.source_combo.setStyleSheet(
            "background-color: #161B22; border: 1px solid #30363D; padding: 6px; color: #F0F6FC;"
        )
        layout.addWidget(self.source_combo)

        # 2. Hedef Lokasyon
        lbl2 = QLabel(tr("warehouse.target_location"))
        lbl2.setStyleSheet("color: #8B949E; font-weight: bold;")
        layout.addWidget(lbl2)

        self.target_combo = QComboBox()
        self.target_combo.setStyleSheet(
            "background-color: #161B22; border: 1px solid #30363D; padding: 6px; color: #F0F6FC;"
        )
        layout.addWidget(self.target_combo)

        # 3. Miktar
        lbl3 = QLabel(tr("warehouse.transfer_quantity"))
        lbl3.setStyleSheet("color: #8B949E; font-weight: bold;")
        layout.addWidget(lbl3)

        self.qty_spin = QSpinBox()
        self.qty_spin.setRange(1, 99999)
        self.qty_spin.setStyleSheet(
            "background-color: #161B22; border: 1px solid #30363D; padding: 6px; color: #F0F6FC;"
        )
        layout.addWidget(self.qty_spin)

        buttons = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel, self
        )
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        
        buttons.button(QDialogButtonBox.Ok).setText(tr("warehouse.transfer_stock"))
        buttons.button(QDialogButtonBox.Ok).setStyleSheet("background-color: #1F6FEB; color: white; padding: 6px 12px; border-radius: 4px;")
        buttons.button(QDialogButtonBox.Cancel).setText(tr("db.cancel"))
        buttons.button(QDialogButtonBox.Cancel).setStyleSheet("background-color: #21262D; color: #8B949E; padding: 6px 12px; border-radius: 4px;")
        
        layout.addWidget(buttons)

        self._load_combos()

    def _load_combos(self):
        """Komboboxları doldurur."""
        try:
            from config.database import SessionLocal
            from sqlalchemy import text
            db = SessionLocal()
            try:
                # 1. Kaynak Stoklar
                stoklar = db.execute(text("""
                    SELECT s.id, p.name, l.name, s.quantity
                    FROM warehouse.stock s
                    JOIN warehouse.parts p ON s.part_id = p.id
                    JOIN warehouse.locations l ON s.location_id = l.id
                    WHERE s.quantity > 0;
                """)).fetchall()
                
                for row in stoklar:
                    # id'yi verisi olarak sakla
                    self.source_combo.addItem(f"{row[1]} ({row[2]}) - Mevcut: {row[3]} adet", row[0])

                # 2. Lokasyonlar
                lokasyonlar = db.execute(text("SELECT id, name FROM warehouse.locations;")).fetchall()
                for row in lokasyonlar:
                    self.target_combo.addItem(row[1], row[0])
            finally:
                db.close()
        except Exception as e:
            print(f"[Error Loading Combo Boxes] {e}")


class WarehousePage(QWidget):
    """Depo modülü."""

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

        self._title_lbl = QLabel(tr("warehouse.title"))
        self._title_lbl.setStyleSheet("color: #F0F6FC; font-size: 20px; font-weight: bold;")
        title_layout.addWidget(self._title_lbl)

        self._subtitle_lbl = QLabel(tr("warehouse.subtitle"))
        self._subtitle_lbl.setStyleSheet("color: #8B949E; font-size: 13px;")
        title_layout.addWidget(self._subtitle_lbl)

        header_layout.addWidget(title_section)
        header_layout.addStretch()

        # Stok Transfer Butonu
        self._transfer_btn = QPushButton(tr("warehouse.transfer_stock"))
        self._transfer_btn.setStyleSheet(
            "background-color: #1F6FEB; color: white; padding: 8px 16px; "
            "border-radius: 6px; font-weight: bold;"
        )
        self._transfer_btn.setCursor(Qt.PointingHandCursor)
        self._transfer_btn.clicked.connect(self._transfer_stock)
        header_layout.addWidget(self._transfer_btn)

        layout.addLayout(header_layout)

        # Depo Doluluk Oranı Barı (Progress Bar)
        occupancy_section = QHBoxLayout()
        self._occ_lbl = QLabel("Depo Genel Doluluk Oranı:")
        self._occ_lbl.setStyleSheet("color: #8B949E; font-size: 13px; font-weight: bold;")
        occupancy_section.addWidget(self._occ_lbl)

        self._progress = QProgressBar()
        self._progress.setRange(0, 100)
        self._progress.setValue(0)
        self._progress.setTextVisible(True)
        self._progress.setStyleSheet("""
            QProgressBar {
                border: 1px solid #30363D;
                border-radius: 6px;
                background-color: #161B22;
                text-align: center;
                color: white;
                font-weight: bold;
                height: 20px;
            }
            QProgressBar::chunk {
                background-color: #238636;
                border-radius: 5px;
            }
        """)
        occupancy_section.addWidget(self._progress)
        layout.addLayout(occupancy_section)

        # Depo Stok Tablosu
        self._table = QTableWidget()
        self._table.setColumnCount(4)
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

        self._load_stock()

    def _update_headers(self):
        self._table.setHorizontalHeaderLabels([
            tr("table.part_name"),
            tr("table.location"),
            tr("table.stock_quantity"),
            tr("table.status")
        ])

    def showEvent(self, event):
        """Depo sayfası her görüntülendiğinde tetiklenir."""
        super().showEvent(event)
        self._load_stock()

    def _load_stock(self):
        """Depo stok durumunu listeler ve doluluk oranını günceller."""
        self._table.blockSignals(True)
        self._update_headers()
        self._table.clearContents()

        try:
            from config.database import SessionLocal
            from sqlalchemy import text
            db = SessionLocal()
            try:
                rows = db.execute(text("""
                    SELECT s.id, p.name, l.name, s.quantity
                    FROM warehouse.stock s
                    JOIN warehouse.parts p ON s.part_id = p.id
                    JOIN warehouse.locations l ON s.location_id = l.id
                    ORDER BY s.id DESC;
                """)).fetchall()

                self._table.setRowCount(len(rows))
                
                total_qty = 0
                for r_idx, row in enumerate(rows):
                    p_item = QTableWidgetItem(str(row[1]))
                    p_item.setFlags(p_item.flags() & ~Qt.ItemIsEditable)

                    l_item = QTableWidgetItem(str(row[2]))
                    l_item.setFlags(l_item.flags() & ~Qt.ItemIsEditable)

                    q_item = QTableWidgetItem(str(row[3]))
                    q_item.setData(Qt.UserRole, row[0])  # Stock ID sakla

                    status_str = tr("status.pending") if row[3] < 5 else tr("status.completed")
                    status_item = QTableWidgetItem(status_str)
                    status_item.setFlags(status_item.flags() & ~Qt.ItemIsEditable)

                    self._table.setItem(r_idx, 0, p_item)
                    self._table.setItem(r_idx, 1, l_item)
                    self._table.setItem(r_idx, 2, q_item)
                    self._table.setItem(r_idx, 3, status_item)
                    self._table.setRowHeight(r_idx, 44)

                    total_qty += row[3]

                # Depo Kapasitesi (Örnek maksimum 1000 adet parça baz alınarak)
                max_capacity = 1000
                percentage = min(int((total_qty / max_capacity) * 100), 100)
                self._progress.setValue(percentage)
            finally:
                db.close()
        except Exception as e:
            print(f"[Error Loading Stock] {e}")
        finally:
            self._table.blockSignals(False)

    def _transfer_stock(self):
        """Stok transfer operasyonu."""
        dialog = StockTransferDialog(self)
        if dialog.exec() == QDialog.Accepted:
            source_stock_id = dialog.source_combo.currentData()
            target_location_id = dialog.target_combo.currentData()
            transfer_qty = dialog.qty_spin.value()

            if source_stock_id is None or target_location_id is None:
                return

            try:
                from config.database import SessionLocal
                from sqlalchemy import text
                db = SessionLocal()
                try:
                    # 1. Kaynak satırı oku
                    source = db.execute(
                        text("SELECT part_id, quantity FROM warehouse.stock WHERE id = :id;"),
                        {"id": source_stock_id}
                    ).fetchone()

                    if not source or source[1] < transfer_qty:
                        QMessageBox.warning(self, "Hata", tr("warehouse.insufficient_stock"))
                        return

                    # 2. Kaynağı azalt
                    db.execute(
                        text("UPDATE warehouse.stock SET quantity = quantity - :qty WHERE id = :id;"),
                        {"qty": transfer_qty, "id": source_stock_id}
                    )

                    # 3. Hedefe ekle (eğer aynı parça hedef lokasyonda varsa güncelle, yoksa ekle)
                    part_id = source[0]
                    target_stock = db.execute(
                        text("SELECT id FROM warehouse.stock WHERE part_id = :p_id AND location_id = :l_id;"),
                        {"p_id": part_id, "l_id": target_location_id}
                    ).fetchone()

                    if target_stock:
                        db.execute(
                            text("UPDATE warehouse.stock SET quantity = quantity + :qty WHERE id = :id;"),
                            {"qty": transfer_qty, "id": target_stock[0]}
                        )
                    else:
                        db.execute(
                            text("INSERT INTO warehouse.stock (part_id, location_id, quantity) VALUES (:p_id, :l_id, :qty);"),
                            {"p_id": part_id, "l_id": target_location_id, "qty": transfer_qty}
                        )

                    # 4. Hareket kaydı (stock_movements) oluştur
                    db.execute(
                        text("INSERT INTO warehouse.stock_movements (type, quantity) VALUES ('Transfer', :qty);"),
                        {"qty": transfer_qty}
                    )

                    db.commit()
                    QMessageBox.information(self, "Başarılı", tr("warehouse.transfer_success"))
                finally:
                    db.close()
                self._load_stock()
            except Exception as e:
                QMessageBox.critical(self, "Hata", f"Stok transfer edilemedi: {e}")

    def _on_item_changed(self, item: QTableWidgetItem):
        """Satır içi stok miktarı güncelleme."""
        stock_id = item.data(Qt.UserRole)
        if stock_id is None:
            return

        try:
            new_qty = int(item.text().strip())
        except ValueError:
            self._load_stock()
            return

        try:
            from config.database import SessionLocal
            from sqlalchemy import text
            db = SessionLocal()
            try:
                db.execute(
                    text("UPDATE warehouse.stock SET quantity = :qty WHERE id = :id;"),
                    {"qty": new_qty, "id": stock_id}
                )
                db.commit()
            finally:
                db.close()
            self._load_stock()
        except Exception as e:
            QMessageBox.critical(self, "Hata", f"Güncelleme başarısız: {e}")
            self._load_stock()

    def _retranslate(self):
        """Dil yeniler."""
        self._title_lbl.setText(tr("warehouse.title"))
        self._subtitle_lbl.setText(tr("warehouse.subtitle"))
        self._transfer_btn.setText(tr("warehouse.transfer_stock"))
        self._load_stock()
