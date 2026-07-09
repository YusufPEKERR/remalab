"""
RemaLab WMS - Phone Models Page
warehouse.parts tablosundaki brand, model, item_code, color ve memory
alanlarını listeler; satır içi düzenleme ve yeni kayıt eklemeyi destekler.
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
    QComboBox,
)
from PySide6.QtCore import Qt
from PySide6.QtGui import QColor
from ui.translations import tr, get_translator


# ─────────────────────────────────────────────────────────────────────────────
#  Yeni Telefon Modeli Diyaloğu
# ─────────────────────────────────────────────────────────────────────────────
class AddPhoneModelDialog(QDialog):
    """Yeni telefon modeli ekleme formu."""

    MEMORY_OPTIONS = [
        "", "16 GB", "32 GB", "64 GB", "128 GB", "256 GB", "512 GB", "1 TB",
    ]

    def __init__(self, parent=None, initial_data=None):
        super().__init__(parent)
        self.setWindowTitle("Yeni Telefon Modeli Ekle" if not initial_data else "Telefon Modeli Düzenle")
        self.setMinimumWidth(420)

        layout = QVBoxLayout(self)

        form = QFormLayout()
        form.setSpacing(12)

        self.item_code_input = QLineEdit()
        self.item_code_input.setPlaceholderText("örn. IC-IP15-004")
        form.addRow("Ürün Kodu:", self.item_code_input)

        self.brand_input = QLineEdit()
        self.brand_input.setPlaceholderText("örn. Apple")
        form.addRow("Marka:", self.brand_input)

        self.model_input = QLineEdit()
        self.model_input.setPlaceholderText("örn. iPhone 15 Pro")
        form.addRow("Model:", self.model_input)

        self.memory_combo = QComboBox()
        self.memory_combo.addItems(self.MEMORY_OPTIONS)
        self.memory_combo.setEditable(True)
        form.addRow("Hafıza:", self.memory_combo)

        self.color_input = QLineEdit()
        self.color_input.setPlaceholderText("örn. Siyah")
        form.addRow("Renk:", self.color_input)

        layout.addLayout(form)

        if initial_data:
            self.item_code_input.setText(initial_data.get("item_code", "") or "")
            self.brand_input.setText(initial_data.get("brand", "") or "")
            self.model_input.setText(initial_data.get("model", "") or "")
            self.memory_combo.setCurrentText(initial_data.get("memory", "") or "")
            self.color_input.setText(initial_data.get("color", "") or "")

        buttons = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel, self
        )
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        buttons.button(QDialogButtonBox.Ok).setText("Kaydet")
        buttons.button(QDialogButtonBox.Cancel).setText("İptal")
        layout.addWidget(buttons)


# ─────────────────────────────────────────────────────────────────────────────
#  Ana Sayfa
# ─────────────────────────────────────────────────────────────────────────────
class PhoneModelsPage(QWidget):
    """Telefon Modelleri modülü."""

    # Tablo sütun sırası → (başlık, db_field, editable)
    COLUMNS = [
        ("Ürün Kodu",   "item_code", True),
        ("Marka",       "brand",     True),
        ("Model",       "model",     True),
        ("Hafıza",      "memory",    False),
        ("Renk",        "color",     False),
        ("İşlemler",    "_delete",   False),
    ]

    def __init__(self, parent=None):
        super().__init__(parent)
        self._ensure_memory_column()
        self._setup_ui()
        get_translator().language_changed.connect(self._retranslate)

    # ── DB Migration ──────────────────────────────────────────────────────────
    def _ensure_memory_column(self):
        """warehouse.parts tablosuna memory sütunu yoksa ekler."""
        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                db.execute(
                    text(
                        "ALTER TABLE warehouse.parts ADD COLUMN IF NOT EXISTS memory VARCHAR(50);"
                    )
                )
                db.commit()
            finally:
                db.close()
        except Exception as e:
            print(f"[PhoneModels] memory kolonu eklenemedi: {e}")

    # ── UI Setup ──────────────────────────────────────────────────────────────
    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(28, 28, 28, 28)
        layout.setSpacing(16)

        # ── Başlık ───────────────────────────────────────────────────────────
        header_layout = QHBoxLayout()
        title_section = QWidget()
        title_layout = QVBoxLayout(title_section)
        title_layout.setContentsMargins(0, 0, 0, 0)
        title_layout.setSpacing(4)

        self._title_lbl = QLabel("Ürün Listesi")
        self._title_lbl.setObjectName("page_title")
        title_layout.addWidget(self._title_lbl)

        self._subtitle_lbl = QLabel(
            "Marka, model, hafıza ve renk bilgilerini yönetin"
        )
        self._subtitle_lbl.setObjectName("page_subtitle")
        title_layout.addWidget(self._subtitle_lbl)

        header_layout.addWidget(title_section)
        header_layout.addStretch()

        self._add_btn = QPushButton("＋ Yeni Model Ekle")
        self._add_btn.setCursor(Qt.PointingHandCursor)
        self._add_btn.clicked.connect(self._add_model)
        header_layout.addWidget(self._add_btn)

        layout.addLayout(header_layout)

        # ── Arama çubuğu ─────────────────────────────────────────────────────
        search_row = QHBoxLayout()
        search_row.setSpacing(8)

        self._search_input = QLineEdit()
        self._search_input.setPlaceholderText("Ara (ID, Marka, Model, Hafıza, Renk)...")
        self._search_input.textChanged.connect(self._load_data)
        search_row.addWidget(self._search_input)

        layout.addLayout(search_row)

        # ── Tablo ────────────────────────────────────────────────────────────
        self._table = QTableWidget()
        self._table.setColumnCount(len(self.COLUMNS))
        self._table.setAlternatingRowColors(True)
        self._table.verticalHeader().setVisible(False)
        self._table.setSelectionBehavior(QTableWidget.SelectRows)

        hh = self._table.horizontalHeader()
        # Ürün Kodu — sabit genişlik
        hh.setSectionResizeMode(0, QHeaderView.ResizeToContents)
        # Marka & Model — esnek
        hh.setSectionResizeMode(1, QHeaderView.Stretch)
        hh.setSectionResizeMode(2, QHeaderView.Stretch)
        # Hafıza & Renk — sabit
        hh.setSectionResizeMode(3, QHeaderView.ResizeToContents)
        hh.setSectionResizeMode(4, QHeaderView.ResizeToContents)
        # Sil butonu
        hh.setSectionResizeMode(5, QHeaderView.Fixed)
        self._table.setColumnWidth(5, 100)

        layout.addWidget(self._table)

        self._load_data()

    def showEvent(self, event):
        super().showEvent(event)
        self._load_data()

    # ── Data Loading ──────────────────────────────────────────────────────────
    def _update_headers(self):
        self._table.setHorizontalHeaderLabels(
            [col[0] for col in self.COLUMNS]
        )

    def _load_data(self):
        """Veritabanından telefon modellerini çeker ve tabloya yazar."""
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
                    SELECT id, item_code, brand, model, memory, color
                    FROM warehouse.parts
                    WHERE (brand IS NOT NULL OR model IS NOT NULL)
                """
                params = {}

                if search_q:
                    sql += " AND (brand ILIKE :q OR model ILIKE :q OR memory ILIKE :q OR color ILIKE :q OR item_code ILIKE :q OR CAST(id AS VARCHAR) ILIKE :q)"
                    params["q"] = f"%{search_q}%"

                sql += " ORDER BY brand ASC, model ASC;"

                rows = db.execute(text(sql), params).fetchall()
                self._table.setRowCount(len(rows))

                for r_idx, row in enumerate(rows):
                    p_id = row[0]

                    def _item(val, field):
                        it = QTableWidgetItem(str(val) if val else "")
                        it.setFlags(it.flags() & ~Qt.ItemIsEditable)
                        it.setData(Qt.UserRole, (p_id, field))
                        return it

                    # 0 — Ürün Kodu
                    self._table.setItem(r_idx, 0, _item(row[1], "item_code"))
                    # 1 — Marka
                    self._table.setItem(r_idx, 1, _item(row[2], "brand"))
                    # 2 — Model
                    self._table.setItem(r_idx, 2, _item(row[3], "model"))
                    # 3 — Hafıza
                    self._table.setItem(r_idx, 3, _item(row[4], "memory"))
                    # 4 — Renk
                    self._table.setItem(r_idx, 4, _item(row[5], "color"))

                    from config.session import SessionManager
                    user_role = SessionManager().role

                    action_layout = QHBoxLayout()
                    action_layout.setContentsMargins(0, 0, 0, 0)
                    action_layout.setSpacing(4)
                    action_layout.setAlignment(Qt.AlignCenter)

                    if user_role in ["Admin", "Depo Müdürü"]:
                        edit_btn = QPushButton("✏️")
                        edit_btn.setObjectName("table_delete_btn")
                        edit_btn.setCursor(Qt.PointingHandCursor)
                        edit_btn.setToolTip("Bu modeli düzenle")
                        
                        row_data = {
                            "item_code": row[1],
                            "brand": row[2],
                            "model": row[3],
                            "memory": row[4],
                            "color": row[5]
                        }
                        
                        edit_btn.clicked.connect(
                            lambda checked, pid=p_id, rdata=row_data: self._edit_model(pid, rdata)
                        )
                        action_layout.addWidget(edit_btn)

                    # Sil butonu
                    import os
                    from PySide6.QtGui import QIcon
                    from PySide6.QtCore import QSize
                    del_btn = QPushButton()
                    icon_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets", "trash.svg")
                    if os.path.exists(icon_path):
                        del_btn.setIcon(QIcon(icon_path))
                        del_btn.setIconSize(QSize(20, 20))
                    else:
                        del_btn.setText("🗑️")
                    del_btn.setObjectName("table_delete_btn")
                    del_btn.setCursor(Qt.PointingHandCursor)
                    del_btn.setToolTip("Bu modeli sil")
                    del_btn.clicked.connect(
                        lambda checked, pid=p_id: self._delete_model(pid)
                    )
                    action_layout.addWidget(del_btn)
                    
                    action_widget = QWidget()
                    action_widget.setLayout(action_layout)
                    
                    self._table.setCellWidget(r_idx, 5, action_widget)
                    self._table.setRowHeight(r_idx, 44)

            finally:
                db.close()
        except Exception as e:
            print(f"[PhoneModels] Veri yüklenemedi: {e}")
        finally:
            self._table.blockSignals(False)

    # ── Edit Model ────────────────────────────────────────────────────────────
    def _edit_model(self, part_id: int, initial_data: dict):
        dialog = AddPhoneModelDialog(self, initial_data)
        if dialog.exec() == QDialog.Accepted:
            brand = dialog.brand_input.text().strip()
            model = dialog.model_input.text().strip()
            item_code = dialog.item_code_input.text().strip()
            memory = dialog.memory_combo.currentText().strip()
            color = dialog.color_input.text().strip()

            brand_model = f"{brand} {model}".strip()
            name = brand_model or "Bilinmeyen Model"

            try:
                from config.database import SessionLocal
                from sqlalchemy import text

                db = SessionLocal()
                try:
                    db.execute(
                        text("""
                            UPDATE warehouse.parts
                            SET name = :name,
                                item_code = :item_code,
                                brand = :brand,
                                model = :model,
                                brand_model = :brand_model,
                                memory = :memory,
                                color = :color
                            WHERE id = :id;
                        """),
                        {
                            "name": name,
                            "item_code": item_code or None,
                            "brand": brand or None,
                            "model": model or None,
                            "brand_model": brand_model or None,
                            "memory": memory or None,
                            "color": color or None,
                            "id": part_id
                        },
                    )
                    db.commit()
                finally:
                    db.close()
                self._load_data()
            except Exception as e:
                QMessageBox.critical(self, "Hata", f"Model güncellenemedi:\n{e}")

    # ── Add ───────────────────────────────────────────────────────────────────
    def _add_model(self):
        dialog = AddPhoneModelDialog(self)
        if dialog.exec() != QDialog.Accepted:
            return

        brand     = dialog.brand_input.text().strip() or None
        model     = dialog.model_input.text().strip() or None
        item_code = dialog.item_code_input.text().strip() or None
        memory    = dialog.memory_combo.currentText().strip() or None
        color     = dialog.color_input.text().strip() or None

        if not brand and not model:
            QMessageBox.warning(self, "Uyarı", "En az Marka veya Model girilmelidir.")
            return

        brand_model = f"{brand or ''} {model or ''}".strip() or None
        name = brand_model or "Bilinmeyen Model"

        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                db.execute(
                    text("""
                        INSERT INTO warehouse.parts
                            (name, item_code, brand, model, brand_model, memory, color)
                        VALUES
                            (:name, :item_code, :brand, :model, :brand_model, :memory, :color);
                    """),
                    {
                        "name": name,
                        "item_code": item_code,
                        "brand": brand,
                        "model": model,
                        "brand_model": brand_model,
                        "memory": memory,
                        "color": color,
                    },
                )
                db.commit()
            finally:
                db.close()
            self._load_data()
        except Exception as e:
            QMessageBox.critical(self, "Hata", f"Model eklenemedi:\n{e}")

    # ── Delete ────────────────────────────────────────────────────────────────
    def _delete_model(self, part_id: int):
        reply = QMessageBox.question(
            self,
            "Sil",
            "Bu telefon modelini silmek istediğinize emin misiniz?\n"
            "(İlgili stok kayıtları da silinecektir.)",
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
            QMessageBox.critical(self, "Hata", f"Model silinemedi:\n{e}")

    # ── Retranslate ───────────────────────────────────────────────────────────
    def _retranslate(self):
        self._load_data()
