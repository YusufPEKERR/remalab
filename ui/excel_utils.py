"""
RemaLab WMS - Excel Utilities
Excel İçe/Dışa aktarma ve dinamik kullanıcı dostu sütun eşleştirme logic'i.
"""

import pandas as pd
from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QTableWidget,
    QTableWidgetItem, QComboBox, QPushButton, QLabel,
    QDialogButtonBox, QFileDialog, QMessageBox, QHeaderView
)
from PySide6.QtCore import Qt
from ui.translations import tr


class ExcelMappingDialog(QDialog):
    """Excel başlıkları ile Veritabanı sütunlarını eşleştirme diyaloğu."""

    def __init__(self, excel_columns: list[str], db_columns: list[str], parent=None):
        super().__init__(parent)
        self.setWindowTitle(tr("excel.mapping_title"))
        self.setMinimumWidth(550)
        self.setMinimumHeight(420)
        self.setStyleSheet("background-color: #0D1117; color: #F0F6FC;")

        layout = QVBoxLayout(self)

        lbl = QLabel("Veritabanı sütunlarını hangi Excel sütun başlıkları ile eşleştirmek istediğinizi seçin:")
        lbl.setWordWrap(True)
        lbl.setStyleSheet("color: #8B949E; margin-bottom: 10px;")
        layout.addWidget(lbl)

        # Eşleştirme tablosu
        self.table = QTableWidget()
        self.table.setColumnCount(2)
        self.table.setHorizontalHeaderLabels([tr("excel.db_column"), tr("excel.excel_column")])
        self.table.verticalHeader().setVisible(False)
        self.table.setShowGrid(False)
        self.table.setStyleSheet("""
            QTableWidget { 
                background-color: #0D1117; 
                border: none; 
                color: #F0F6FC;
                gridline-color: transparent;
            }
            QTableWidget::item { 
                color: #F0F6FC; 
                padding-left: 12px;
            }
            QHeaderView::section { 
                background-color: #161B22; 
                color: #8B949E; 
                border: none; 
                font-weight: bold; 
                padding: 8px;
            }
        """)
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        layout.addWidget(self.table)

        self.db_columns = db_columns
        self.excel_columns = excel_columns
        self.combos = {}

        self._populate_table()

        # Ok / Cancel
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

    def _populate_table(self):
        """Tabloyu doldurur ve combobox'ları yerleştirir."""
        self.table.setRowCount(len(self.db_columns))
        
        # Teknik kolon isimlerini kullanıcı dostu etiketlere eşle
        friendly_names = {
            "part_id": f"{tr('parts.part_name')} (part_id)",
            "quantity": f"{tr('table.quantity')} (quantity)",
            "unit_price": f"{tr('inbound.unit_price')} (unit_price)",
            "total_cost": f"{tr('inbound.total_cost')} (total_cost)",
            "location_id": f"{tr('table.location_id')} (location_id)",
            "created_by": f"{tr('inbound.created_by')} (created_by)",
            "destination": f"{tr('outbound.destination')} (destination)"
        }

        for idx, db_col in enumerate(self.db_columns):
            # Sol sütun (Veritabanı alanı - kullanıcı dostu adı ile)
            display_name = friendly_names.get(db_col, db_col)
            db_item = QTableWidgetItem(display_name)
            db_item.setFlags(db_item.flags() & ~Qt.ItemIsEditable)
            self.table.setItem(idx, 0, db_item)

            # Sağ sütun (Excel Dropdown'ı)
            combo = QComboBox()
            combo.setStyleSheet("""
                QComboBox {
                    background-color: #161B22; 
                    border: 1px solid #30363D; 
                    padding: 6px 12px; 
                    color: #F0F6FC; 
                    border-radius: 4px;
                    min-height: 24px;
                }
                QComboBox QAbstractItemView {
                    background-color: #161B22;
                    border: 1px solid #30363D;
                    color: #F0F6FC;
                    selection-background-color: #1F6FEB;
                }
            """)
            # Boş geçebilme seçeneği
            combo.addItem("[Eşleştirilmedi]", None)
            for excel_col in self.excel_columns:
                combo.addItem(excel_col, excel_col)

            # Akıllı otomatik eşleştirme (isim benzerliğine göre)
            matched_idx = combo.findText(db_col, Qt.MatchContains)
            if matched_idx == -1:
                # Friendly isme göre de dene
                clean_friendly = display_name.split("(")[0].strip()
                matched_idx = combo.findText(clean_friendly, Qt.MatchContains)

            if matched_idx != -1:
                combo.setCurrentIndex(matched_idx)

            self.table.setCellWidget(idx, 1, combo)
            self.table.setRowHeight(idx, 42)
            self.combos[db_col] = combo

    def get_mappings(self) -> dict[str, str]:
        """Seçilen eşleştirmeleri döndürür: {db_column: excel_column_name}"""
        mapping = {}
        for db_col, combo in self.combos.items():
            val = combo.currentData()
            if val is not None:
                mapping[db_col] = val
        return mapping


def import_excel_flow(parent, db_columns: list[str], callback):
    """Excel'den veri aktarım akışını yöneten genel yardımcı metot."""
    file_path, _ = QFileDialog.getOpenFileName(
        parent, tr("excel.select_file"), "", "Excel Files (*.xlsx *.xls)"
    )
    if not file_path:
        return

    try:
        # Excel dosyasını oku
        df = pd.read_excel(file_path)
        excel_cols = df.columns.tolist()

        # Eşleştirme ekranını göster
        dialog = ExcelMappingDialog(excel_cols, db_columns, parent)
        if dialog.exec() == QDialog.Accepted:
            mapping = dialog.get_mappings()
            if not mapping:
                QMessageBox.warning(parent, "Uyarı", "Hiçbir sütun eşleştirilmedi!")
                return

            # Eşleştirilen sütunları yeniden adlandır
            inv_mapping = {v: k for k, v in mapping.items()}
            mapped_df = df[list(inv_mapping.keys())].rename(columns=inv_mapping)

            # Kayıt işlemi için callback tetikle
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
        QMessageBox.information(parent, "Başarılı", "Veriler başarıyla Excel dosyasına aktarıldı!")
    except Exception as e:
        QMessageBox.critical(parent, "Hata", f"{tr('excel.error')} {e}")
