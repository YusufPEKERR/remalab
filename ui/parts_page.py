"""
RemaLab WMS - Parts Page
Depodaki parçaların eklenmesi, silinmesi, listelenmesi ve Excel entegrasyonu.
"""

import os
import pandas as pd
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
    QComboBox,
    QFileDialog,
)
from PySide6.QtCore import Qt, QSize
from PySide6.QtGui import QIcon
from ui.translations import tr, get_translator


class AddPartDialog(QDialog):
    """Yeni parça ekleme diyaloğu."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Yeni Stok Kartı (Parça) Ekle")
        self.setMinimumWidth(400)

        layout = QVBoxLayout(self)

        layout.addWidget(QLabel("Parça Kodu *"))
        self.item_code_input = QLineEdit()
        layout.addWidget(self.item_code_input)

        layout.addWidget(QLabel("Marka (Opsiyonel)"))
        self.brand_input = QLineEdit()
        layout.addWidget(self.brand_input)

        layout.addWidget(QLabel("Model (Opsiyonel)"))
        self.model_input = QLineEdit()
        layout.addWidget(self.model_input)

        layout.addWidget(QLabel("Renk (Opsiyonel)"))
        self.color_input = QLineEdit()
        layout.addWidget(self.color_input)

        layout.addWidget(QLabel("Parça Tipi (Opsiyonel)"))
        self.part_category_input = QLineEdit()
        layout.addWidget(self.part_category_input)

        layout.addWidget(QLabel("Parça Kategorisi (Opsiyonel)"))
        self.category_combo = QComboBox()
        self.category_combo.setEditable(True)
        self.category_combo.setPlaceholderText("Kategori seçin veya yazın...")
        self._load_categories()
        layout.addWidget(self.category_combo)

        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel, self)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        buttons.button(QDialogButtonBox.Ok).setText(tr("db.save"))
        buttons.button(QDialogButtonBox.Cancel).setText(tr("db.cancel"))
        layout.addWidget(buttons)

    def _load_categories(self):
        try:
            from config.database import SessionLocal
            from sqlalchemy import text
            db = SessionLocal()
            try:
                cats = db.execute(text("SELECT DISTINCT item_category FROM warehouse.parts WHERE item_category IS NOT NULL AND item_category != '' ORDER BY 1")).fetchall()
                for row in cats:
                    self.category_combo.addItem(row[0])
            finally:
                db.close()
        except Exception:
            pass


class EditPartDialog(QDialog):
    """Parça düzenleme diyaloğu."""

    def __init__(self, current_data, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Parçayı Düzenle")
        self.setMinimumWidth(400)

        layout = QVBoxLayout(self)

        layout.addWidget(QLabel("Parça Kodu *"))
        self.item_code_input = QLineEdit(current_data.get("item_code", ""))
        layout.addWidget(self.item_code_input)

        layout.addWidget(QLabel("Marka (Opsiyonel)"))
        self.brand_input = QLineEdit(current_data.get("brand", ""))
        layout.addWidget(self.brand_input)

        layout.addWidget(QLabel("Model (Opsiyonel)"))
        self.model_input = QLineEdit(current_data.get("model", ""))
        layout.addWidget(self.model_input)

        layout.addWidget(QLabel("Renk (Opsiyonel)"))
        self.color_input = QLineEdit(current_data.get("color", ""))
        layout.addWidget(self.color_input)

        layout.addWidget(QLabel("Parça Tipi (Opsiyonel)"))
        self.part_category_input = QLineEdit(current_data.get("part_category", ""))
        layout.addWidget(self.part_category_input)

        layout.addWidget(QLabel("Parça Kategorisi (Opsiyonel)"))
        self.category_combo = QComboBox()
        self.category_combo.setEditable(True)
        self.category_combo.setPlaceholderText("Kategori seçin veya yazın...")
        self._load_categories()
        
        cat = current_data.get("item_category", "")
        if cat:
            self.category_combo.setCurrentText(cat)
        layout.addWidget(self.category_combo)

        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel, self)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        buttons.button(QDialogButtonBox.Ok).setText(tr("db.save"))
        buttons.button(QDialogButtonBox.Cancel).setText(tr("db.cancel"))
        layout.addWidget(buttons)

    def _load_categories(self):
        try:
            from config.database import SessionLocal
            from sqlalchemy import text
            db = SessionLocal()
            try:
                cats = db.execute(text("SELECT DISTINCT item_category FROM warehouse.parts WHERE item_category IS NOT NULL AND item_category != '' ORDER BY 1")).fetchall()
                for row in cats:
                    self.category_combo.addItem(row[0])
            finally:
                db.close()
        except Exception:
            pass


class PartsPage(QWidget):
    """Parçalar modülü."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._current_page = 1
        self._page_size = 50
        self._total_pages = 1
        self._setup_ui()
        get_translator().language_changed.connect(self._retranslate)

    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(28, 28, 28, 28)
        layout.setSpacing(16)

        # Üst Bilgiler
        header_layout = QHBoxLayout()
        title_section = QWidget()
        title_layout = QVBoxLayout(title_section)
        title_layout.setContentsMargins(0, 0, 0, 0)
        title_layout.setSpacing(4)

        self._title_lbl = QLabel(tr("parts.title"))
        title_layout.addWidget(self._title_lbl)

        self._subtitle_lbl = QLabel(tr("parts.subtitle"))
        title_layout.addWidget(self._subtitle_lbl)

        header_layout.addWidget(title_section)
        header_layout.addStretch()

        # İşlem Seçici (ComboBox) ve Buton
        action_layout = QVBoxLayout()
        action_layout.setSpacing(6)

        self._action_combo = QComboBox()
        self._action_combo.addItems([
            "Excel İşlemi Seç...",
            "Boş Şablon İndir",
            "Excel'e Dışa Aktar",
            "Excel'den İçe Aktar"
        ])
        self._action_combo.setStyleSheet("""
            QComboBox {
                background-color: #161B22;
                border: 1px solid #30363D;
                border-radius: 6px;
                padding: 6px 12px;
                color: #C9D1D9;
                font-size: 13px;
                min-width: 150px;
            }
            QComboBox:focus { border-color: #1F6FEB; }
        """)
        action_layout.addWidget(self._action_combo)

        self._action_btn = QPushButton("Uygula")
        self._action_btn.setObjectName("btn_warning")
        self._action_btn.setCursor(Qt.PointingHandCursor)
        self._action_btn.clicked.connect(self._execute_action)
        action_layout.addWidget(self._action_btn)

        header_layout.addLayout(action_layout)

        # Ekleme butonu
        self._add_btn = QPushButton(tr("parts.add_new"))
        self._add_btn.setObjectName("btn_primary")
        self._add_btn.setCursor(Qt.PointingHandCursor)
        self._add_btn.clicked.connect(self._add_part)
        header_layout.addWidget(self._add_btn)

        layout.addLayout(header_layout)

        # Arama çubuğu
        self._search_input = QLineEdit()
        self._search_input.setPlaceholderText(tr("parts.search_placeholder"))
        self._search_input.textChanged.connect(self._on_search_changed)
        layout.addWidget(self._search_input)

        # Parçalar Tablosu
        self._table = QTableWidget()
        self._table.setColumnCount(8) # ID, Kod, Marka, Model, Renk, Tip, Kategori, İşlemler
        self._table.setAlternatingRowColors(True)
        self._table.verticalHeader().setVisible(False)
        self._table.setSelectionBehavior(QTableWidget.SelectRows)

        for i in range(8):
            self._table.horizontalHeader().setSectionResizeMode(i, QHeaderView.Stretch if i in [3, 4] else QHeaderView.ResizeToContents)

        layout.addWidget(self._table)

        # Sayfalama Kontrolleri
        pagination_layout = QHBoxLayout()
        size_lbl = QLabel("Sayfa Başına:")
        pagination_layout.addWidget(size_lbl)

        self._page_size_combo = QComboBox()
        self._page_size_combo.addItems(["5", "10", "15", "20", "25", "50", "100"])
        self._page_size_combo.setCurrentText("50")
        self._page_size_combo.currentTextChanged.connect(self._on_page_size_changed)
        pagination_layout.addWidget(self._page_size_combo)
        pagination_layout.addStretch()

        self._prev_btn = QPushButton("⬅ Önceki")
        self._prev_btn.setCursor(Qt.PointingHandCursor)
        self._prev_btn.clicked.connect(self._prev_page)
        pagination_layout.addWidget(self._prev_btn)

        self._page_info_lbl = QLabel("Sayfa 1 / 1")
        pagination_layout.addWidget(self._page_info_lbl)

        self._next_btn = QPushButton("Sonraki ➡")
        self._next_btn.setCursor(Qt.PointingHandCursor)
        self._next_btn.clicked.connect(self._next_page)
        pagination_layout.addWidget(self._next_btn)

        layout.addLayout(pagination_layout)
        self._load_parts()

    def _on_search_changed(self):
        self._current_page = 1
        self._load_parts()

    def _on_page_size_changed(self, text):
        self._page_size = int(text)
        self._current_page = 1
        self._load_parts()

    def _prev_page(self):
        if self._current_page > 1:
            self._current_page -= 1
            self._load_parts()

    def _next_page(self):
        if self._current_page < self._total_pages:
            self._current_page += 1
            self._load_parts()

    def _update_headers(self):
        self._table.setHorizontalHeaderLabels(
            ["ID", "Parça Kodu", "Marka", "Model", "Renk", "Parça Tipi", "Kategori", "İşlemler"]
        )

    def _get_sql_query_and_params(self, is_count=False, is_export=False):
        search_query = self._search_input.text().strip()
        sql = "SELECT COUNT(*) FROM warehouse.parts" if is_count else "SELECT id, item_code, brand, model, color, part_category, item_category FROM warehouse.parts"
        params = {}

        if search_query:
            where_clause = " WHERE name ILIKE :search OR item_code ILIKE :search OR brand ILIKE :search OR model ILIKE :search OR color ILIKE :search OR item_category ILIKE :search OR CAST(id AS VARCHAR) ILIKE :search"
            sql += where_clause
            params["search"] = f"%{search_query}%"

        if not is_count:
            sql += " ORDER BY id DESC"
            if not is_export:
                sql += " LIMIT :limit OFFSET :offset"
                params["limit"] = self._page_size
                params["offset"] = (self._current_page - 1) * self._page_size
                
        return sql, params

    def _load_parts(self):
        """PostgreSQL'den parçaları listeler."""
        self._table.blockSignals(True)
        self._update_headers()
        self._table.clearContents()

        try:
            from config.database import SessionLocal
            from sqlalchemy import text
            import math

            db = SessionLocal()
            try:
                count_sql, count_params = self._get_sql_query_and_params(is_count=True)
                total_records = db.execute(text(count_sql), count_params).scalar() or 0

                self._total_pages = math.ceil(total_records / self._page_size) if total_records > 0 else 1
                if self._current_page > self._total_pages:
                    self._current_page = self._total_pages

                sql, params = self._get_sql_query_and_params(is_count=False, is_export=False)
                
                self._page_info_lbl.setText(f"Sayfa {self._current_page} / {self._total_pages} ({total_records} Kayıt)")
                self._prev_btn.setEnabled(self._current_page > 1)
                self._next_btn.setEnabled(self._current_page < self._total_pages)

                rows = db.execute(text(sql), params).fetchall()
                self._table.setRowCount(len(rows))

                from config.session import SessionManager
                user_role = SessionManager().role

                for r_idx, row in enumerate(rows):
                    p_id, p_code, p_brand, p_model, p_color, p_pcat, p_icat = row
                    
                    data = {
                        "id": str(p_id),
                        "item_code": str(p_code) if p_code else "",
                        "brand": str(p_brand) if p_brand else "",
                        "model": str(p_model) if p_model else "",
                        "color": str(p_color) if p_color else "",
                        "part_category": str(p_pcat) if p_pcat else "",
                        "item_category": str(p_icat) if p_icat else ""
                    }
                    
                    for c_idx, key in enumerate(["id", "item_code", "brand", "model", "color", "part_category", "item_category"]):
                        item = QTableWidgetItem(data[key])
                        item.setFlags(item.flags() & ~Qt.ItemIsEditable)
                        self._table.setItem(r_idx, c_idx, item)

                    action_layout = QHBoxLayout()
                    action_layout.setContentsMargins(0, 0, 0, 0)
                    action_layout.setSpacing(4)
                    action_layout.setAlignment(Qt.AlignCenter)

                    if user_role in ["Admin", "Depo Müdürü"]:
                        edit_btn = QPushButton("✏️")
                        edit_btn.setCursor(Qt.PointingHandCursor)
                        edit_btn.clicked.connect(lambda checked, d=data: self._edit_part(d))
                        action_layout.addWidget(edit_btn)

                    del_btn = QPushButton()
                    icon_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets", "trash.svg")
                    if os.path.exists(icon_path):
                        del_btn.setIcon(QIcon(icon_path))
                        del_btn.setIconSize(QSize(20, 20))
                    else:
                        del_btn.setText("🗑️")
                    del_btn.setObjectName("table_delete_btn")
                    del_btn.setCursor(Qt.PointingHandCursor)
                    del_btn.clicked.connect(lambda checked, pid=p_id: self._delete_part(pid))
                    action_layout.addWidget(del_btn)

                    action_widget = QWidget()
                    action_widget.setLayout(action_layout)
                    self._table.setCellWidget(r_idx, 7, action_widget)
                    self._table.setRowHeight(r_idx, 44)
            finally:
                db.close()
        except Exception as e:
            print(f"[Error Loading Parts] {e}")
        finally:
            self._table.blockSignals(False)

    def _execute_action(self):
        action = self._action_combo.currentText()
        if action == "Boş Şablon İndir":
            self._download_template()
        elif action == "Excel'e Dışa Aktar":
            self._export_excel()
        elif action == "Excel'den İçe Aktar":
            self._import_excel()
        else:
            QMessageBox.warning(self, "Uyarı", "Lütfen bir işlem seçiniz.")

    def _download_template(self):
        file_path, _ = QFileDialog.getSaveFileName(self, "Boş Şablon İndir", "Stok_Kartlari_Sablon.xlsx", "Excel Files (*.xlsx)")
        if not file_path:
            return
        
        try:
            df = pd.DataFrame(columns=["Parça Kodu", "Marka", "Model", "Renk", "Parça Tipi", "Parça Kategorisi"])
            df.to_excel(file_path, index=False)
            QMessageBox.information(self, "Başarılı", "Boş Excel şablonu başarıyla oluşturuldu!")
        except Exception as e:
            QMessageBox.critical(self, "Hata", f"Şablon oluşturulamadı: {e}")

    def _export_excel(self):
        file_path, _ = QFileDialog.getSaveFileName(self, "Excel'e Dışa Aktar", "Stok_Kartlari.xlsx", "Excel Files (*.xlsx)")
        if not file_path:
            return

        try:
            from config.database import SessionLocal
            from sqlalchemy import text
            db = SessionLocal()
            try:
                sql, params = self._get_sql_query_and_params(is_count=False, is_export=True)
                rows = db.execute(text(sql), params).fetchall()
                
                data = []
                for r in rows:
                    data.append({
                        "ID": r[0],
                        "Parça Kodu": r[1],
                        "Marka": r[2],
                        "Model": r[3],
                        "Renk": r[4],
                        "Parça Tipi": r[5],
                        "Parça Kategorisi": r[6]
                    })
                
                df = pd.DataFrame(data)
                df.to_excel(file_path, index=False)
                QMessageBox.information(self, "Başarılı", f"{len(data)} kayıt başarıyla dışa aktarıldı!")
            finally:
                db.close()
        except Exception as e:
            QMessageBox.critical(self, "Hata", f"Dışa aktarma hatası: {e}")

    def _import_excel(self):
        file_path, _ = QFileDialog.getOpenFileName(self, "Excel'den İçe Aktar", "", "Excel Files (*.xls *.xlsx)")
        if not file_path:
            return

        try:
            df = pd.read_excel(file_path)
            # Beklenen kolonlar
            expected_cols = ["Parça Kodu", "Marka", "Model", "Renk", "Parça Tipi", "Parça Kategorisi"]
            
            # Kolon kontrolü (Parça Kodu artık zorunlu)
            if "Parça Kodu" not in df.columns:
                QMessageBox.warning(self, "Uyarı", "'Parça Kodu' kolonu bulunamadı. Lütfen dışa aktarılan şablonu kullanın.")
                return

            from config.database import SessionLocal
            from sqlalchemy import text
            db = SessionLocal()
            success_count = 0
            try:
                for index, row in df.iterrows():
                    item_code = str(row["Parça Kodu"]) if pd.notna(row["Parça Kodu"]) else ""
                    if not item_code.strip():
                        continue # Parça Kodu boşsa geç
                        
                    brand = str(row["Marka"]) if "Marka" in df.columns and pd.notna(row["Marka"]) else None
                    model = str(row["Model"]) if "Model" in df.columns and pd.notna(row["Model"]) else None
                    color = str(row["Renk"]) if "Renk" in df.columns and pd.notna(row["Renk"]) else None
                    part_cat = str(row["Parça Tipi"]) if "Parça Tipi" in df.columns and pd.notna(row["Parça Tipi"]) else None
                    item_cat = str(row["Parça Kategorisi"]) if "Parça Kategorisi" in df.columns and pd.notna(row["Parça Kategorisi"]) else None

                    # Otomatik Parça Adı Oluştur
                    auto_name = f"{brand or ''} {model or ''} {color or ''}".strip()
                    if not auto_name:
                        auto_name = item_code

                    sql = """
                        INSERT INTO warehouse.parts (name, item_code, brand, model, color, part_category, item_category) 
                        VALUES (:name, :code, :brand, :model, :color, :pcat, :icat)
                        ON CONFLICT (item_code) 
                        DO UPDATE SET name = EXCLUDED.name, brand = EXCLUDED.brand, model = EXCLUDED.model, 
                                      color = EXCLUDED.color, part_category = EXCLUDED.part_category, item_category = EXCLUDED.item_category;
                    """
                    db.execute(text(sql), {"name": auto_name, "code": item_code, "brand": brand, "model": model, "color": color, "pcat": part_cat, "icat": item_cat})
                    success_count += 1
                db.commit()
                QMessageBox.information(self, "Başarılı", f"{success_count} kayıt başarıyla içe aktarıldı!")
                self._load_parts()
            except Exception as e:
                db.rollback()
                QMessageBox.critical(self, "SQL Hatası", f"Veritabanına yazılırken hata oluştu: {e}")
            finally:
                db.close()
        except Exception as e:
            QMessageBox.critical(self, "Okuma Hatası", f"Excel dosyası okunamadı: {e}")


    def _add_part(self):
        """Yeni parça ekleme."""
        dialog = AddPartDialog(self)
        if dialog.exec() == QDialog.Accepted:
            code = dialog.item_code_input.text().strip()
            if not code:
                QMessageBox.warning(self, "Uyarı", "Parça Kodu zorunludur!")
                return
                
            brand = dialog.brand_input.text().strip() or None
            model = dialog.model_input.text().strip() or None
            color = dialog.color_input.text().strip() or None
            pcat = dialog.part_category_input.text().strip() or None
            icat = dialog.category_combo.currentText().strip() or None

            # Otomatik İsim
            auto_name = f"{brand or ''} {model or ''} {color or ''}".strip()
            if not auto_name:
                auto_name = code

            try:
                from config.database import SessionLocal
                from sqlalchemy import text
                db = SessionLocal()
                try:
                    db.execute(
                        text("INSERT INTO warehouse.parts (name, item_code, brand, model, color, part_category, item_category) VALUES (:name, :code, :brand, :model, :color, :pcat, :icat);"),
                        {"name": auto_name, "code": code, "brand": brand, "model": model, "color": color, "pcat": pcat, "icat": icat},
                    )
                    db.commit()
                finally:
                    db.close()
                self._load_parts()
            except Exception as e:
                QMessageBox.critical(self, "Hata", f"Parça eklenemedi: {e}")

    def _delete_part(self, part_id: int):
        reply = QMessageBox.question(self, tr("db.delete"), tr("parts.confirm_delete"), QMessageBox.Yes | QMessageBox.No, QMessageBox.No)
        if reply == QMessageBox.Yes:
            try:
                from config.database import SessionLocal
                from sqlalchemy import text
                db = SessionLocal()
                try:
                    db.execute(text("DELETE FROM warehouse.parts WHERE id = :id;"), {"id": part_id})
                    db.commit()
                finally:
                    db.close()
                self._load_parts()
            except Exception as e:
                QMessageBox.critical(self, "Hata", f"Parça silinemedi: {e}")

    def _edit_part(self, data: dict):
        dialog = EditPartDialog(data, self)
        if dialog.exec() == QDialog.Accepted:
            code = dialog.item_code_input.text().strip()
            if not code:
                QMessageBox.warning(self, "Uyarı", "Parça Kodu zorunludur!")
                return
                
            brand = dialog.brand_input.text().strip() or None
            model = dialog.model_input.text().strip() or None
            color = dialog.color_input.text().strip() or None
            pcat = dialog.part_category_input.text().strip() or None
            icat = dialog.category_combo.currentText().strip() or None

            # Otomatik İsim
            auto_name = f"{brand or ''} {model or ''} {color or ''}".strip()
            if not auto_name:
                auto_name = code

            try:
                from config.database import SessionLocal
                from sqlalchemy import text
                db = SessionLocal()
                try:
                    sql = """
                        UPDATE warehouse.parts 
                        SET name = :name, item_code = :code, brand = :brand, 
                            model = :model, color = :color, part_category = :pcat, item_category = :icat 
                        WHERE id = :id;
                    """
                    db.execute(text(sql), {"name": auto_name, "code": code, "brand": brand, "model": model, "color": color, "pcat": pcat, "icat": icat, "id": int(data["id"])})
                    db.commit()
                finally:
                    db.close()
                self._load_parts()
            except Exception as e:
                QMessageBox.critical(self, "Hata", f"Parça güncellenemedi: {e}")

    def _retranslate(self):
        """Dil değiştiğinde çevirileri yeniler."""
        self._title_lbl.setText(tr("parts.title"))
        self._subtitle_lbl.setText(tr("parts.subtitle"))
        self._add_btn.setText(tr("parts.add_new"))
        self._search_input.setPlaceholderText(tr("parts.search_placeholder"))
        self._load_parts()
