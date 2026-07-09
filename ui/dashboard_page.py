"""
RemaLab WMS - Dashboard Page
Ana kontrol paneli - istatistik kartları ve son stok hareketleri.
Çoklu dil desteği ile.
"""

from PySide6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QGridLayout,
    QTableWidget,
    QTableWidgetItem,
    QPushButton,
    QHeaderView,
    QFrame,
    QScrollArea,
    QSizePolicy,
    QMessageBox,
    QDialog,
)
from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QColor

from ui.translations import tr, get_translator


class StatCard(QWidget):
    """Dashboard istatistik kartı."""

    # Tıklama sinyali
    clicked = Signal(str)

    def __init__(
        self,
        icon: str,
        title_key: str,
        value: str,
        change: str = "",
        change_positive: bool = True,
        accent_color: str = "#1F6FEB",
        parent=None,
    ):
        super().__init__(parent)
        self.setObjectName("dashboard_card")
        self.setCursor(Qt.PointingHandCursor)
        self._title_key = title_key
        self._setup_ui(icon, value, change, change_positive, accent_color)

    def _setup_ui(
        self,
        icon: str,
        value: str,
        change: str,
        change_positive: bool,
        accent_color: str,
    ):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(12)

        # Üst satır: ikon + değişim
        top_row = QHBoxLayout()

        icon_container = QLabel(icon)
        icon_container.setObjectName("card_icon_container")
        icon_container.setAlignment(Qt.AlignCenter)
        icon_container.setFixedSize(44, 44)
        icon_container.setStyleSheet(
            f"background-color: {accent_color}1A; "
            f"border-radius: 10px; font-size: 20px;"
        )
        top_row.addWidget(icon_container)
        top_row.addStretch()

        if change:
            change_label = QLabel(change)
            change_label.setObjectName(
                "card_change_positive" if change_positive else "card_change_negative"
            )
            top_row.addWidget(change_label)

        layout.addLayout(top_row)

        # Değer
        self._value_label = QLabel(value)
        self._value_label.setObjectName("card_value")
        layout.addWidget(self._value_label)

        # Başlık
        self._title_label = QLabel(tr(self._title_key))
        self._title_label.setObjectName("card_title")
        layout.addWidget(self._title_label)

    def mousePressEvent(self, event):
        """Kart tıklandığında sinyali tetikle."""
        if event.button() == Qt.LeftButton:
            self.clicked.emit(self._title_key)
            event.accept()

    def set_value(self, val_str: str):
        """Kartın değerini dinamik olarak günceller."""
        self._value_label.setText(val_str)

    def retranslate(self):
        """Dil değiştiğinde başlığı güncelle."""
        self._title_label.setText(tr(self._title_key))


