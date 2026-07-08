"""
RemaLab WMS - Excel Utilities
Excel İçe/Dışa aktarma, önizleme ve dinamik kullanıcı dostu sütun eşleştirme logic'i.
"""

import pandas as pd
from PySide6.QtWidgets import (
    QDialog,
    QVBoxLayout,
    QHBoxLayout,
    QTableWidget,
    QTableWidgetItem,
    QComboBox,
    QPushButton,
    QLabel,
    QDialogButtonBox,
    QFileDialog,
    QMessageBox,
    QHeaderView,
)
from PySide6.QtCore import Qt
from ui.translations import tr


class ExcelMappingDialog(QDialog):
    """Excel başlıkları ile Veritabanı sütunlarını eşleştirme ve Önizleme diyaloğu."""

    def __init__(
        self,
        excel_columns: list[str],
        db_columns: list[str],
        sample_df: pd.DataFrame,
        parent=None,
    ):
        super().__init__(parent)
        self.setWindowTitle(tr("excel.mapping_title"))
        self.setMinimumWidth(750)
        self.setMinimumHeight(550)
        self.setStyleSheet("background-color: #0D1117; color: #F0F6FC;")

        layout = QVBoxLayout(self)

        # Üst Bilgilendirme
        lbl = QLabel("1. Excel Sütun Başlıklarını Veritabanı Alanlarıyla Eşleştirin:")
        lbl.setStyleSheet("color: #58A6FF; font-weight: bold; font-size: 13px;")
        layout.addWidget(lbl)

        # Eşleştirme tablosu
        self.table = QTableWidget()
        self.table.setColumnCount(2)
        self.table.setHorizontalHeaderLabels(
            [tr("excel.db_column"), tr("excel.excel_column")]
        )
        self.table.verticalHeader().setVisible(False)
        self.table.setShowGrid(False)
        self.table.setMaximumHeight(200)
        self.table.setStyleSheet("""
            QTableWidget { 
                background-color: #161B22; 
                border: 1px solid #30363D; 
                color: #F0F6FC;
                gridline-color: transparent;
                border-radius: 6px;
            }
            QTableWidget::item { 
                color: #F0F6FC; 
                padding-left: 12px;
            }
            QHeaderView::section { 
                background-color: #21262D; 
                color: #8B949E; 
                border: none; 
                font-weight: bold; 
                padding: 6px;
            }
        """)
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        layout.addWidget(self.table)

        # Orta Bilgilendirme (Önizleme Alanı)
        lbl_preview = QLabel("2. Seçilen Excel Dosyasından Örnek Veri Önizlemesi:")
        lbl_preview.setStyleSheet(
            "color: #58A6FF; font-weight: bold; font-size: 13px; margin-top: 10px;"
        )
        layout.addWidget(lbl_preview)

        # Excel Veri Önizleme Tablosu
        self.preview_table = QTableWidget()
        self.preview_table.verticalHeader().setVisible(False)
        self.preview_table.setShowGrid(True)
        self.preview_table.setStyleSheet("""
            QTableWidget { 
                background-color: #0D1117; 
                border: 1px solid #30363D; 
                color: #C9D1D9;
                gridline-color: #30363D;
            }
            QTableWidget::item { 
                padding: 6px; 
            }
            QHeaderView::section { 
                background-color: #161B22; 
                color: #8B949E; 
                border: 1px solid #30363D; 
                font-weight: bold; 
            }
        """)
        layout.addWidget(self.preview_table)

        self.db_columns = db_columns
        self.excel_columns = excel_columns
        self.sample_df = sample_df
        self.combos = {}

        self._populate_mapping_table()
        self._populate_preview_table()

        # Ok / Cancel
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

    def _populate_mapping_table(self):
        """Eşleştirme listesini hazırlar."""
        self.table.setRowCount(len(self.db_columns))

        friendly_names = {
            "part_id": f"{tr('parts.part_name')} (part_id)",
            "quantity": f"{tr('table.quantity')} (quantity)",
            "unit_price": f"{tr('inbound.unit_price')} (unit_price)",
            "total_cost": f"{tr('inbound.total_cost')} (total_cost)",
            "location_id": f"{tr('table.location_id')} (location_id)",
            "created_by": f"{tr('inbound.created_by')} (created_by)",
            "destination": f"{tr('outbound.destination')} (destination)",
            "part_category": f"{tr('table.part_category')} (part_category)",
            "brand_model": f"{tr('table.brand_model')} (brand_model)",
        }

        for idx, db_col in enumerate(self.db_columns):
            display_name = friendly_names.get(db_col, db_col)
            db_item = QTableWidgetItem(display_name)
            db_item.setFlags(db_item.flags() & ~Qt.ItemIsEditable)
            self.table.setItem(idx, 0, db_item)

            combo = QComboBox()
            combo.setStyleSheet("""
                QComboBox {
                    background-color: #161B22; 
                    border: 1px solid #30363D; 
                    padding: 4px 8px; 
                    color: #F0F6FC; 
                    border-radius: 4px;
                    min-height: 24px;
                }
            """)
            combo.addItem("[Eşleştirilmedi]", None)
            for excel_col in self.excel_columns:
                combo.addItem(excel_col, excel_col)

            # Otomatik eşleştirme denemeleri
            matched_idx = combo.findText(db_col, Qt.MatchContains)
            if matched_idx == -1:
                clean_friendly = display_name.split("(")[0].strip()
                matched_idx = combo.findText(clean_friendly, Qt.MatchContains)

            if matched_idx != -1:
                combo.setCurrentIndex(matched_idx)

            self.table.setCellWidget(idx, 1, combo)
            self.table.setRowHeight(idx, 36)
            self.combos[db_col] = combo

    def _populate_preview_table(self):
        """Seçilen Excel dosyasının ilk 5 satırını önizleme tablosuna yazar."""
        cols = self.sample_df.columns.tolist()
        self.preview_table.setColumnCount(len(cols))
        self.preview_table.setHorizontalHeaderLabels(cols)

        # İlk 5 satırı önizleme yap
        preview_rows = self.sample_df.head(5)
        self.preview_table.setRowCount(len(preview_rows))

        for r_idx, (_, row) in enumerate(preview_rows.iterrows()):
            for c_idx, col_name in enumerate(cols):
                val = str(row[col_name]) if not pd.isna(row[col_name]) else ""
                item = QTableWidgetItem(val)
                item.setFlags(item.flags() & ~Qt.ItemIsEditable)
                self.preview_table.setItem(r_idx, c_idx, item)

            self.preview_table.setRowHeight(r_idx, 32)

        self.preview_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)

    def get_mappings(self) -> dict[str, str]:
        """Eşleştirilen alanları döndürür."""
        mapping = {}
        for db_col, combo in self.combos.items():
            val = combo.currentData()
            if val is not None:
                mapping[db_col] = val
        return mapping


