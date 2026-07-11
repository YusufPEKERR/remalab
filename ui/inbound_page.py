"""
RemaLab WMS - Inbound Stock Entry Page
Depocu ve Admin yetkisindeki kullanıcıların yeni stok girişi yapabileceği ekran.
Barkod okuyucu entegrasyonu, otomatik odaklama ve akıllı if-else akışı ile birlikte.
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
    QDoubleSpinBox,
    QSpinBox,
    QDialogButtonBox,
    QLineEdit,
    QCompleter,
    QScrollArea,
)
from PySide6.QtCore import Qt
from ui.translations import tr, get_translator
from services.inbound_service import InboundService
from services.part_service import PartService
from services.exceptions import ServiceError


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


class QuickAddProductDialog(QDialog):
    """Bulunamayan barkodlar için Hızlı Ürün Ekleme modal formu."""

    def __init__(self, barcode: str, parent=None):
        super().__init__(parent)
        self.setWindowTitle(tr("inbound.quick_add_title"))
        self.setMinimumWidth(350)
        self

        layout = QVBoxLayout(self)
        layout.setSpacing(12)

        # Barkod (Read-only)
        lbl_barcode = QLabel("Barkod:")
        lbl_barcode
        layout.addWidget(lbl_barcode)

        self.barcode_input = QLineEdit(barcode)
        self.barcode_input.setReadOnly(True)
        self.barcode_input
        layout.addWidget(self.barcode_input)

        # Ürün Adı
        lbl_name = QLabel(tr("parts.part_name"))
        lbl_name
        layout.addWidget(lbl_name)

        self.name_input = QLineEdit()
        self.name_input.setFocus()
        self.name_input
        layout.addWidget(self.name_input)

        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel, self)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)

        buttons.button(QDialogButtonBox.Ok).setText(tr("db.save"))
        buttons.button(QDialogButtonBox.Ok)
        buttons.button(QDialogButtonBox.Cancel).setText(tr("db.cancel"))
        buttons.button(QDialogButtonBox.Cancel)

        layout.addWidget(buttons)


class AddInboundStockDialog(QDialog):
    """Yeni stok girişi ekleme modal formu."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle(tr("inbound.add_new"))
        self.setMinimumWidth(480)
        self.setMinimumHeight(520)

        # Seçilen part_id saklanacak
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

        # Durum etiketi
        self.status_lbl = QLabel("")
        self.status_lbl.setStyleSheet("color: #8B949E; font-style: italic;")
        layout.addWidget(self.status_lbl)

        # ── Ayırıcı ───────────────────────────────────────────────────────────
        sep = QLabel("─" * 55)
        sep.setStyleSheet("color: #30363D;")
        layout.addWidget(sep)

        # ── 2. Marka / Model Seçimi (hiyerarşik) ────────────────────────────
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

        # ── 3. Otomatik doldurulan bilgi kutusu ───────────────────────────────
        self.info_box = QWidget()
        self.info_box.setStyleSheet(
            "QWidget { background: #161B22; border: 1px solid #30363D; border-radius: 6px; padding: 4px; }"
        )
        info_layout = QVBoxLayout(self.info_box)
        info_layout.setContentsMargins(12, 10, 12, 10)
        info_layout.setSpacing(4)

        self.lbl_info_code = QLabel("Ürün Kodu: —")
        self.lbl_info_barcode = QLabel("Barkod: —")
        self.lbl_info_brand = QLabel("Marka: —")
        self.lbl_info_model = QLabel("Model: —")
        self.lbl_info_color = QLabel("Renk: —")
        for lbl in [
            self.lbl_info_code,
            self.lbl_info_barcode,
            self.lbl_info_brand,
            self.lbl_info_model,
            self.lbl_info_color,
        ]:
            lbl.setStyleSheet("color: #8B949E; font-size: 12px; border: none;")
            info_layout.addWidget(lbl)

        layout.addWidget(self.info_box)
        self.info_box.setVisible(False)

        # ── 4. Giriş Tipi ────────────────────────────────────────────────────
        lbl_type = QLabel("Giriş Tipi")
        layout.addWidget(lbl_type)
        self.type_combo = QComboBox()
        self.type_combo.setStyleSheet(self._combo_style())
        self.type_combo.addItem("Yeni Alım (Tedarikçiden)", "new")
        self.type_combo.addItem("İç Transfer (Başka Depodan)", "transfer")
        self.type_combo.currentIndexChanged.connect(self._on_type_changed)
        layout.addWidget(self.type_combo)

        # ── 5. Miktar & Fiyat ────────────────────────────────────────────────
        qty_price_row = QHBoxLayout()
        qty_price_row.setSpacing(12)

        qty_col = QVBoxLayout()
        lbl_qty = QLabel(tr("table.quantity"))
        qty_col.addWidget(lbl_qty)
        self.qty_spin = SelectAllSpinBox()
        self.qty_spin.setRange(0, 1_000_000)
        self.qty_spin.setValue(1)
        qty_col.addWidget(self.qty_spin)
        qty_price_row.addLayout(qty_col)

        price_col = QVBoxLayout()
        self.lbl_price = QLabel(tr("inbound.unit_price"))
        price_col.addWidget(self.lbl_price)
        self.price_spin = QDoubleSpinBox()
        self.price_spin.setRange(0.01, 1_000_000.00)
        self.price_spin.setDecimals(2)
        self.price_spin.setValue(1.00)
        self.price_spin.setSuffix(" TL")
        price_col.addWidget(self.price_spin)
        qty_price_row.addLayout(price_col)

        layout.addLayout(qty_price_row)

        # ── 6. Lokasyon ───────────────────────────────────────────────────────
        self.lbl_loc = QLabel(tr("table.location"))
        layout.addWidget(self.lbl_loc)
        self.loc_combo = QComboBox()
        self.loc_combo.setStyleSheet(self._combo_style())
        layout.addWidget(self.loc_combo)

        self.lbl_source = QLabel("Kaynak Depo")
        layout.addWidget(self.lbl_source)
        self.source_combo = QComboBox()
        self.source_combo.setStyleSheet(self._combo_style())
        layout.addWidget(self.source_combo)

        self.lbl_target = QLabel("Hedef Depo")
        layout.addWidget(self.lbl_target)
        self.target_combo = QComboBox()
        self.target_combo.setStyleSheet(self._combo_style())
        layout.addWidget(self.target_combo)

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

    # ── Combolar ─────────────────────────────────────────────────────────────
    def _load_combos(self, select_part_id: int = None):
        """Marka ve lokasyon listesini parçalar tablosundan yükler."""
        for cb in [self.brand_combo, self.model_combo, self.part_combo]:
            cb.blockSignals(True)
            cb.clear()
            cb.blockSignals(False)
        self.loc_combo.clear()

        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                # Markalar — warehouse.parts.brand'dan çekiyoruz
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

                # Lokasyonlar
                locs = db.execute(
                    text("SELECT id, name FROM warehouse.locations ORDER BY name;")
                ).fetchall()
                for row in locs:
                    self.loc_combo.addItem(row[1], row[0])

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
        self._update_info_box(None)

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

                # Model yoksa direk parçaları yükle
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
        self._update_info_box(None)

        brand = self.brand_combo.currentData()
        model = self.model_combo.itemData(index)
        if not brand or not model:
            return

        self._load_parts_for(brand=brand, model=model)

    def _load_parts_for(self, brand: str, model):
        """Verilen marka+model için parçaları yükler."""
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
            self._update_info_box(None)
            self.source_combo.clear()
            return
        self._selected_part_id = part_id
        self._fill_part_details(part_id)
        if self.type_combo.currentData() == "transfer":
            self._load_source_target_combos()

    def _on_type_changed(self):
        """Giriş Tipi değiştiğinde Lokasyon / Kaynak+Hedef Depo alanlarını değiştirir."""
        is_transfer = self.type_combo.currentData() == "transfer"

        self.lbl_loc.setVisible(not is_transfer)
        self.loc_combo.setVisible(not is_transfer)

        self.lbl_source.setVisible(is_transfer)
        self.source_combo.setVisible(is_transfer)
        self.lbl_target.setVisible(is_transfer)
        self.target_combo.setVisible(is_transfer)

        if is_transfer:
            self._load_source_target_combos()

    def _load_source_target_combos(self):
        """İç transfer modunda: seçili parçanın stoklu olduğu lokasyonları Kaynak
        Depo'ya, tüm lokasyonları Hedef Depo'ya doldurur."""
        self.source_combo.clear()
        part_id = self._selected_part_id or self.part_combo.currentData()
        if not isinstance(part_id, int):
            return

        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                stoklar = db.execute(
                    text("""
                    SELECT s.id, l.name, s.quantity
                    FROM warehouse.stock s
                    JOIN warehouse.locations l ON s.location_id = l.id
                    WHERE s.part_id = :part_id AND s.quantity > 0
                    ORDER BY l.name;
                """),
                    {"part_id": part_id},
                ).fetchall()

                for stock_id, loc_name, qty in stoklar:
                    self.source_combo.addItem(
                        f"{loc_name} - Mevcut: {qty} adet", stock_id
                    )

                if self.target_combo.count() == 0:
                    lokasyonlar = db.execute(
                        text("SELECT id, name FROM warehouse.locations ORDER BY name;")
                    ).fetchall()
                    for loc_id, loc_name in lokasyonlar:
                        self.target_combo.addItem(loc_name, loc_id)
            finally:
                db.close()
        except Exception as e:
            print(f"[Dialog] Kaynak/Hedef depo yüklenemedi: {e}")

    def _fill_part_details(self, part_id: int):
        """Seçilen parçanın detaylarını bilgi kutusuna yazar."""
        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                part = db.execute(
                    text("""
                    SELECT item_code, barcode, brand, model, color
                    FROM warehouse.parts WHERE id = :id;
                """),
                    {"id": part_id},
                ).fetchone()

                if part:
                    self._update_info_box(part)

                    # Son giriş fiyatını getir
                    last_price = db.execute(
                        text("""
                        SELECT unit_price FROM warehouse.inbound_entries
                        WHERE part_id = :id ORDER BY created_at DESC LIMIT 1;
                    """),
                        {"id": part_id},
                    ).scalar()
                    if last_price is not None:
                        self.price_spin.setValue(float(last_price))
            finally:
                db.close()
        except Exception as e:
            print(f"[Dialog] Part detail yüklenemedi: {e}")

    def _update_info_box(self, part):
        """Bilgi kutusunu parça verisine göre günceller."""
        if part is None:
            self.info_box.setVisible(False)
            return
        self.lbl_info_code.setText(f"Ürün Kodu: {part[0] or '—'}")
        self.lbl_info_barcode.setText(f"Barkod: {part[1] or '—'}")
        self.lbl_info_brand.setText(f"Marka: {part[2] or '—'}")
        self.lbl_info_model.setText(f"Model: {part[3] or '—'}")
        self.lbl_info_color.setText(f"Renk: {part[4] or '—'}")
        self.info_box.setVisible(True)

    def _select_part_hierarchy(self, part_id: int):
        """Barkod okununca önce combo'ları doldurur sonra seçer."""
        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                part = db.execute(
                    text("""
                    SELECT brand, model FROM warehouse.parts WHERE id = :id;
                """),
                    {"id": part_id},
                ).fetchone()

                if not part:
                    return

                brand = part[0] or ""
                model = part[1] or ""

                # Marka seç
                b_idx = self.brand_combo.findData(brand)
                if b_idx != -1:
                    self.brand_combo.setCurrentIndex(b_idx)
                    # _on_brand_changed çalışır — model combo'yu doldurur
                    # Kısa bir süre bekleyip model seçiyoruz
                    from PySide6.QtCore import QTimer

                    def select_model():
                        m_idx = self.model_combo.findData(model)
                        if m_idx != -1:
                            self.model_combo.setCurrentIndex(m_idx)

                            # _on_model_changed parçaları doldurur
                            def select_part():
                                p_idx = self.part_combo.findData(part_id)
                                if p_idx != -1:
                                    self.part_combo.setCurrentIndex(p_idx)

                            QTimer.singleShot(80, select_part)
                        else:
                            # Model yok — direkt parçayı seç
                            p_idx = self.part_combo.findData(part_id)
                            if p_idx != -1:
                                self.part_combo.setCurrentIndex(p_idx)

                    QTimer.singleShot(80, select_model)
                else:
                    # Marka combo'da yoksa — parçaları manuel doldur
                    self._selected_part_id = part_id
                    self._fill_part_details(part_id)
            finally:
                db.close()
        except Exception as e:
            print(f"[Dialog] Hiyerarşi seçim hatası: {e}")

    # ── Barkod Okuma ─────────────────────────────────────────────────────────
    def _on_barcode_scanned(self):
        """Barkod okununca tüm alanları otomatik doldurur."""
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
                    SELECT id, name, item_code, barcode, brand, model, color
                    FROM warehouse.parts
                    WHERE barcode = :barcode;
                """),
                    {"barcode": barcode_val},
                ).fetchone()

                if part:
                    # ✅ Bulundu — tüm alanları doldur
                    self._selected_part_id = part[0]
                    self.status_lbl.setText(f"✅ Bulundu: {part[1]}")
                    self.status_lbl.setStyleSheet("color: #3FB950; font-weight: bold;")
                    self._update_info_box(part[2:])

                    # Hiyerarşi combo'larını arka planda doldur
                    self._select_part_hierarchy(part[0])
                    self.qty_spin.setFocus()
                    self.qty_spin.selectAll()
                else:
                    # ❌ Bulunamadı — hızlı ekleme sor
                    self.status_lbl.setText(f"❌ Barkod bulunamadı: {barcode_val}")
                    self.status_lbl.setStyleSheet("color: #F85149; font-weight: bold;")

                    reply = QMessageBox.question(
                        self,
                        tr("inbound.barcode_error_title"),
                        tr("inbound.barcode_error_msg"),
                        QMessageBox.Yes | QMessageBox.No,
                        QMessageBox.Yes,
                    )
                    if reply == QMessageBox.Yes:
                        quick_dialog = QuickAddProductDialog(barcode_val, self)
                        if quick_dialog.exec() == QDialog.Accepted:
                            p_name = quick_dialog.name_input.text().strip()
                            if p_name:
                                try:
                                    new_id = PartService().add_part(
                                        p_name, barcode=barcode_val
                                    )
                                except ServiceError as e:
                                    QMessageBox.critical(
                                        self, "Hata", f"Parça eklenemedi: {e}"
                                    )
                                    return
                                self._load_combos(select_part_id=new_id)
                                self.status_lbl.setText(
                                    f"✅ Yeni parça eklendi: {p_name}"
                                )
                                self.status_lbl.setStyleSheet(
                                    "color: #3FB950; font-weight: bold;"
                                )
                                self.qty_spin.setFocus()
                    else:
                        self._reset_barcode()
            finally:
                db.close()
        except Exception as e:
            QMessageBox.critical(self, "Hata", f"Sorgulama hatası: {e}")
            self._reset_barcode()

    def _reset_barcode(self):
        self.barcode_input.clear()
        self.status_lbl.setText("")
        self.barcode_input.setFocus()



class InboundPage(QWidget):
    """Yeni Stok Girişi Modülü."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._current_role = "warehouse_worker"
        self.service = InboundService()
        self._setup_ui()
        get_translator().language_changed.connect(self._retranslate)

    def _setup_ui(self):
        self._layout = QVBoxLayout(self)
        self._layout.setContentsMargins(28, 28, 28, 28)
        self._layout.setSpacing(16)

        if self._current_role not in ["admin", "warehouse_worker"]:
            unauth_lbl = QLabel(tr("inbound.unauthorized"))
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

        self._title_lbl = QLabel(tr("inbound.title"))
        self._title_lbl
        title_layout.addWidget(self._title_lbl)

        self._subtitle_lbl = QLabel(tr("inbound.subtitle"))
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

        # Yeni Stok Ekle Butonu
        self._add_btn = QPushButton(tr("inbound.add_new"))
        self._add_btn.setObjectName("btn_success")
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
        self._table.setEditTriggers(QTableWidget.NoEditTriggers)
        header = self._table.horizontalHeader()
        for col in range(5):
            header.setSectionResizeMode(col, QHeaderView.Interactive)
        header.setSectionResizeMode(5, QHeaderView.Stretch)
        for col, width in enumerate([160, 70, 100, 130, 110]):
            self._table.setColumnWidth(col, width)
        self._layout.addWidget(self._table)

        self._load_entries()

    def showEvent(self, event):
        """Sayfa her gösterildiğinde stok girişlerini yeniler."""
        super().showEvent(event)
        self._load_entries()

    def _update_headers(self):
        self._table.setHorizontalHeaderLabels(
            [
                tr("table.part_name"),
                tr("table.quantity"),
                tr("inbound.unit_price"),
                tr("inbound.date"),
                tr("inbound.created_by"),
                "Tür / Detay",
            ]
        )

    def _load_entries(self):
        """Mevcut stok girişlerini ve iç transferleri PostgreSQL'den çeker."""
        self._update_headers()
        self._table.clearContents()

        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                rows = db.execute(text("""
                    SELECT p.name, e.quantity, e.unit_price, e.created_at,
                           e.created_by, 'Yeni Alım' AS detail
                    FROM warehouse.inbound_entries e
                    JOIN warehouse.parts p ON e.part_id = p.id

                    UNION ALL

                    SELECT p.name, m.quantity, m.unit_price, m.created_at, m.created_by,
                           'İç Transfer: ' || COALESCE(sl.name, '—') || ' → ' || COALESCE(tl.name, '—') AS detail
                    FROM warehouse.stock_movements m
                    JOIN warehouse.parts p ON m.part_id = p.id
                    LEFT JOIN warehouse.locations sl ON m.source_location_id = sl.id
                    LEFT JOIN warehouse.locations tl ON m.target_location_id = tl.id
                    WHERE m.type = 'Transfer'

                    ORDER BY created_at DESC
                    LIMIT 200;
                """)).fetchall()

                self._table.setUpdatesEnabled(False)
                self._table.setRowCount(len(rows))
                for r_idx, row in enumerate(rows):
                    self._table.setItem(r_idx, 0, QTableWidgetItem(str(row[0])))
                    self._table.setItem(r_idx, 1, QTableWidgetItem(str(row[1])))
                    price_txt = f"{row[2]:,.2f} TL" if row[2] is not None else "—"
                    self._table.setItem(r_idx, 2, QTableWidgetItem(price_txt))
                    self._table.setItem(r_idx, 3, QTableWidgetItem(str(row[3])[:16]))
                    self._table.setItem(r_idx, 4, QTableWidgetItem(str(row[4])))
                    self._table.setItem(r_idx, 5, QTableWidgetItem(str(row[5])))
                    self._table.setRowHeight(r_idx, 44)
                self._table.setUpdatesEnabled(True)
            finally:
                db.close()
        except Exception as e:
            self._table.setUpdatesEnabled(True)
            print(f"[Error Loading Inbounds] {e}")

    def _add_inbound_stock(self):
        """Stok giriş formunu açar ve kaydeder."""
        dialog = AddInboundStockDialog(self)
        if dialog.exec() != QDialog.Accepted:
            return

        # _selected_part_id barkoddan gelir; yoksa combo seçiminden al
        part_id = dialog._selected_part_id or dialog.part_combo.currentData()
        qty = dialog.qty_spin.value()

        if not isinstance(part_id, int):
            QMessageBox.warning(self, "Hata", "Lütfen geçerli bir parça seçin.")
            return

        if qty <= 0:
            QMessageBox.warning(self, "Hata", "Miktar 0'dan büyük olmalıdır.")
            return

        # Oturumdan kullanıcı adını al
        try:
            from config.session import SessionManager

            created_by = SessionManager().username or "sistem"
        except Exception:
            created_by = "sistem"

        if dialog.type_combo.currentData() == "transfer":
            source_stock_id = dialog.source_combo.currentData()
            target_location_id = dialog.target_combo.currentData()

            if source_stock_id is None or target_location_id is None:
                QMessageBox.warning(self, "Hata", "Lütfen kaynak ve hedef depo seçin.")
                return

            try:
                from services.stock_service import StockService
                from services.exceptions import InsufficientStockError

                StockService().transfer(
                    source_stock_id,
                    target_location_id,
                    qty,
                    created_by=created_by,
                    unit_price=dialog.price_spin.value(),
                )
                QMessageBox.information(
                    self, "Başarılı", "Stok transferi başarıyla yapıldı."
                )
                self._load_entries()
            except InsufficientStockError:
                QMessageBox.warning(self, "Hata", "Kaynak depoda yeterli stok yok.")
            except ServiceError as e:
                QMessageBox.critical(self, "Hata", f"Transfer yapılamadı: {e}")
            return

        location_id = dialog.loc_combo.currentData()
        price = dialog.price_spin.value()

        if location_id is None:
            QMessageBox.warning(self, "Hata", "Lütfen bir lokasyon seçin.")
            return

        try:
            self.service.receive_goods(part_id, location_id, qty, price, created_by)
            QMessageBox.information(self, "Başarılı", "Stok girişi başarıyla yapıldı.")
            self._load_entries()
        except ServiceError as e:
            QMessageBox.critical(self, "Hata", f"Stok kaydedilemedi: {e}")

    def _import_excel(self):
        """Excel'den veri aktarımı tetikler (sütun eşleştirme ile)."""
        from ui.excel_utils import import_excel_flow

        db_cols = [
            "part_id",
            "quantity",
            "unit_price",
            "total_cost",
            "location_id",
            "created_by",
        ]
        import_excel_flow(self, db_cols, self._save_imported_data)

    def _save_imported_data(self, df):
        """Eşleştirilen ve DataFrame haline gelen veriyi PostgreSQL'e yazar."""
        import pandas as pd

        entries = []
        for _, row in df.iterrows():
            # NaN/Null korumalı güvenli tip dönüşümleri
            part_id_raw = row.get("part_id")
            if pd.isna(part_id_raw):
                continue
            part_id = int(part_id_raw)

            qty_raw = row.get("quantity")
            qty = int(qty_raw) if not pd.isna(qty_raw) else 0
            if qty <= 0:
                continue

            price_raw = row.get("unit_price")
            price = float(price_raw) if not pd.isna(price_raw) else 1.0

            total_raw = row.get("total_cost")
            total = float(total_raw) if not pd.isna(total_raw) else (qty * price)

            loc_id_raw = row.get("location_id")
            loc_id = int(loc_id_raw) if not pd.isna(loc_id_raw) else 1

            created_by_raw = row.get("created_by")
            created_by = (
                str(created_by_raw) if not pd.isna(created_by_raw) else "excel_import"
            )

            entries.append(
                {
                    "part_id": part_id,
                    "quantity": qty,
                    "unit_price": price,
                    "total_cost": total,
                    "location_id": loc_id,
                    "created_by": created_by,
                }
            )

        try:
            self.service.receive_goods_bulk(entries)
            self._load_entries()
        except ServiceError as e:
            QMessageBox.critical(
                self, "Hata", f"Veriler veritabanına kaydedilemedi: {e}"
            )

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
                    data.append(
                        {
                            "Parça Adı": r[0],
                            "Miktar": r[1],
                            "Birim Fiyat": float(r[2]),
                            "Toplam Maliyet": float(r[3]),
                            "Tarih": str(r[4]),
                            "İşlemi Yapan": r[5],
                        }
                    )
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