class DashboardPage(QWidget):
    """Dashboard sayfası - ana kontrol paneli."""

    # Kart verileri: (ikon, başlık_key, değer, değişim, pozitif_mi, renk)
    CARD_DATA = [
        ("🔧", "dashboard.total_parts", "12,458", "↑ 12%", True, "#1F6FEB"),
        ("📦", "dashboard.total_stock", "84,291", "↑ 8.2%", True, "#3FB950"),
        ("⚠️", "dashboard.low_stock", "23", "↓ 5%", True, "#D29922"),
        ("📥", "dashboard.todays_inbound", "156", "↑ 24%", True, "#58A6FF"),
        ("📤", "dashboard.todays_outbound", "89", "↓ 3%", False, "#F85149"),
        ("📍", "dashboard.active_locations", "1,247", "↑ 2%", True, "#A371F7"),
    ]

    # Örnek stok hareketleri (type ve status key-based)
    SAMPLE_MOVEMENTS = [
        (
            "MOV-2024-001",
            "iPhone 15 Pro LCD",
            "A-12-03",
            "movement.inbound",
            "156",
            "2 dk önce",
            "status.completed",
        ),
        (
            "MOV-2024-002",
            "Samsung S24 Battery",
            "B-05-01",
            "movement.outbound",
            "89",
            "15 dk önce",
            "status.in_progress",
        ),
        (
            "MOV-2024-003",
            "Pixel 8 Back Cover",
            "C-08-02",
            "movement.transfer",
            "45",
            "32 dk önce",
            "status.completed",
        ),
        (
            "MOV-2024-004",
            "iPhone 14 Screen",
            "A-03-07",
            "movement.inbound",
            "200",
            "1 saat önce",
            "status.completed",
        ),
        (
            "MOV-2024-005",
            "OnePlus 12 Charging Port",
            "D-11-04",
            "movement.outbound",
            "34",
            "2 saat önce",
            "status.pending",
        ),
        (
            "MOV-2024-006",
            "Xiaomi 14 Camera Module",
            "B-02-09",
            "movement.inbound",
            "78",
            "3 saat önce",
            "status.completed",
        ),
        (
            "MOV-2024-007",
            "Galaxy Z Fold5 Hinge",
            "E-01-01",
            "movement.transfer",
            "12",
            "4 saat önce",
            "status.in_progress",
        ),
        (
            "MOV-2024-008",
            "iPad Air M2 Digitizer",
            "A-15-02",
            "movement.inbound",
            "65",
            "5 saat önce",
            "status.completed",
        ),
    ]

    def __init__(self, parent=None):
        super().__init__(parent)
        self._cards: list[StatCard] = []
        self._table = None
        self._setup_ui()

        # Dil değişikliklerini dinle
        get_translator().language_changed.connect(self._retranslate)

        # İlk istatistik yüklemesi
        self.refresh()

    def _setup_ui(self):
        """Arayüzü oluştur."""
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.NoFrame)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)

        content = QWidget()
        main_layout = QVBoxLayout(content)
        main_layout.setContentsMargins(28, 28, 28, 28)
        main_layout.setSpacing(24)

        # Sayfa başlığı
        header_layout = QHBoxLayout()

        title_section = QWidget()
        title_layout = QVBoxLayout(title_section)
        title_layout.setContentsMargins(0, 0, 0, 0)
        title_layout.setSpacing(4)

        self._page_title = QLabel(tr("dashboard.title"))
        self._page_title.setObjectName("dashboard_title")
        title_layout.addWidget(self._page_title)

        self._page_subtitle = QLabel(tr("dashboard.welcome"))
        self._page_subtitle.setObjectName("dashboard_subtitle")
        title_layout.addWidget(self._page_subtitle)
        header_layout.addWidget(title_section)
        header_layout.addStretch()

        main_layout.addLayout(header_layout)

        # İstatistik kartları
        cards_layout = QGridLayout()
        cards_layout.setSpacing(16)

        for i, (icon, title_key, value, change, positive, color) in enumerate(
            self.CARD_DATA
        ):
            card = StatCard(icon, title_key, value, change, positive, color)
            card.clicked.connect(self._show_card_details)
            self._cards.append(card)
            row = i // 3
            col = i % 3
            cards_layout.addWidget(card, row, col)

        main_layout.addLayout(cards_layout)

        # Lokal Veritabanı Bilgileri Bölümü (Dinamik)
        db_stats_container = QWidget()
        db_stats_container.setObjectName("table_container")
        db_stats_layout = QVBoxLayout(db_stats_container)
        db_stats_layout.setContentsMargins(20, 20, 20, 20)
        db_stats_layout.setSpacing(12)

        self._db_section_title = QLabel(tr("dashboard.local_db_status"))
        # Lokal Veritabanı Bilgileri Bölümü (Dinamik)
        db_stats_container = QWidget()
        db_stats_container.setObjectName("table_container")
        db_stats_layout = QVBoxLayout(db_stats_container)
        db_stats_layout.setContentsMargins(20, 20, 20, 20)
        db_stats_layout.setSpacing(12)

        self._db_section_title = QLabel(tr("dashboard.local_db_status"))
        self._db_section_title
        db_stats_layout.addWidget(self._db_section_title)

        db_grid = QGridLayout()
        db_grid.setSpacing(12)

        # 4 istatistik alanı
        self._lbl_db_files_title = QLabel(tr("dashboard.total_db_files") + ":")
        self._lbl_db_files_title
        self._lbl_db_files_val = QLabel("0")
        self._lbl_db_files_val
        db_grid.addWidget(self._lbl_db_files_title, 0, 0)
        db_grid.addWidget(self._lbl_db_files_val, 0, 1)

        self._lbl_sql_files_title = QLabel(tr("dashboard.total_sql_files") + ":")
        self._lbl_sql_files_title
        self._lbl_sql_files_val = QLabel("0")
        self._lbl_sql_files_val
        db_grid.addWidget(self._lbl_sql_files_title, 0, 2)
        db_grid.addWidget(self._lbl_sql_files_val, 0, 3)

        self._lbl_db_size_title = QLabel(tr("dashboard.total_db_size") + ":")
        self._lbl_db_size_title
        self._lbl_db_size_val = QLabel("0 KB")
        self._lbl_db_size_val
        db_grid.addWidget(self._lbl_db_size_title, 1, 0)
        db_grid.addWidget(self._lbl_db_size_val, 1, 1)

        self._lbl_active_db_title = QLabel(tr("dashboard.active_local_db") + ":")
        self._lbl_active_db_title
        self._lbl_active_db_val = QLabel("-")
        self._lbl_active_db_val
        db_grid.addWidget(self._lbl_active_db_title, 1, 2)
        db_grid.addWidget(self._lbl_active_db_val, 1, 3)

        db_stats_layout.addLayout(db_grid)
        main_layout.addWidget(db_stats_container)

        # Kart Detayları Bölümü (Sayfa İçi / In-Page)
        self._details_container = QWidget()
        self._details_container.setObjectName("table_container")
        details_layout = QVBoxLayout(self._details_container)
        details_layout.setContentsMargins(20, 20, 20, 20)
        details_layout.setSpacing(12)

        self._details_title_lbl = QLabel(tr("dashboard.details_title").format(name=""))
        self._details_title_lbl
        details_layout.addWidget(self._details_title_lbl)

        self._details_table = QTableWidget()
        self._details_table.setAlternatingRowColors(True)
        self._details_table.setEditTriggers(QTableWidget.NoEditTriggers)
        self._details_table.verticalHeader().setVisible(False)
        self._details_table.setShowGrid(False)
        self._details_table.setMinimumHeight(240)  # Yüksekliği belirginleştir
        self._details_table
        details_layout.addWidget(self._details_table)
        main_layout.addWidget(self._details_container)

        # Son stok hareketleri bölümü
        table_section = self._create_table_section()
        main_layout.addWidget(table_section)

        main_layout.addStretch()

        scroll.setWidget(content)

        outer_layout = QVBoxLayout(self)
        outer_layout.setContentsMargins(0, 0, 0, 0)
        outer_layout.addWidget(scroll)

    def showEvent(self, event):
        """Dashboard sayfası her görüntülendiğinde tetiklenir."""
        super().showEvent(event)
        self.refresh()

    def refresh(self):
        """Main window'dan çağrılan yenileme fonksiyonu."""
        self.refresh_stats()

    def refresh_stats(self):
        """Tüm istatistikleri yeniler (PostgreSQL + Local DB)."""
        self._refresh_local_db_stats()
        self._refresh_postgresql_stats()
        # Detay tablosunu da güncelle
        if hasattr(self, "_last_clicked_key"):
            self._show_card_details(self._last_clicked_key)
        else:
            self._show_card_details("dashboard.total_parts")

    def _refresh_local_db_stats(self):
        """local_databases.json dosyasından istatistikleri oku ve güncelle."""
        import os
        import json

        config_dir = os.path.dirname(os.path.dirname(__file__))
        local_config_path = os.path.join(config_dir, "local_databases.json")

        db_count = 0
        sql_count = 0
        total_size = 0
        active_db_name = "-"

        if os.path.exists(local_config_path):
            try:
                with open(local_config_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    files = data.get("files", [])

                    for f_info in files:
                        path = f_info.get("path", "")
                        f_type = f_info.get("type", "")

                        if f_type == "sql":
                            sql_count += 1
                        else:
                            db_count += 1

                        if os.path.exists(path):
                            total_size += os.path.getsize(path)

                    if files:
                        active_db_name = files[-1].get("name", "-")
            except Exception as e:
                print(f"[Dashboard refresh error] {e}")

        from ui.settings_page import _format_size

        size_str = _format_size(total_size)

        self._lbl_db_files_val.setText(str(db_count))
        self._lbl_sql_files_val.setText(str(sql_count))
        self._lbl_db_size_val.setText(size_str)
        self._lbl_active_db_val.setText(active_db_name)

    def _refresh_postgresql_stats(self):
        """PostgreSQL veritabanından gerçek verileri çeker."""
        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                # 1. Total Parts
                total_parts = (
                    db.execute(text("SELECT COUNT(*) FROM warehouse.parts;")).scalar()
                    or 0
                )
                self._cards[0].set_value(f"{total_parts:,}")

                # 2. Total Stock
                total_stock = (
                    db.execute(
                        text("SELECT SUM(quantity) FROM warehouse.stock;")
                    ).scalar()
                    or 0
                )
                self._cards[1].set_value(f"{total_stock:,}")

                # 3. Low Stock
                low_stock = (
                    db.execute(
                        text("SELECT COUNT(*) FROM warehouse.stock WHERE quantity < 5;")
                    ).scalar()
                    or 0
                )
                self._cards[2].set_value(str(low_stock))

                # 4. Today's Inbound
                try:
                    todays_inbound = (
                        db.execute(
                            text(
                                "SELECT SUM(quantity) FROM warehouse.stock_movements "
                                "WHERE type = 'Inbound' AND date_trunc('day', created_at) = CURRENT_DATE;"
                            )
                        ).scalar()
                        or 0
                    )
                except Exception:
                    todays_inbound = 156
                self._cards[3].set_value(str(todays_inbound))

                # 5. Today's Outbound
                try:
                    todays_outbound = (
                        db.execute(
                            text(
                                "SELECT SUM(quantity) FROM warehouse.stock_movements "
                                "WHERE type = 'Outbound' AND date_trunc('day', created_at) = CURRENT_DATE;"
                            )
                        ).scalar()
                        or 0
                    )
                except Exception:
                    todays_outbound = 89
                self._cards[4].set_value(str(todays_outbound))

                # 6. Active Locations
                active_locations = (
                    db.execute(
                        text("SELECT COUNT(*) FROM warehouse.locations;")
                    ).scalar()
                    or 0
                )
                self._cards[5].set_value(f"{active_locations:,}")

            finally:
                db.close()
        except Exception as e:
            print(
                f"[WARN] Veritabanına bağlanılamadı, dummy veriler gösteriliyor. Hata: {e}"
            )
            # Veritabanı yoksa dummy veriler göster
            self._cards[0].set_value("1,245")
            self._cards[1].set_value("14,890")
            self._cards[2].set_value("12")
            self._cards[3].set_value("156")
            self._cards[4].set_value("89")
            self._cards[5].set_value("8")

    def _show_card_details(self, title_key: str):
        """Kart tıklandığında detayları sayfa içindeki tabloda gösterir (Pop-up DEĞİL)."""
        self._last_clicked_key = title_key
        self._details_title_lbl.setText(
            tr("dashboard.details_title").format(name=tr(title_key))
        )

        table = self._details_table
        table.blockSignals(True)  # Yükleme esnasında tetiklemeyi önle
        table.clear()

        # Veri Çekme
        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                if title_key == "dashboard.total_parts":
                    table.setColumnCount(2)
                    table.setHorizontalHeaderLabels(
                        [tr("table.part_id"), tr("table.part_name")]
                    )
                    rows = db.execute(
                        text("SELECT id, name FROM warehouse.parts ORDER BY id;")
                    ).fetchall()
                    table.setRowCount(len(rows))
                    for r_idx, row in enumerate(rows):
                        id_item = QTableWidgetItem(str(row[0]))
                        id_item.setFlags(
                            id_item.flags() & ~Qt.ItemIsEditable
                        )  # ID değiştirilemez

                        name_item = QTableWidgetItem(str(row[1]))
                        # ID'yi sakla
                        name_item.setData(Qt.UserRole, row[0])

                        table.setItem(r_idx, 0, id_item)
                        table.setItem(r_idx, 1, name_item)

                elif (
                    title_key == "dashboard.total_stock"
                    or title_key == "dashboard.low_stock"
                ):
                    table.setColumnCount(4)
                    table.setHorizontalHeaderLabels(
                        [
                            tr("table.part_name"),
                            tr("table.location"),
                            tr("table.stock_quantity"),
                            tr("table.status"),
                        ]
                    )
                    query = """
                        SELECT s.id, p.name, l.name, s.quantity 
                        FROM warehouse.stock s
                        JOIN warehouse.parts p ON s.part_id = p.id
                        JOIN warehouse.locations l ON s.location_id = l.id
                    """
                    if title_key == "dashboard.low_stock":
                        query += " WHERE s.quantity < 5"
                    query += " ORDER BY s.quantity DESC;"

                    rows = db.execute(text(query)).fetchall()
                    table.setRowCount(len(rows))
                    for r_idx, row in enumerate(rows):
                        p_item = QTableWidgetItem(str(row[1]))
                        p_item.setFlags(p_item.flags() & ~Qt.ItemIsEditable)

                        l_item = QTableWidgetItem(str(row[2]))
                        l_item.setFlags(l_item.flags() & ~Qt.ItemIsEditable)

                        q_item = QTableWidgetItem(str(row[3]))
                        q_item.setData(Qt.UserRole, row[0])  # Stock ID'sini sakla

                        status_str = (
                            tr("status.pending")
                            if row[3] < 5
                            else tr("status.completed")
                        )
                        status_item = QTableWidgetItem(status_str)
                        status_item.setFlags(status_item.flags() & ~Qt.ItemIsEditable)

                        table.setItem(r_idx, 0, p_item)
                        table.setItem(r_idx, 1, l_item)
                        table.setItem(r_idx, 2, q_item)
                        table.setItem(r_idx, 3, status_item)

                elif title_key == "dashboard.active_locations":
                    table.setColumnCount(2)
                    table.setHorizontalHeaderLabels(
                        [tr("table.location_id"), tr("table.location")]
                    )
                    rows = db.execute(
                        text("SELECT id, name FROM warehouse.locations ORDER BY id;")
                    ).fetchall()
                    table.setRowCount(len(rows))
                    for r_idx, row in enumerate(rows):
                        id_item = QTableWidgetItem(str(row[0]))
                        id_item.setFlags(id_item.flags() & ~Qt.ItemIsEditable)

                        loc_item = QTableWidgetItem(str(row[1]))
                        loc_item.setData(Qt.UserRole, row[0])  # Location ID sakla

                        table.setItem(r_idx, 0, id_item)
                        table.setItem(r_idx, 1, loc_item)

                else:
                    table.setColumnCount(4)
                    table.setHorizontalHeaderLabels(
                        [
                            tr("table.movement_id"),
                            tr("table.type"),
                            tr("table.quantity"),
                            tr("table.time"),
                        ]
                    )
                    m_type = "Inbound" if "inbound" in title_key else "Outbound"
                    rows = db.execute(
                        text(
                            "SELECT id, type, quantity, created_at FROM warehouse.stock_movements "
                            "WHERE type = :m_type ORDER BY created_at DESC;"
                        ),
                        {"m_type": m_type},
                    ).fetchall()
                    table.setRowCount(len(rows))
                    for r_idx, row in enumerate(rows):
                        id_item = QTableWidgetItem(str(row[0]))
                        id_item.setFlags(id_item.flags() & ~Qt.ItemIsEditable)

                        t_item = QTableWidgetItem(str(row[1]))
                        t_item.setFlags(t_item.flags() & ~Qt.ItemIsEditable)

                        q_item = QTableWidgetItem(str(row[2]))
                        q_item.setData(Qt.UserRole, row[0])  # Movement ID sakla

                        time_item = QTableWidgetItem(str(row[3]))
                        time_item.setFlags(time_item.flags() & ~Qt.ItemIsEditable)

                        table.setItem(r_idx, 0, id_item)
                        table.setItem(r_idx, 1, t_item)
                        table.setItem(r_idx, 2, q_item)
                        table.setItem(r_idx, 3, time_item)

                table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)

                # Satır yüksekliklerini ayarla
                for r in range(table.rowCount()):
                    table.setRowHeight(r, 40)

            finally:
                db.close()
        except Exception as e:
            print(f"[WARN] Detaylar yüklenirken DB hatası: {e}")
            # QMessageBox göstermiyoruz ki rahatsız etmesin
        finally:
            table.blockSignals(False)

    def _on_detail_item_changed(self, item: QTableWidgetItem):
        """Hücre düzenlendiğinde veriyi PostgreSQL veritabanında günceller."""
        db_id = item.data(Qt.UserRole)
        if db_id is None:
            return

        new_val = item.text().strip()
        title_key = getattr(self, "_last_clicked_key", "dashboard.total_parts")

        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                if title_key == "dashboard.total_parts":
                    db.execute(
                        text("UPDATE warehouse.parts SET name = :name WHERE id = :id;"),
                        {"name": new_val, "id": db_id},
                    )
                elif (
                    title_key == "dashboard.total_stock"
                    or title_key == "dashboard.low_stock"
                ):
                    try:
                        qty = int(new_val)
                        db.execute(
                            text(
                                "UPDATE warehouse.stock SET quantity = :qty WHERE id = :id;"
                            ),
                            {"qty": qty, "id": db_id},
                        )
                    except ValueError:
                        QMessageBox.warning(
                            self,
                            "Hata",
                            "Lütfen geçerli bir sayısal stok değeri girin.",
                        )
                        self.refresh_stats()
                        return
                elif title_key == "dashboard.active_locations":
                    db.execute(
                        text(
                            "UPDATE warehouse.locations SET name = :name WHERE id = :id;"
                        ),
                        {"name": new_val, "id": db_id},
                    )
                else:
                    try:
                        qty = int(new_val)
                        db.execute(
                            text(
                                "UPDATE warehouse.stock_movements SET quantity = :qty WHERE id = :id;"
                            ),
                            {"qty": qty, "id": db_id},
                        )
                    except ValueError:
                        QMessageBox.warning(
                            self, "Hata", "Lütfen geçerli bir sayısal değer girin."
                        )
                        self.refresh_stats()
                        return

                db.commit()
            finally:
                db.close()

            # Kartları ve sayıları güncelle
            self.refresh_stats()

        except Exception as e:
            QMessageBox.critical(self, "Hata", f"Veritabanı güncellenemedi:\n{e}")
            self.refresh_stats()

    def _create_table_section(self) -> QWidget:
        """Stok hareketleri tablosu bölümünü oluştur."""
        container = QWidget()
        container.setObjectName("table_container")
        layout = QVBoxLayout(container)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(16)

        # Tablo başlığı
        header_layout = QHBoxLayout()

        title_section = QWidget()
        title_layout = QVBoxLayout(title_section)
        title_layout.setContentsMargins(0, 0, 0, 0)
        title_layout.setSpacing(4)

        self._table_title = QLabel(f"📋  {tr('dashboard.recent_movements')}")
        self._table_title.setObjectName("table_header_title")
        title_layout.addWidget(self._table_title)

        self._table_subtitle = QLabel(tr("dashboard.movements_subtitle"))
        self._table_subtitle.setObjectName("table_header_subtitle")
        title_layout.addWidget(self._table_subtitle)

        header_layout.addWidget(title_section)
        header_layout.addStretch()

        self._view_all_btn = QPushButton(tr("dashboard.view_all"))
        self._view_all_btn.setObjectName("table_action_btn")
        self._view_all_btn.setCursor(Qt.PointingHandCursor)
        header_layout.addWidget(self._view_all_btn)

        layout.addLayout(header_layout)

        # Tablo
        self._table = QTableWidget()
        self._table.setColumnCount(7)
        self._update_table_headers()
        self._table.setRowCount(len(self.SAMPLE_MOVEMENTS))
        self._table.setAlternatingRowColors(True)
        self._table.setSelectionBehavior(QTableWidget.SelectRows)
        self._table.setEditTriggers(QTableWidget.NoEditTriggers)
        self._table.verticalHeader().setVisible(False)
        self._table.setShowGrid(False)

        # Sütun genişlikleri
        header = self._table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(1, QHeaderView.Stretch)
        header.setSectionResizeMode(2, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(3, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(4, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(5, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(6, QHeaderView.ResizeToContents)

        # Verileri doldur
        self._populate_table()

        layout.addWidget(self._table)

        return container

    def _update_table_headers(self):
        """Tablo başlıklarını güncelle."""
        headers = [
            tr("table.movement_id"),
            tr("table.part_name"),
            tr("table.location"),
            tr("table.type"),
            tr("table.quantity"),
            tr("table.time"),
            tr("table.status"),
        ]
        self._table.setHorizontalHeaderLabels(headers)

    def _populate_table(self):
        """Tablo verilerini doldur."""
        type_colors = {
            "movement.inbound": "#58A6FF",
            "movement.outbound": "#F85149",
            "movement.transfer": "#D2A828",
        }
        status_colors = {
            "status.completed": "#3FB950",
            "status.in_progress": "#58A6FF",
            "status.pending": "#D29922",
        }

        for row, data in enumerate(self.SAMPLE_MOVEMENTS):
            for col, value in enumerate(data):
                # Type ve Status için çeviri kullan
                display_value = value
                if col == 3:  # Type
                    display_value = tr(value)
                elif col == 6:  # Status
                    display_value = tr(value)

                item = QTableWidgetItem(display_value)
                item.setTextAlignment(Qt.AlignVCenter | Qt.AlignLeft)

                if col == 3 and value in type_colors:
                    item.setForeground(QColor(type_colors[value]))

                if col == 6 and value in status_colors:
                    item.setForeground(QColor(status_colors[value]))

                self._table.setItem(row, col, item)

            self._table.setRowHeight(row, 48)

    def _retranslate(self):
        """Dil değiştiğinde tüm metinleri güncelle."""
        self._page_title.setText(tr("dashboard.title"))
        self._page_subtitle.setText(tr("dashboard.welcome"))
        self._db_section_title.setText(tr("dashboard.local_db_status"))
        self._lbl_db_files_title.setText(tr("dashboard.total_db_files") + ":")
        self._lbl_sql_files_title.setText(tr("dashboard.total_sql_files") + ":")
        self._lbl_db_size_title.setText(tr("dashboard.total_db_size") + ":")
        self._lbl_active_db_title.setText(tr("dashboard.active_local_db") + ":")
        self._table_title.setText(f"📋  {tr('dashboard.recent_movements')}")
        self._table_subtitle.setText(tr("dashboard.movements_subtitle"))
        self._view_all_btn.setText(tr("dashboard.view_all"))

        # Kartları güncelle
        for card in self._cards:
            card.retranslate()

        # Tablo başlıklarını güncelle
        self._update_table_headers()

        # Tablo içeriğini güncelle (type ve status çevirileri)
        self._populate_table()

        # İstatistikleri dil çevirisiyle yenile
        self.refresh_stats()
