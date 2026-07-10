"""
RemaLab WMS - Reports Page
Depo giriş ve çıkış hareketlerinin salt-okunur özet listesi.
"""

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QTableWidget, QTableWidgetItem, QHeaderView, QPushButton,
    QDateTimeEdit,
)
from PySide6.QtCore import Qt, QDate, QTime, QDateTime
from ui.translations import tr, get_translator


class ReportsPage(QWidget):
    """Giriş/çıkış hareketlerini birleşik olarak listeleyen rapor ekranı."""

    def __init__(self, parent=None):
        super().__init__(parent)
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
        
        dt_style = """
            QDateTimeEdit {
                background-color: #161B22;
                border: 1px solid #30363D;
                border-radius: 6px;
                padding: 6px 12px;
                color: #C9D1D9;
                font-size: 13px;
                min-width: 140px;
            }
            QDateTimeEdit:focus {
                border-color: #1F6FEB;
            }
            QDateTimeEdit::drop-down {
                border-left: 1px solid #30363D;
                width: 20px;
            }
        """

        self._start_date_lbl = QLabel(tr("reports.start_date") + ":")
        filter_layout.addWidget(self._start_date_lbl)

        self._start_datetime = QDateTimeEdit()
        self._start_datetime.setCalendarPopup(True)
        self._start_datetime.setDisplayFormat("dd.MM.yyyy HH:mm")
        self._start_datetime.setStyleSheet(dt_style)
        
        start_dt = QDateTime.currentDateTime().addDays(-30)
        start_dt.setTime(QTime(0, 0))
        self._start_datetime.setDateTime(start_dt)
        
        filter_layout.addWidget(self._start_datetime)

        self._end_date_lbl = QLabel(tr("reports.end_date") + ":")
        filter_layout.addWidget(self._end_date_lbl)

        self._end_datetime = QDateTimeEdit()
        self._end_datetime.setCalendarPopup(True)
        self._end_datetime.setDisplayFormat("dd.MM.yyyy HH:mm")
        self._end_datetime.setStyleSheet(dt_style)
        
        end_dt = QDateTime.currentDateTime()
        end_dt.setTime(QTime(23, 59))
        self._end_datetime.setDateTime(end_dt)
        
        filter_layout.addWidget(self._end_datetime)

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

        start_date = self._start_datetime.dateTime().toString("yyyy-MM-dd HH:mm:ss")
        end_date = self._end_datetime.dateTime().toString("yyyy-MM-dd HH:mm:ss")

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
                    WHERE created_at >= CAST(:start_date AS timestamp) AND created_at <= CAST(:end_date AS timestamp)
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