def import_excel_flow(parent, db_columns: list[str], callback):
    """Excel kontrol etme ve interaktif eşleştirme akışı."""
    file_path, _ = QFileDialog.getOpenFileName(
        parent, tr("excel.select_file"), "", "Excel Files (*.xlsx *.xls)"
    )
    if not file_path:
        return

    try:
        # 1. Dosyayı oku
        df = pd.read_excel(file_path)
        excel_cols = df.columns.tolist()

        if len(df) == 0:
            QMessageBox.warning(
                parent, "Hata", "Seçilen Excel dosyasında hiç veri bulunamadı!"
            )
            return

        # 2. Önizleme ve eşleştirme modalını göster
        dialog = ExcelMappingDialog(excel_cols, db_columns, df, parent)
        if dialog.exec() == QDialog.Accepted:
            mapping = dialog.get_mappings()
            if not mapping:
                QMessageBox.warning(parent, "Uyarı", "Hiçbir sütun eşleştirilmedi!")
                return

            # Eşleştirilenleri yeniden adlandır ve işle
            inv_mapping = {v: k for k, v in mapping.items()}
            mapped_df = df[list(inv_mapping.keys())].rename(columns=inv_mapping)

            callback(mapped_df)
            QMessageBox.information(parent, "Başarılı", tr("excel.success"))

    except Exception as e:
        QMessageBox.critical(parent, "Hata", f"{tr('excel.error')} {e}")


def export_excel_flow(parent, data: list[dict], default_filename: str):
    """Verileri Excel dosyası olarak dışa aktarır."""
    if not data:
        QMessageBox.warning(parent, "Uyarı", "Dışa aktarılacak veri bulunamadı!")
        return

    file_path, _ = QFileDialog.getSaveFileName(
        parent, "Dosyayı Kaydet", default_filename, "Excel Files (*.xlsx)"
    )
    if not file_path:
        return

    try:
        df = pd.DataFrame(data)
        df.to_excel(file_path, index=False)
        QMessageBox.information(
            parent, "Başarılı", "Veriler başarıyla Excel dosyasına aktarıldı!"
        )
    except Exception as e:
        QMessageBox.critical(parent, "Hata", f"{tr('excel.error')} {e}")
