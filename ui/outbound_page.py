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
    QCompleter,
    QScrollArea,
)
from PySide6.QtCore import Qt
from ui.translations import tr, get_translator
from services.outbound_service import OutboundService
from services.exceptions import InsufficientStockError, ServiceError


class SelectAllSpinBox(QSpinBox):
    """Odaklanınca mevcut metni seçili hale getirir; böylece yeni yazılan rakam
    sona eklenmek yerine üzerine yazılır (yüksek miktarlarda hane kısıtlaması
    yaşanmasını önler)."""

    def focusInEvent(self, event):
        super().focusInEvent(event)
        self.selectAll()

    def mousePressEvent(self, event):
        super().mousePressEvent(event)
        self.selectAll()


OUTBOUND_TYPES = [
    "Teknik Servis",
    "Müşteri Satışı",
    "Şubeler Arası Transfer",
    "Tedarikçiye İade",
    "Hurda / Arızalı",
    "Sayım Eksiği",
    "Manuel Çıkış",
]


class AddOutboundStockDialog(QDialog):
    """Yeni stok çıkış formu modal diyalog."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle(tr("outbound.add_new"))
        self.setMinimumWidth(480)
        self.setMinimumHeight(560)

        self._selected_part_id = None

        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(0, 0, 0, 0)

        scroll = QScrollArea(self)
        scroll.setWidgetResizable(True)
        scroll.setStyleSheet(
            "QScrollArea { border: none; background-color: transparent; }"
        )

        container = QWidget()
        layout = QVBoxLayout(container)
        layout.setSpacing(14)
        layout.setContentsMargins(20, 20, 20, 10)

        scroll.setWidget(container)
        main_layout.addWidget(scroll)

        # ── 1. Barkod ─────────────────────────────────────────────────────────
        lbl_barcode = QLabel("📋  Barkod (okutun ve Enter'a basın)")
        lbl_barcode.setStyleSheet("font-weight: bold; color: #58A6FF;")
        layout.addWidget(lbl_barcode)

        bc_row = QHBoxLayout()
        self.barcode_input = QLineEdit()
        self.barcode_input.setPlaceholderText("Barkodu okutun veya manuel girin...")
        self.barcode_input.returnPressed.connect(self._on_barcode_scanned)
        bc_row.addWidget(self.barcode_input)

        bc_btn = QPushButton("🔍")
        bc_btn.setFixedWidth(40)
        bc_btn.setCursor(Qt.PointingHandCursor)
        bc_btn.setToolTip("Barkodu ara")
        bc_btn.clicked.connect(self._on_barcode_scanned)
        bc_row.addWidget(bc_btn)
        layout.addLayout(bc_row)

        self.status_lbl = QLabel("")
        self.status_lbl.setStyleSheet("color: #8B949E; font-style: italic;")
        layout.addWidget(self.status_lbl)

        sep = QLabel("─" * 55)
        sep.setStyleSheet("color: #30363D;")
        layout.addWidget(sep)

        # ── 2. Marka / Model / Parça (hiyerarşik) ───────────────────────────
        lbl_brand = QLabel("Marka")
        layout.addWidget(lbl_brand)
        self.brand_combo = QComboBox()
        self.brand_combo.setStyleSheet(self._combo_style())
        self.brand_combo.currentIndexChanged.connect(self._on_brand_changed)
        layout.addWidget(self.brand_combo)

        lbl_model = QLabel("Telefon Modeli")
        layout.addWidget(lbl_model)
        self.model_combo = QComboBox()
        self.model_combo.setStyleSheet(self._combo_style())
        self.model_combo.currentIndexChanged.connect(self._on_model_changed)
        layout.addWidget(self.model_combo)

        lbl_part = QLabel(tr("parts.part_name") + " / Parça")
        layout.addWidget(lbl_part)
        self.part_combo = QComboBox()
        self.part_combo.setStyleSheet(self._combo_style())
        self.part_combo.setEditable(True)
        self.part_combo.setInsertPolicy(QComboBox.NoInsert)
        if self.part_combo.completer():
            self.part_combo.completer().setCompletionMode(QCompleter.PopupCompletion)
            self.part_combo.completer().setFilterMode(Qt.MatchContains)
        self.part_combo.currentIndexChanged.connect(self._on_part_selected)
        layout.addWidget(self.part_combo)

        # ── 3. Kaynak Lokasyon (raf) ─────────────────────────────────────────
        lbl_source = QLabel("Kaynak Lokasyon (Raf)")
        layout.addWidget(lbl_source)
        self.source_combo = QComboBox()
        self.source_combo.setStyleSheet(self._combo_style())
        self.source_combo.currentIndexChanged.connect(self._on_source_changed)
        layout.addWidget(self.source_combo)

        # ── 4. Çıkış Miktarı ──────────────────────────────────────────────────
        lbl_qty = QLabel(tr("table.quantity"))
        layout.addWidget(lbl_qty)
        self.qty_spin = SelectAllSpinBox()
        self.qty_spin.setRange(0, 0)
        layout.addWidget(self.qty_spin)

        # ── 5. Çıkış Tipi ─────────────────────────────────────────────────────
        lbl_type = QLabel("Çıkış Tipi")
        layout.addWidget(lbl_type)
        self.type_combo = QComboBox()
        self.type_combo.setStyleSheet(self._combo_style())
        for t in OUTBOUND_TYPES:
            self.type_combo.addItem(t, t)
        self.type_combo.currentIndexChanged.connect(self._on_type_changed)
        layout.addWidget(self.type_combo)

        # ── 6. Çıkış tipine göre değişen hedef alanları ─────────────────────
        self.lbl_technician = QLabel("Teknisyen")
        layout.addWidget(self.lbl_technician)
        self.technician_combo = QComboBox()
        self.technician_combo.setStyleSheet(self._combo_style())
        layout.addWidget(self.technician_combo)

        self.lbl_customer = QLabel("Müşteri Adı")
        layout.addWidget(self.lbl_customer)
        self.customer_input = QLineEdit()
        self.customer_input.setPlaceholderText("Müşteri adını girin...")
        layout.addWidget(self.customer_input)

        self.lbl_transfer_loc = QLabel("Hedef Depo / Lokasyon")
        layout.addWidget(self.lbl_transfer_loc)
        self.transfer_loc_combo = QComboBox()
        self.transfer_loc_combo.setStyleSheet(self._combo_style())
        layout.addWidget(self.transfer_loc_combo)

        self.lbl_supplier = QLabel("Tedarikçi")
        layout.addWidget(self.lbl_supplier)
        self.supplier_input = QLineEdit()
        self.supplier_input.setPlaceholderText("Tedarikçi adı...")
        layout.addWidget(self.supplier_input)

        self.lbl_manual = QLabel("Hedef / Not")
        layout.addWidget(self.lbl_manual)
        self.manual_input = QLineEdit()
        self.manual_input.setPlaceholderText("İsteğe bağlı...")
        layout.addWidget(self.manual_input)

        # ── 7. Açıklama ───────────────────────────────────────────────────────
        lbl_desc = QLabel("Açıklama")
        layout.addWidget(lbl_desc)
        self.description_input = QLineEdit()
        self.description_input.setPlaceholderText("İsteğe bağlı açıklama...")
        layout.addWidget(self.description_input)

        layout.addStretch()

        # Butonlar
        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel, self)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        buttons.button(QDialogButtonBox.Ok).setText(tr("db.save"))
        buttons.button(QDialogButtonBox.Cancel).setText(tr("db.cancel"))

        btn_wrapper = QWidget()
        btn_layout = QHBoxLayout(btn_wrapper)
        btn_layout.setContentsMargins(20, 0, 20, 16)
        btn_layout.addWidget(buttons)
        main_layout.addWidget(btn_wrapper)

        self._load_combos()
        self._load_technicians()
        self._load_transfer_locations()
        self._on_type_changed()
        self.barcode_input.setFocus()

    # ── Stil ─────────────────────────────────────────────────────────────────
    def _combo_style(self):
        return (
            "QComboBox { background-color: #161B22; border: 1px solid #30363D; "
            "padding: 8px; color: #F0F6FC; border-radius: 4px; } "
            "QComboBox QAbstractItemView { background-color: #161B22; color: #F0F6FC; "
            "selection-background-color: #1F6FEB; } "
            "QLineEdit { background-color: #161B22; color: #F0F6FC; border: none; padding: 0px; }"
        )

    # ── Marka / Model / Parça combo yükleme ─────────────────────────────────
    def _load_combos(self, select_part_id: int = None):
        for cb in [self.brand_combo, self.model_combo, self.part_combo]:
            cb.blockSignals(True)
            cb.clear()
            cb.blockSignals(False)

        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                brands = db.execute(text("""
                    SELECT DISTINCT brand FROM warehouse.parts
                    WHERE brand IS NOT NULL AND brand <> ''
                    ORDER BY brand;
                """)).fetchall()

                self.brand_combo.blockSignals(True)
                self.brand_combo.addItem("Marka seçiniz...", "")
                for (b,) in brands:
                    self.brand_combo.addItem(b, b)
                self.brand_combo.blockSignals(False)

                if select_part_id:
                    self._select_part_hierarchy(select_part_id)
            finally:
                db.close()
        except Exception as e:
            print(f"[Dialog] Combo yüklenemedi: {e}")

    def _on_brand_changed(self, index):
        for cb in [self.model_combo, self.part_combo]:
            cb.blockSignals(True)
            cb.clear()
            cb.blockSignals(False)
        self._selected_part_id = None
        self.source_combo.clear()

        brand = self.brand_combo.itemData(index)
        if not brand:
            return

        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                models = db.execute(
                    text("""
                    SELECT DISTINCT model FROM warehouse.parts
                    WHERE brand = :brand AND model IS NOT NULL AND model <> ''
                    ORDER BY model;
                """),
                    {"brand": brand},
                ).fetchall()

                self.model_combo.blockSignals(True)
                self.model_combo.addItem("Model seçiniz...", "")
                for (m,) in models:
                    self.model_combo.addItem(m, m)
                self.model_combo.blockSignals(False)

                if not models:
                    self._load_parts_for(brand=brand, model=None)
            finally:
                db.close()
        except Exception as e:
            print(f"[Dialog] Model yüklenemedi: {e}")

    def _on_model_changed(self, index):
        self.part_combo.blockSignals(True)
        self.part_combo.clear()
        self.part_combo.blockSignals(False)
        self._selected_part_id = None
        self.source_combo.clear()

        brand = self.brand_combo.currentData()
        model = self.model_combo.itemData(index)
        if not brand or not model:
            return

        self._load_parts_for(brand=brand, model=model)

    def _load_parts_for(self, brand: str, model):
        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                if model:
                    rows = db.execute(
                        text("""
                        SELECT id, name FROM warehouse.parts
                        WHERE brand = :brand AND model = :model
                        ORDER BY name;
                    """),
                        {"brand": brand, "model": model},
                    ).fetchall()
                else:
                    rows = db.execute(
                        text("""
                        SELECT id, name FROM warehouse.parts
                        WHERE brand = :brand
                        ORDER BY name;
                    """),
                        {"brand": brand},
                    ).fetchall()

                self.part_combo.blockSignals(True)
                self.part_combo.addItem("Parça seçiniz...", None)
                for p_id, p_name in rows:
                    self.part_combo.addItem(p_name, p_id)
                self.part_combo.blockSignals(False)
            finally:
                db.close()
        except Exception as e:
            print(f"[Dialog] Parça yüklenemedi: {e}")

    def _on_part_selected(self, index):
        part_id = self.part_combo.itemData(index)
        if not part_id:
            self._selected_part_id = None
            self.source_combo.clear()
            return
        self._selected_part_id = part_id
        self._load_source_combo()
        if self.type_combo.currentData() == "Tedarikçiye İade":
            self._fill_supplier_from_part()

    def _select_part_hierarchy(self, part_id: int):
        """Barkod okununca önce combo'ları doldurur sonra seçer."""
        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                part = db.execute(
                    text("SELECT brand, model FROM warehouse.parts WHERE id = :id;"),
                    {"id": part_id},
                ).fetchone()

                if not part:
                    return

                brand = part[0] or ""
                model = part[1] or ""

                b_idx = self.brand_combo.findData(brand)
                if b_idx != -1:
                    self.brand_combo.setCurrentIndex(b_idx)
                    from PySide6.QtCore import QTimer

                    def select_model():
                        m_idx = self.model_combo.findData(model)
                        if m_idx != -1:
                            self.model_combo.setCurrentIndex(m_idx)

                            def select_part():
                                p_idx = self.part_combo.findData(part_id)
                                if p_idx != -1:
                                    self.part_combo.setCurrentIndex(p_idx)

                            QTimer.singleShot(80, select_part)
                        else:
                            p_idx = self.part_combo.findData(part_id)
                            if p_idx != -1:
                                self.part_combo.setCurrentIndex(p_idx)

                    QTimer.singleShot(80, select_model)
                else:
                    self._selected_part_id = part_id
                    self._load_source_combo()
            finally:
                db.close()
        except Exception as e:
            print(f"[Dialog] Hiyerarşi seçim hatası: {e}")

    # ── Barkod Okuma ─────────────────────────────────────────────────────────
    def _on_barcode_scanned(self):
        barcode_val = self.barcode_input.text().strip()
        if not barcode_val:
            return

        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                part = db.execute(
                    text("""
                    SELECT id, name FROM warehouse.parts WHERE barcode = :barcode;
                """),
                    {"barcode": barcode_val},
                ).fetchone()

                if part:
                    self._selected_part_id = part[0]
                    self.status_lbl.setText(f"✅ Bulundu: {part[1]}")
                    self.status_lbl.setStyleSheet("color: #3FB950; font-weight: bold;")
                    self._select_part_hierarchy(part[0])
                else:
                    self.status_lbl.setText(f"❌ Barkod bulunamadı: {barcode_val}")
                    self.status_lbl.setStyleSheet("color: #F85149; font-weight: bold;")
            finally:
                db.close()
        except Exception as e:
            QMessageBox.critical(self, "Hata", f"Sorgulama hatası: {e}")

    # ── Kaynak Lokasyon (raf) ────────────────────────────────────────────────
    def _load_source_combo(self):
        """Seçili parçanın stoklu olduğu lokasyonları (rafları) mevcut miktarla
        birlikte Kaynak Lokasyon combosuna doldurur."""
        self.source_combo.clear()
        if not isinstance(self._selected_part_id, int):
            self.qty_spin.setRange(0, 0)
            return

        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                rows = db.execute(
                    text("""
                    SELECT s.id, l.name, s.quantity
                    FROM warehouse.stock s
                    JOIN warehouse.locations l ON s.location_id = l.id
                    WHERE s.part_id = :part_id AND s.quantity > 0
                    ORDER BY l.name;
                """),
                    {"part_id": self._selected_part_id},
                ).fetchall()

                for stock_id, loc_name, qty in rows:
                    self.source_combo.addItem(
                        f"{loc_name} - Mevcut: {qty} adet", (stock_id, qty)
                    )
            finally:
                db.close()
        except Exception as e:
            print(f"[Dialog] Kaynak lokasyon yüklenemedi: {e}")

    def _on_source_changed(self, index):
        data = self.source_combo.itemData(index)
        if not data:
            self.qty_spin.setRange(0, 0)
            return
        _, max_qty = data
        self.qty_spin.setRange(0, max_qty)
        self.qty_spin.setValue(min(1, max_qty))

    # ── Çıkış Tipi ───────────────────────────────────────────────────────────
    def _on_type_changed(self):
        """Çıkış Tipi değiştiğinde hedef alanını değiştirir."""
        type_val = self.type_combo.currentData()

        is_technician = type_val == "Teknik Servis"
        is_customer = type_val == "Müşteri Satışı"
        is_transfer = type_val == "Şubeler Arası Transfer"
        is_supplier = type_val == "Tedarikçiye İade"
        is_manual = type_val in ("Hurda / Arızalı", "Sayım Eksiği", "Manuel Çıkış")

        self.lbl_technician.setVisible(is_technician)
        self.technician_combo.setVisible(is_technician)

        self.lbl_customer.setVisible(is_customer)
        self.customer_input.setVisible(is_customer)

        self.lbl_transfer_loc.setVisible(is_transfer)
        self.transfer_loc_combo.setVisible(is_transfer)

        self.lbl_supplier.setVisible(is_supplier)
        self.supplier_input.setVisible(is_supplier)

        self.lbl_manual.setVisible(is_manual)
        self.manual_input.setVisible(is_manual)

        if is_supplier:
            self._fill_supplier_from_part()

    def _load_technicians(self):
        self.technician_combo.clear()
        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                rows = db.execute(
                    text(
                        "SELECT username FROM warehouse.users WHERE role = 'Teknisyen' OR role LIKE 'TEC_%' ORDER BY username;"
                    )
                ).fetchall()
                for (username,) in rows:
                    self.technician_combo.addItem(username, username)
            finally:
                db.close()
        except Exception as e:
            print(f"[Dialog] Teknisyen listesi yüklenemedi: {e}")

    def _load_transfer_locations(self):
        self.transfer_loc_combo.clear()
        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                rows = db.execute(
                    text("SELECT id, name FROM warehouse.locations ORDER BY name;")
                ).fetchall()
                for loc_id, name in rows:
                    self.transfer_loc_combo.addItem(name, loc_id)
            finally:
                db.close()
        except Exception as e:
            print(f"[Dialog] Lokasyon listesi yüklenemedi: {e}")

    def _fill_supplier_from_part(self):
        if not isinstance(self._selected_part_id, int):
            return
        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                supplier = db.execute(
                    text("SELECT supplier FROM warehouse.parts WHERE id = :id;"),
                    {"id": self._selected_part_id},
                ).scalar()
                if supplier:
                    self.supplier_input.setText(supplier)
            finally:
                db.close()
        except Exception as e:
            print(f"[Dialog] Tedarikçi bilgisi alınamadı: {e}")

    def get_destination(self) -> str:
        """Çıkış tipine göre girilen hedef bilgisini tek bir metne dönüştürür."""
        type_val = self.type_combo.currentData()

        if type_val == "Teknik Servis":
            return self.technician_combo.currentText().strip() or "Teknik Servis"
        if type_val == "Müşteri Satışı":
            return self.customer_input.text().strip() or "Müşteri Satışı"
        if type_val == "Şubeler Arası Transfer":
            return self.transfer_loc_combo.currentText().strip() or "Şubeler Arası Transfer"
        if type_val == "Tedarikçiye İade":
            return self.supplier_input.text().strip() or "Tedarikçiye İade"
        return self.manual_input.text().strip() or type_val


