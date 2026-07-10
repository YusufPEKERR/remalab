"""
RemaLab WMS - Reports Page
Depo giriş ve çıkış hareketlerinin salt-okunur özet listesi ve kritik stok raporu.
"""

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QTableWidget, QTableWidgetItem, QHeaderView, QPushButton,
    QComboBox, QTabWidget, QFileDialog, QMessageBox
)
from PySide6.QtCore import Qt, QDate
from ui.translations import tr, get_translator


class ReportsPage(QWidget):
    """Giriş/çıkış hareketlerini birleşik olarak listeleyen rapor ekranı."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._setup_ui()
        get_translator().language_changed.connect(self._retranslate)

    def _create_date_selectors(self):
        layout = QHBoxLayout()
        layout.setSpacing(4)
        
        day_cb = QComboBox()
        for i in range(1, 32):
            day_cb.addItem(f"{i:02d}")
            
        month_cb = QComboBox()
        for i in range(1, 13):
            month_cb.addItem(f"{i:02d}")
            
        year_cb = QComboBox()
        current_year = QDate.currentDate().year()
        for i in range(current_year - 5, current_year + 5):
            year_cb.addItem(str(i))
            
        cb_style = """
            QComboBox {
                background-color: #161B22;
                border: 1px solid #30363D;
                border-radius: 6px;
                padding: 6px 12px;
                color: #C9D1D9;
                font-size: 13px;
                min-width: 45px;
            }
            QComboBox:focus {
                border-color: #1F6FEB;
            }
            QComboBox QAbstractItemView {
                background-color: #161B22;
                border: 1px solid #30363D;
                color: #C9D1D9;
                selection-background-color: #1F6FEB;
            }
        """
        day_cb.setStyleSheet(cb_style)
        month_cb.setStyleSheet(cb_style)
        year_cb.setStyleSheet(cb_style)
        
        layout.addWidget(day_cb)
        layout.addWidget(month_cb)
        layout.addWidget(year_cb)
        
        return layout, day_cb, month_cb, year_cb

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

        self._title_lbl = QLabel(tr("reports.title"))
        self._title_lbl.setObjectName("page_title")
        title_layout.addWidget(self._title_lbl)

        self._subtitle_lbl = QLabel("Tüm hareketleri ve kritik stok durumlarını raporlayın")
        self._subtitle_lbl.setObjectName("page_subtitle")
        title_layout.addWidget(self._subtitle_lbl)

        header_layout.addWidget(title_section)
        header_layout.addStretch()

        layout.addLayout(header_layout)

        # Tabs
        self._tabs = QTabWidget()
        layout.addWidget(self._tabs)

        # TAB 1: Tüm Hareketler
        self._movements_tab = QWidget()
        movements_layout = QVBoxLayout(self._movements_tab)
        movements_layout.setContentsMargins(12, 12, 12, 12)

        # Tarih Aralığı Filtresi
        filter_layout = QHBoxLayout()
        filter_layout.setSpacing(12)

        self._start_date_lbl = QLabel(tr("reports.start_date") + ":")
        filter_layout.addWidget(self._start_date_lbl)

        start_layout, self._start_day, self._start_month, self._start_year = self._create_date_selectors()
        filter_layout.addLayout(start_layout)
        
        start_date = QDate.currentDate().addDays(-30)
        self._start_day.setCurrentText(f"{start_date.day():02d}")
        self._start_month.setCurrentText(f"{start_date.month():02d}")
        self._start_year.setCurrentText(str(start_date.year()))

        self._end_date_lbl = QLabel(tr("reports.end_date") + ":")
        filter_layout.addWidget(self._end_date_lbl)

        end_layout, self._end_day, self._end_month, self._end_year = self._create_date_selectors()
        filter_layout.addLayout(end_layout)

        end_date = QDate.currentDate()
        self._end_day.setCurrentText(f"{end_date.day():02d}")
        self._end_month.setCurrentText(f"{end_date.month():02d}")
        self._end_year.setCurrentText(str(end_date.year()))

        self._filter_btn = QPushButton(tr("reports.filter"))
        self._filter_btn.setCursor(Qt.PointingHandCursor)
        self._filter_btn.clicked.connect(self._load_entries)
        filter_layout.addWidget(self._filter_btn)
        
        self._export_general_btn = QPushButton("📊 Excel'e Aktar")
        self._export_general_btn.setCursor(Qt.PointingHandCursor)
        self._export_general_btn.clicked.connect(self._export_general_excel)
        filter_layout.addWidget(self._export_general_btn)

        filter_layout.addStretch()
        movements_layout.addLayout(filter_layout)

        # Hareket tablosu
        self._table = QTableWidget()
        self._table.setColumnCount(6)
        self._table.setAlternatingRowColors(True)
        self._table.setEditTriggers(QTableWidget.NoEditTriggers)
        self._table.verticalHeader().setVisible(False)
        self._table.setSelectionBehavior(QTableWidget.SelectRows)
        self._table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        movements_layout.addWidget(self._table)

        self._tabs.addTab(self._movements_tab, "Genel Raporlar")

        # TAB 2: Kritik Stok Raporları
        self._critical_tab = QWidget()
        critical_layout = QVBoxLayout(self._critical_tab)
        critical_layout.setContentsMargins(12, 12, 12, 12)

        self._export_critical_btn = QPushButton("📊 Excel'e Aktar")
        self._export_critical_btn.setCursor(Qt.PointingHandCursor)
        self._export_critical_btn.clicked.connect(self._export_critical_excel)
        self._export_critical_btn.setFixedWidth(150)
        self._export_critical_btn.setObjectName("btn_secondary")
        
        critical_btn_layout = QHBoxLayout()
        critical_btn_layout.addWidget(self._export_critical_btn)
        critical_btn_layout.addStretch()
        critical_layout.addLayout(critical_btn_layout)

        self._critical_table = QTableWidget()
        self._critical_table.setColumnCount(4)
        self._critical_table.setAlternatingRowColors(True)
        self._critical_table.setEditTriggers(QTableWidget.NoEditTriggers)
        self._critical_table.verticalHeader().setVisible(False)
        self._critical_table.setSelectionBehavior(QTableWidget.SelectRows)
        self._critical_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        critical_layout.addWidget(self._critical_table)

        self._tabs.addTab(self._critical_tab, "Kritik Raporlar")

        self._tabs.currentChanged.connect(self._on_tab_changed)
        self._load_entries()

    def _on_tab_changed(self, index):
        if index == 1:
            self._load_critical_stock()

    def showEvent(self, event):
        """Sayfa her gösterildiğinde listeyi yeniler."""
        super().showEvent(event)
        self._load_entries()
        if self._tabs.currentIndex() == 1:
            self._load_critical_stock()

    def _update_headers(self):
        self._table.setHorizontalHeaderLabels(
            [
                tr("table.date"),
                tr("table.type"),
                tr("table.part_name"),
                tr("table.location"),
                tr("table.quantity"),
                tr("inbound.created_by"),
            ]
        )
        self._critical_table.setHorizontalHeaderLabels(
            [
                "Parça Adı",
                "Lokasyon",
                "Mevcut Stok",
                "Kritik Limit",
            ]
        )

    def _load_critical_stock(self):
        self._critical_table.clearContents()
        self._update_headers()
        
        try:
            from config.database import SessionLocal
            from sqlalchemy import text
            
            db = SessionLocal()
            try:
                sql = """
                    SELECT p.name, l.name, s.quantity, p.critical_limit
                    FROM warehouse.stock s
                    JOIN warehouse.parts p ON s.part_id = p.id
                    JOIN warehouse.locations l ON s.location_id = l.id
                    WHERE s.quantity <= COALESCE(p.critical_limit, 10)
                    ORDER BY s.quantity ASC;
                """
                rows = db.execute(text(sql)).fetchall()
                self._critical_table.setRowCount(len(rows))
                
                for r_idx, row in enumerate(rows):
                    p_name, l_name, qty, limit = row
                    
                    self._critical_table.setItem(r_idx, 0, QTableWidgetItem(str(p_name)))
                    self._critical_table.setItem(r_idx, 1, QTableWidgetItem(str(l_name)))
                    
                    qty_item = QTableWidgetItem(str(qty))
                    qty_item.setForeground(Qt.red)
                    self._critical_table.setItem(r_idx, 2, qty_item)
                    
                    self._critical_table.setItem(r_idx, 3, QTableWidgetItem(str(limit if limit else 10)))
                    
            finally:
                db.close()
        except Exception as e:
            print(f"Kritik stok yüklenirken hata: {e}")

    def _load_entries(self):
        """Giriş ve çıkış kayıtlarını, seçilen tarih aralığında birleştirip PostgreSQL'den çeker (salt okunur)."""
        self._update_headers()
        self._table.clearContents()

        start_date = f"{self._start_year.currentText()}-{self._start_month.currentText()}-{self._start_day.currentText()}"
        end_date = f"{self._end_year.currentText()}-{self._end_month.currentText()}-{self._end_day.currentText()}"

        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                rows = db.execute(text("""
                    SELECT * FROM (
                        SELECT 'inbound' AS mtype, p.name AS part_name, NULL AS location_name,
                               e.quantity, e.created_at, e.created_by
                        FROM warehouse.inbound_entries e
                        JOIN warehouse.parts p ON e.part_id = p.id
                        UNION ALL
                        SELECT 'outbound' AS mtype, p.name AS part_name, l.name AS location_name,
                               e.quantity, e.created_at, e.created_by
                        FROM warehouse.outbound_entries e
                        JOIN warehouse.parts p ON e.part_id = p.id
                        JOIN warehouse.locations l ON e.location_id = l.id
                    ) AS combined
                    WHERE created_at::date BETWEEN :start_date AND :end_date
                    ORDER BY created_at DESC
                    LIMIT 5000;
                """), {"start_date": start_date, "end_date": end_date}).fetchall()

                self._table.setRowCount(len(rows))
                for r_idx, row in enumerate(rows):
                    mtype_key = (
                        "movement.inbound"
                        if row[0] == "inbound"
                        else "movement.outbound"
                    )
                    self._table.setItem(r_idx, 0, QTableWidgetItem(str(row[4])[:16]))
                    self._table.setItem(r_idx, 1, QTableWidgetItem(tr(mtype_key)))
                    self._table.setItem(r_idx, 2, QTableWidgetItem(str(row[1])))
                    self._table.setItem(r_idx, 3, QTableWidgetItem(str(row[2]) if row[2] else "-"))
                    self._table.setItem(r_idx, 4, QTableWidgetItem(str(row[3])))
                    self._table.setItem(r_idx, 5, QTableWidgetItem(str(row[5])))
            finally:
                db.close()
        except Exception as e:
            print(f"Raporlar yüklenemedi: {e}")

    def _retranslate(self):
        self._title_lbl.setText(tr("reports.title"))
        self._start_date_lbl.setText(tr("reports.start_date") + ":")
        self._end_date_lbl.setText(tr("reports.end_date") + ":")
        self._filter_btn.setText(tr("reports.filter"))
        self._update_headers()

    def _export_general_excel(self):
        try:
            import pandas as pd
        except ImportError:
            QMessageBox.critical(self, "Hata", "pandas kütüphanesi eksik!")
            return

        if self._table.rowCount() == 0:
            QMessageBox.warning(self, "Uyarı", "Tabloda dışa aktarılacak veri yok.")
            return

        filepath, _ = QFileDialog.getSaveFileName(self, "Excel Dışa Aktar", "genel_raporlar.xlsx", "Excel Files (*.xlsx)")
        if not filepath:
            return

        data = []
        for r in range(self._table.rowCount()):
            row_data = {}
            for c in range(self._table.columnCount()):
                header_item = self._table.horizontalHeaderItem(c)
                col_name = header_item.text() if header_item else f"Sütun {c+1}"
                item = self._table.item(r, c)
                row_data[col_name] = item.text() if item else ""
            data.append(row_data)

        try:
            from ui.excel_utils import style_excel_file
            df = pd.DataFrame(data)
            df.to_excel(filepath, index=False)
            style_excel_file(filepath)
            QMessageBox.information(self, "Başarılı", "Genel Raporlar başarıyla Excel'e aktarıldı.")
        except Exception as e:
            QMessageBox.critical(self, "Hata", f"Excel kaydedilirken hata oluştu:\n{e}")

    def _export_critical_excel(self):
        try:
            import pandas as pd
        except ImportError:
            QMessageBox.critical(self, "Hata", "pandas kütüphanesi eksik!")
            return

        if self._critical_table.rowCount() == 0:
            QMessageBox.warning(self, "Uyarı", "Kritik tabloda dışa aktarılacak veri yok.")
            return

        filepath, _ = QFileDialog.getSaveFileName(self, "Excel Dışa Aktar", "kritik_raporlar.xlsx", "Excel Files (*.xlsx)")
        if not filepath:
            return

        data = []
        for r in range(self._critical_table.rowCount()):
            row_data = {}
            for c in range(self._critical_table.columnCount()):
                header_item = self._critical_table.horizontalHeaderItem(c)
                col_name = header_item.text() if header_item else f"Sütun {c+1}"
                item = self._critical_table.item(r, c)
                row_data[col_name] = item.text() if item else ""
            data.append(row_data)

        try:
            from ui.excel_utils import style_excel_file
            df = pd.DataFrame(data)
            df.to_excel(filepath, index=False)
            style_excel_file(filepath)
            QMessageBox.information(self, "Başarılı", "Kritik Raporlar başarıyla Excel'e aktarıldı.")
        except Exception as e:
            QMessageBox.critical(self, "Hata", f"Excel kaydedilirken hata oluştu:\n{e}")
