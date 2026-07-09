"""
RemaLab WMS - Warehouse Page
Depodaki parça stok durumu ve lokasyonlar arası stok transfer işlemleri.
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
    QProgressBar,
    QTabWidget,
)
from PySide6.QtCore import Qt
from ui.translations import tr, get_translator
from services.stock_service import StockService
from services.exceptions import InsufficientStockError, ServiceError


class StockTransferDialog(QDialog):
    """Stok transfer diyaloğu."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle(tr("warehouse.transfer_stock"))
        self.setMinimumWidth(400)
        self

        layout = QVBoxLayout(self)

        # 1. Kaynak Lokasyon & Parça seçimi
        lbl1 = QLabel(tr("warehouse.source_location") + " (Stok Satırı)")
        lbl1
        layout.addWidget(lbl1)

        self.source_combo = QComboBox()
        self.source_combo
        layout.addWidget(self.source_combo)

        # 2. Hedef Lokasyon
        lbl2 = QLabel(tr("warehouse.target_location"))
        lbl2
        layout.addWidget(lbl2)

        self.target_combo = QComboBox()
        self.target_combo
        layout.addWidget(self.target_combo)

        # 3. Miktar
        lbl3 = QLabel(tr("warehouse.transfer_quantity"))
        lbl3
        layout.addWidget(lbl3)

        self.qty_spin = QSpinBox()
        self.qty_spin.setRange(1, 99999)
        self.qty_spin
        layout.addWidget(self.qty_spin)

        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel, self)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)

        buttons.button(QDialogButtonBox.Ok).setText(tr("warehouse.transfer_stock"))
        buttons.button(QDialogButtonBox.Ok)
        buttons.button(QDialogButtonBox.Cancel).setText(tr("db.cancel"))
        buttons.button(QDialogButtonBox.Cancel)

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
                    self.source_combo.addItem(
                        f"{row[1]} ({row[2]}) - Mevcut: {row[3]} adet", row[0]
                    )

                # 2. Lokasyonlar
                lokasyonlar = db.execute(
                    text("SELECT id, name FROM warehouse.locations;")
                ).fetchall()
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
        self.service = StockService()
        self._setup_ui()
        get_translator().language_changed.connect(self._retranslate)

    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        
        self.tabs = QTabWidget()
        self.tabs
        
        # Sekme 1: Stok Durumu (Eski içerik)
        tab_warehouse = QWidget()
        tab_warehouse_layout = QVBoxLayout(tab_warehouse)
        tab_warehouse_layout.setContentsMargins(28, 28, 28, 28)
        tab_warehouse_layout.setSpacing(16)

        # Üst Başlık
        header_layout = QHBoxLayout()
        title_section = QWidget()
        title_layout = QVBoxLayout(title_section)
        title_layout.setContentsMargins(0, 0, 0, 0)
        title_layout.setSpacing(4)

        self._title_lbl = QLabel(tr("warehouse.title"))
        self._title_lbl
        title_layout.addWidget(self._title_lbl)

        self._subtitle_lbl = QLabel(tr("warehouse.subtitle"))
        self._subtitle_lbl
        title_layout.addWidget(self._subtitle_lbl)

        header_layout.addWidget(title_section)
        header_layout.addStretch()

        # Stok Transfer Butonu
        self._transfer_btn = QPushButton(f"↻ {tr('warehouse.transfer_stock')}")
        self._transfer_btn.setObjectName("btn_warning")
        self._transfer_btn.setCursor(Qt.PointingHandCursor)
        self._transfer_btn.clicked.connect(self._transfer_stock)
        header_layout.addWidget(self._transfer_btn)

        tab_warehouse_layout.addLayout(header_layout)

        # Depo Doluluk Oranı Barı (Progress Bar)
        occupancy_section = QHBoxLayout()
        self._occ_lbl = QLabel("Depo Genel Doluluk Oranı:")
        self._occ_lbl
        occupancy_section.addWidget(self._occ_lbl)

        self._progress = QProgressBar()
        self._progress.setRange(0, 100)
        self._progress.setValue(0)
        self._progress.setTextVisible(True)
        self._progress
        occupancy_section.addWidget(self._progress)
        tab_warehouse_layout.addLayout(occupancy_section)

        # Arama Çubuğu
        search_layout = QHBoxLayout()
        search_layout.setContentsMargins(0, 0, 0, 0)
        self._search_input = QLineEdit()
        self._search_input.setPlaceholderText("Ara (ID, Parça Adı, Lokasyon)...")
        self._search_input.textChanged.connect(self._load_stock)
        search_layout.addWidget(self._search_input)
        tab_warehouse_layout.addLayout(search_layout)

        # Depo Stok Tablosu
        self._table = QTableWidget()
        self._table.setColumnCount(4)
        self._table.setAlternatingRowColors(True)
        self._table.verticalHeader().setVisible(False)
        self._table.setSelectionBehavior(QTableWidget.SelectRows)
        self._table.setEditTriggers(QTableWidget.NoEditTriggers)
        self._table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        tab_warehouse_layout.addWidget(self._table)
        
        self.tabs.addTab(tab_warehouse, "Stok Durumu & Transfer")
        
        # Sekme 2: Stok Sayım (InventoryPage)
        from ui.inventory_page import InventoryPage
        self.inventory_page = InventoryPage()
        self.tabs.addTab(self.inventory_page, tr("nav.inventory"))
        
        layout.addWidget(self.tabs)

        self._load_stock()

    def _update_headers(self):
        self._table.setHorizontalHeaderLabels(
            [
                tr("table.part_name"),
                tr("table.location"),
                tr("table.stock_quantity"),
                tr("table.status"),
            ]
        )

    def showEvent(self, event):
        """Depo sayfası her görüntülendiğinde tetiklenir."""
        super().showEvent(event)
        self._load_stock()

    def _load_stock(self):
        """Depo stok durumunu listeler ve doluluk oranını günceller."""
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
                    SELECT s.id, p.name, l.name, s.quantity
                    FROM warehouse.stock s
                    JOIN warehouse.parts p ON s.part_id = p.id
                    JOIN warehouse.locations l ON s.location_id = l.id
                """
                params = {}

                if search_q:
                    sql += " WHERE p.name ILIKE :q OR l.name ILIKE :q OR CAST(s.id AS VARCHAR) ILIKE :q"
                    params["q"] = f"%{search_q}%"

                sql += " ORDER BY s.id DESC;"

                rows = db.execute(text(sql), params).fetchall()

                self._table.setRowCount(len(rows))

                total_qty = 0
                for r_idx, row in enumerate(rows):
                    p_item = QTableWidgetItem(str(row[1]))
                    p_item.setFlags(p_item.flags() & ~Qt.ItemIsEditable)

                    l_item = QTableWidgetItem(str(row[2]))
                    l_item.setFlags(l_item.flags() & ~Qt.ItemIsEditable)

                    q_item = QTableWidgetItem(str(row[3]))
                    q_item.setData(Qt.UserRole, row[0])  # Stock ID sakla

                    status_str = (
                        tr("status.pending") if row[3] < 5 else tr("status.completed")
                    )
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
                self.service.transfer(source_stock_id, target_location_id, transfer_qty)
                QMessageBox.information(
                    self, "Başarılı", tr("warehouse.transfer_success")
                )
                self._load_stock()
            except InsufficientStockError:
                QMessageBox.warning(self, "Hata", tr("warehouse.insufficient_stock"))
            except ServiceError as e:
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
            self.service.set_quantity(stock_id, new_qty)
            self._load_stock()
        except ServiceError as e:
            QMessageBox.critical(self, "Hata", f"Güncelleme başarısız: {e}")
            self._load_stock()

    def _retranslate(self):
        """Dil yeniler."""
        self._title_lbl.setText(tr("warehouse.title"))
        self._subtitle_lbl.setText(tr("warehouse.subtitle"))
        self._transfer_btn.setText(tr("warehouse.transfer_stock"))
        self._load_stock()