class OutboundPage(QWidget):
    """Depo Çıkış Modülü Ekranı."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._current_role = "warehouse_worker"
        self.service = OutboundService()
        self._setup_ui()
        get_translator().language_changed.connect(self._retranslate)

    def _setup_ui(self):
        self._layout = QVBoxLayout(self)
        self._layout.setContentsMargins(28, 28, 28, 28)
        self._layout.setSpacing(16)

        if self._current_role not in ["admin", "warehouse_worker"]:
            unauth_lbl = QLabel(tr("outbound.unauthorized"))
            unauth_lbl
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
        self._title_lbl
        title_layout.addWidget(self._title_lbl)

        self._subtitle_lbl = QLabel(tr("outbound.subtitle"))
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

        # Yeni Stok Çıkışı Butonu
        self._add_btn = QPushButton(f"➖ {tr('outbound.add_new')}")
        self._add_btn.setObjectName("btn_danger")
        self._add_btn.setCursor(Qt.PointingHandCursor)
        self._add_btn.clicked.connect(self._add_outbound_stock)
        header_layout.addWidget(self._add_btn)

        self._layout.addLayout(header_layout)

        # Çıkış kayıtları tablosu
        self._table = QTableWidget()
        self._table.setColumnCount(7)
        self._table.setAlternatingRowColors(True)
        self._table.verticalHeader().setVisible(False)
        self._table.setSelectionBehavior(QTableWidget.SelectRows)
        self._table.setEditTriggers(QTableWidget.NoEditTriggers)
        header = self._table.horizontalHeader()
        for col in range(6):
            header.setSectionResizeMode(col, QHeaderView.Interactive)
        header.setSectionResizeMode(6, QHeaderView.Stretch)
        for col, width in enumerate([160, 70, 220, 130, 110, 130]):
            self._table.setColumnWidth(col, width)
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
                tr("table.quantity"),
                "Kaynak → Hedef",
                tr("outbound.date"),
                tr("inbound.created_by"),
                "Tür",
                "Açıklama",
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
                    SELECT p.name, l.name, e.quantity, e.destination, e.created_at,
                           e.created_by, e.outbound_type, e.description
                    FROM warehouse.outbound_entries e
                    JOIN warehouse.parts p ON e.part_id = p.id
                    JOIN warehouse.locations l ON e.location_id = l.id
                    ORDER BY e.created_at DESC
                    LIMIT 200;
                """)).fetchall()

                self._table.setUpdatesEnabled(False)
                self._table.setRowCount(len(rows))
                for r_idx, row in enumerate(rows):
                    self._table.setItem(r_idx, 0, QTableWidgetItem(str(row[0])))
                    self._table.setItem(r_idx, 1, QTableWidgetItem(str(row[2])))
                    self._table.setItem(
                        r_idx, 2, QTableWidgetItem(f"{row[1]} → {row[3]}")
                    )
                    self._table.setItem(r_idx, 3, QTableWidgetItem(str(row[4])[:16]))
                    self._table.setItem(r_idx, 4, QTableWidgetItem(str(row[5])))
                    self._table.setItem(r_idx, 5, QTableWidgetItem(str(row[6] or "—")))
                    self._table.setItem(r_idx, 6, QTableWidgetItem(str(row[7] or "—")))
                    self._table.setRowHeight(r_idx, 44)
                self._table.setUpdatesEnabled(True)
            finally:
                db.close()
        except Exception as e:
            self._table.setUpdatesEnabled(True)
            print(f"[Error Loading Outbounds] {e}")

    def _add_outbound_stock(self):
        """Stok çıkış formunu açar ve kaydeder."""
        dialog = AddOutboundStockDialog(self)
        if dialog.exec() != QDialog.Accepted:
            return

        source_data = dialog.source_combo.currentData()
        if not source_data:
            QMessageBox.warning(self, "Hata", "Lütfen bir kaynak lokasyon seçin.")
            return

        stock_id, max_qty = source_data
        qty = dialog.qty_spin.value()

        if qty <= 0:
            QMessageBox.warning(self, "Hata", "Miktar 0'dan büyük olmalıdır.")
            return

        if qty > max_qty:
            QMessageBox.warning(
                self, "Hata", "Çıkış miktarı mevcut stoktan fazla olamaz."
            )
            return

        outbound_type = dialog.type_combo.currentData()
        destination = dialog.get_destination()
        description = dialog.description_input.text().strip() or None

        try:
            from config.session import SessionManager

            created_by = SessionManager().username or "sistem"
        except Exception:
            created_by = "sistem"

        try:
            self.service.ship_goods(
                stock_id,
                qty,
                destination,
                created_by,
                outbound_type=outbound_type,
                description=description,
            )
            QMessageBox.information(self, "Başarılı", tr("outbound.success"))
            self._load_entries()
        except InsufficientStockError:
            QMessageBox.warning(self, "Hata", tr("outbound.insufficient_stock"))
        except ServiceError as e:
            QMessageBox.critical(self, "Hata", f"Stok çıkışı kaydedilemedi: {e}")

    def _import_excel(self):
        """Excel'den veri aktarımı tetikler (sütun eşleştirme ile)."""
        from ui.excel_utils import import_excel_flow

        db_cols = ["part_id", "location_id", "quantity", "destination", "created_by"]
        import_excel_flow(self, db_cols, self._save_imported_data)

    def _save_imported_data(self, df):
        """Eşleştirilen ve DataFrame haline gelen veriyi PostgreSQL'e yazar."""
        import pandas as pd

        entries = []
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
                str(created_by_raw) if not pd.isna(created_by_raw) else "excel_import"
            )

            entries.append(
                {
                    "part_id": part_id,
                    "location_id": loc_id,
                    "quantity": qty,
                    "destination": dest,
                    "created_by": created_by,
                }
            )

        try:
            self.service.ship_goods_bulk(entries)
            self._load_entries()
        except ServiceError as e:
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
                    SELECT p.name, l.name, e.quantity, e.destination, e.created_at,
                           e.created_by, e.outbound_type, e.description
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
                            "Tür": r[6] or "",
                            "Açıklama": r[7] or "",
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
