"""
RemaLab WMS - Reports Page
Depo giriş ve çıkış hareketlerinin salt-okunur özet listesi.
"""

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QTableWidget, QTableWidgetItem, QHeaderView, QPushButton,
    QComboBox,
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
            QComboBox::drop-down {
                border-left: 1px solid #30363D;
                width: 20px;
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

        self._subtitle_lbl = QLabel(tr("reports.subtitle"))
        self._subtitle_lbl.setObjectName("page_subtitle")
        title_layout.addWidget(self._subtitle_lbl)

        header_layout.addWidget(title_section)
        header_layout.addStretch()



        layout.addLayout(header_layout)

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

        filter_layout.addStretch()
        layout.addLayout(filter_layout)

        # Hareket tablosu
        self._table = QTableWidget()
        self._table.setColumnCount(6)
        self._table.setAlternatingRowColors(True)
        self._table.setEditTriggers(QTableWidget.NoEditTriggers)
        self._table.verticalHeader().setVisible(False)
        self._table.setSelectionBehavior(QTableWidget.SelectRows)
        self._table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        layout.addWidget(self._table)

        self._load_entries()

    def showEvent(self, event):
        """Sayfa her gösterildiğinde hareket listesini yeniler."""
        super().showEvent(event)
        self._load_entries()

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
                    self._table.setItem(
                        r_idx,
                        3,
                        QTableWidgetItem(str(row[2]) if row[2] is not None else "-"),
                    )
                    self._table.setItem(r_idx, 4, QTableWidgetItem(str(row[3])))
                    self._table.setItem(r_idx, 5, QTableWidgetItem(str(row[5])))
                    self._table.setRowHeight(r_idx, 44)
            finally:
                db.close()
        except Exception as e:
            print(f"[Error Loading Reports] {e}")

    def _retranslate(self):
        """Dili günceller."""
        self._title_lbl.setText(tr("reports.title"))
        self._subtitle_lbl.setText(tr("reports.subtitle"))
        self._start_date_lbl.setText(tr("reports.start_date") + ":")
        self._end_date_lbl.setText(tr("reports.end_date") + ":")
        self._filter_btn.setText(tr("reports.filter"))
        self._load_entries()
