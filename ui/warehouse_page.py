"""
RemaLab WMS - Warehouse Page
Depodaki parça stok durumu ve lokasyonlar arası stok transfer işlemleri.
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
    QProgressBar,
    QTabWidget,
    QLineEdit,
    QFileDialog,
)
from PySide6.QtCore import Qt
from ui.translations import tr, get_translator
from services.stock_service import StockService
from services.exceptions import InsufficientStockError, ServiceError


class StockTransferDialog(QDialog):
    """Stok transfer diyaloğu."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle(tr("warehouse.transfer_stock"))
        self.setMinimumWidth(400)
        self

        layout = QVBoxLayout(self)

        # 1. Kaynak Lokasyon & Parça seçimi
        lbl1 = QLabel(tr("warehouse.source_location") + " (Stok Satırı)")
        lbl1
        layout.addWidget(lbl1)

        self.source_combo = QComboBox()
        self.source_combo
        layout.addWidget(self.source_combo)

        # 2. Hedef Lokasyon
        lbl2 = QLabel(tr("warehouse.target_location"))
        lbl2
        layout.addWidget(lbl2)

        self.target_combo = QComboBox()
        self.target_combo
        layout.addWidget(self.target_combo)

        # 3. Miktar
        lbl3 = QLabel(tr("warehouse.transfer_quantity"))
        lbl3
        layout.addWidget(lbl3)

        self.qty_spin = QSpinBox()
        self.qty_spin.setRange(1, 99999)
        self.qty_spin
        layout.addWidget(self.qty_spin)

        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel, self)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)

        buttons.button(QDialogButtonBox.Ok).setText(tr("warehouse.transfer_stock"))
        buttons.button(QDialogButtonBox.Ok)
        buttons.button(QDialogButtonBox.Cancel).setText(tr("db.cancel"))
        buttons.button(QDialogButtonBox.Cancel)

        layout.addWidget(buttons)

        self._load_combos()

    def _load_combos(self):
        """Komboboxları doldurur."""
        try:
            from config.database import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                # 1. Kaynak Stoklar
                stoklar = db.execute(text("""
                    SELECT s.id, p.name, l.name, s.quantity
                    FROM warehouse.stock s
                    JOIN warehouse.parts p ON s.part_id = p.id
                    JOIN warehouse.locations l ON s.location_id = l.id
                    WHERE s.quantity > 0;
                """)).fetchall()

                for row in stoklar:
                    # id'yi verisi olarak sakla
                    self.source_combo.addItem(
                        f"{row[1]} ({row[2]}) - Mevcut: {row[3]} adet", row[0]
                    )

                # 2. Lokasyonlar
                lokasyonlar = db.execute(
                    text("SELECT id, name FROM warehouse.locations;")
                ).fetchall()
                for row in lokasyonlar:
                    self.target_combo.addItem(row[1], row[0])
            finally:
                db.close()
        except Exception as e:
            print(f"[Error Loading Combo Boxes] {e}")


class ImportPreviewDialog(QDialog):
    def __init__(self, df, parent=None):
        super().__init__(parent)
        self.setWindowTitle("İçe Aktarılacak Verileri Seçin")
        self.setMinimumSize(600, 400)
        
        self.selected_rows = []
        self.df = df
        
        layout = QVBoxLayout(self)
        
        self.table = QTableWidget()
        self.table.setColumnCount(len(df.columns) + 1)
        self.table.setHorizontalHeaderLabels(["Seç"] + list(df.columns))
        self.table.setRowCount(len(df))
        
        import pandas as pd
        for i, row in df.iterrows():
            chk = QTableWidgetItem()
            chk.setFlags(Qt.ItemIsUserCheckable | Qt.ItemIsEnabled)
            chk.setCheckState(Qt.Checked)
            self.table.setItem(i, 0, chk)
            
            for j, col_name in enumerate(df.columns):
                val = str(row[col_name]) if not pd.isna(row[col_name]) else ""
                item = QTableWidgetItem(val)
                item.setFlags(item.flags() & ~Qt.ItemIsEditable)
                self.table.setItem(i, j+1, item)
                
        layout.addWidget(self.table)
        
        btn_layout = QHBoxLayout()
        select_all_btn = QPushButton("Tümünü Seç")
        select_all_btn.clicked.connect(self._select_all)
        select_none_btn = QPushButton("Hiçbirini Seçme")
        select_none_btn.clicked.connect(self._select_none)
        btn_layout.addWidget(select_all_btn)
        btn_layout.addWidget(select_none_btn)
        btn_layout.addStretch()
        layout.addLayout(btn_layout)
        
        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        buttons.accepted.connect(self._on_accept)
        buttons.rejected.connect(self.reject)
        buttons.button(QDialogButtonBox.Ok).setText("İçe Aktar")
        buttons.button(QDialogButtonBox.Cancel).setText("İptal")
        layout.addWidget(buttons)
        
    def _select_all(self):
        for i in range(self.table.rowCount()):
            self.table.item(i, 0).setCheckState(Qt.Checked)
            
    def _select_none(self):
        for i in range(self.table.rowCount()):
            self.table.item(i, 0).setCheckState(Qt.Unchecked)
            
    def _on_accept(self):
        for i in range(self.table.rowCount()):
            if self.table.item(i, 0).checkState() == Qt.Checked:
                self.selected_rows.append(i)
        self.accept()


class WarehousePage(QWidget):
    """Depo modülü."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.service = StockService()
        self._setup_ui()
        get_translator().language_changed.connect(self._retranslate)

    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(28, 28, 28, 28)
        layout.setSpacing(16)

        # Üst Başlık
        header_layout = QHBoxLayout()
        title_section = QWidget()
        title_layout = QVBoxLayout(title_section)
        title_layout.setContentsMargins(0, 0, 0, 0)
        title_layout.setSpacing(4)

        self._title_lbl = QLabel(tr("warehouse.title"))
        self._title_lbl
        title_layout.addWidget(self._title_lbl)

        self._subtitle_lbl = QLabel(tr("warehouse.subtitle"))
        self._subtitle_lbl
        title_layout.addWidget(self._subtitle_lbl)

        header_layout.addWidget(title_section)
        header_layout.addStretch()

        # İşlem Seçici (ComboBox) ve Buton
        action_layout = QVBoxLayout()
        action_layout.setSpacing(6)

        self._action_combo = QComboBox()
        self._action_combo.addItems([
            "Stok Transferi",
            "Boş Şablon İndir",
            "Excel Dışa Aktar",
            "Excel İçe Aktar"
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
        self._action_combo.currentIndexChanged.connect(self._on_action_changed)
        action_layout.addWidget(self._action_combo)

        self._action_btn = QPushButton("Transfer Başlat")
        self._action_btn.setObjectName("btn_warning")
        self._action_btn.setCursor(Qt.PointingHandCursor)
        self._action_btn.clicked.connect(self._execute_action)
        action_layout.addWidget(self._action_btn)

        header_layout.addLayout(action_layout)

        layout.addLayout(header_layout)

        # Depo Doluluk Oranı Barı (Progress Bar)
        occupancy_section = QHBoxLayout()
        self._occ_lbl = QLabel("Depo Genel Doluluk Oranı:")
        occupancy_section.addWidget(self._occ_lbl)

        self._progress = QProgressBar()
        self._progress.setRange(0, 100)
        self._progress.setValue(0)
        self._progress.setTextVisible(True)
        occupancy_section.addWidget(self._progress)
        
        self._critical_lbl = QLabel("")
        self._critical_lbl.setStyleSheet("color: #F85149; font-weight: bold; padding-left: 10px;")
        occupancy_section.addWidget(self._critical_lbl)
        
        occupancy_section.addStretch()
        layout.addLayout(occupancy_section)

        # Arama Çubuğu
        search_layout = QHBoxLayout()
        search_layout.setContentsMargins(0, 0, 0, 0)
        self._search_input = QLineEdit()
        self._search_input.setPlaceholderText("Ara (ID, Parça Adı, Lokasyon)...")
        self._search_input.textChanged.connect(self._load_stock)
        search_layout.addWidget(self._search_input)
        layout.addLayout(search_layout)

        # Depo Stok Tablosu
        self._table = QTableWidget()
        self._table.setColumnCount(4)
        self._table.setAlternatingRowColors(True)
        self._table.verticalHeader().setVisible(False)
        self._table.setSelectionBehavior(QTableWidget.SelectRows)
        self._table.setEditTriggers(QTableWidget.NoEditTriggers)
        self._table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self._table.itemSelectionChanged.connect(self._calculate_occupancy)
        layout.addWidget(self._table)

        self._load_stock()

    def _on_action_changed(self, index: int):
        text = self._action_combo.currentText()
        if text == "Stok Transferi":
            self._action_btn.setText("Transfer Başlat")
            self._action_btn.setObjectName("btn_warning")
        elif text == "Boş Şablon İndir":
            self._action_btn.setText("Şablonu İndir")
            self._action_btn.setObjectName("btn_info")
        elif text == "Excel Dışa Aktar":
            self._action_btn.setText("Dışa Aktar")
            self._action_btn.setObjectName("btn_success")
        elif text == "Excel İçe Aktar":
            self._action_btn.setText("İçe Aktar")
            self._action_btn.setObjectName("btn_primary")
        self._action_btn.style().unpolish(self._action_btn)
        self._action_btn.style().polish(self._action_btn)

    def _execute_action(self):
        text = self._action_combo.currentText()
        if text == "Stok Transferi":
            self._transfer_stock()
        elif text == "Boş Şablon İndir":
            self._download_template()
        elif text == "Excel Dışa Aktar":
            self._export_excel()
        elif text == "Excel İçe Aktar":
            self._import_excel()

    def _download_template(self):
        try:
            import pandas as pd
        except ImportError:
            QMessageBox.critical(self, "Hata", "pandas kütüphanesi eksik!")
            return
            
        filepath, _ = QFileDialog.getSaveFileName(self, "Boş Şablon İndir", "sablon.xlsx", "Excel Files (*.xlsx)")
        if not filepath:
            return
            
        df = pd.DataFrame(columns=["Parça Adı", "Parça ID", "Barkod", "Stok Durumu"])
        try:
            from ui.excel_utils import style_excel_file
            df.to_excel(filepath, index=False)
            style_excel_file(filepath)
            QMessageBox.information(self, "Başarılı", "Boş şablon başarıyla kaydedildi.")
        except Exception as e:
            QMessageBox.critical(self, "Hata", f"Şablon kaydedilirken hata oluştu:\n{e}")

    def _export_excel(self):
        try:
            import pandas as pd
        except ImportError:
            QMessageBox.critical(self, "Hata", "pandas kütüphanesi eksik!")
            return

        selected_items = self._table.selectedItems()
        selected_rows = list(set([item.row() for item in selected_items]))

        if not selected_rows:
            reply = QMessageBox.question(self, "Toplu İndirme", "Hiçbir satır seçmediniz. Tüm depoyu dışa aktarmak ister misiniz?", QMessageBox.Yes | QMessageBox.No)
            if reply == QMessageBox.No:
                return
            rows_to_export = range(self._table.rowCount())
        else:
            rows_to_export = selected_rows

        if not rows_to_export:
            QMessageBox.warning(self, "Uyarı", "Tabloda dışa aktarılacak veri yok.")
            return

        filepath, _ = QFileDialog.getSaveFileName(self, "Excel Dışa Aktar", "depo_stok.xlsx", "Excel Files (*.xlsx)")
        if not filepath:
            return
            
        data = []
        for r in rows_to_export:
            part_name = self._table.item(r, 0).text()
            loc = self._table.item(r, 1).text()
            qty = self._table.item(r, 2).text()
            status = self._table.item(r, 3).text()
            data.append({
                "Parça Adı": part_name,
                "Lokasyon": loc,
                "Stok Miktarı": qty,
                "Durum": status
            })
            
        try:
            from ui.excel_utils import style_excel_file
            df = pd.DataFrame(data)
            df.to_excel(filepath, index=False)
            style_excel_file(filepath)
            QMessageBox.information(self, "Başarılı", f"{len(data)} adet kayıt Excel'e aktarıldı.")
        except Exception as e:
            QMessageBox.critical(self, "Hata", f"Excel kaydedilirken hata oluştu:\n{e}")

    def _import_excel(self):
        from ui.excel_utils import import_excel_flow
        
        # Beklenen veritabanı / sistem sütunları
        db_columns = ["Parça Adı", "Parça ID", "Barkod", "Stok Durumu"]
        
        def handle_import(mapped_df):
            import pandas as pd
            from config.database import SessionLocal
            from sqlalchemy import text
            
            db = SessionLocal()
            missing_parts = []
            try:
                for index, row in mapped_df.iterrows():
                    part_name = str(row.get("Parça Adı", "")).strip()
                    if not part_name or pd.isna(row.get("Parça Adı")) or part_name.lower() == "nan":
                        continue
                        
                    result = db.execute(
                        text("SELECT id FROM warehouse.parts WHERE name = :name"),
                        {"name": part_name}
                    ).fetchone()
                    
                    if not result and part_name not in missing_parts:
                        missing_parts.append(part_name)
            finally:
                db.close()
                
            if missing_parts:
                missing_str = "\n".join(missing_parts[:5])
                if len(missing_parts) > 5:
                    missing_str += f"\n...ve {len(missing_parts)-5} parça daha."
                QMessageBox.critical(
                    self, 
                    "Hata: Tanımsız Parça", 
                    f"Excel dosyasındaki aşağıdaki parçalar sistemde kayıtlı değil. Lütfen önce bu parçaları 'Parçalar' sekmesinden sisteme ekleyin:\n\n{missing_str}"
                )
                return
            
            imported_count = len(mapped_df)
            QMessageBox.information(self, "Başarılı", f"{imported_count} adet kayıt doğrulandı ve başarıyla okundu (Veritabanına ekleme simülasyonu).")
            self._load_stock()

        import_excel_flow(self, db_columns, handle_import)

    def _update_headers(self):
        self._table.setHorizontalHeaderLabels(
            [
                tr("table.part_name"),
                tr("table.location"),
                tr("table.stock_quantity"),
                tr("table.status"),
            ]
        )

    def showEvent(self, event):
        """Depo sayfası her görüntülendiğinde tetiklenir."""
        super().showEvent(event)
        self._load_stock()

    def _load_stock(self):
        """Depo stok durumunu listeler ve doluluk oranını günceller."""
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
                    SELECT s.id, p.name, l.name, s.quantity, p.id, p.critical_limit
                    FROM warehouse.stock s
                    JOIN warehouse.parts p ON s.part_id = p.id
                    JOIN warehouse.locations l ON s.location_id = l.id
                """
                params = {}

                if search_q:
                    sql += " WHERE p.name ILIKE :q OR l.name ILIKE :q OR CAST(s.id AS VARCHAR) ILIKE :q"
                    params["q"] = f"%{search_q}%"

                sql += " ORDER BY s.id DESC;"

                rows = db.execute(text(sql), params).fetchall()

                self._table.setRowCount(len(rows))

                self._current_rows = rows

                for r_idx, row in enumerate(rows):
                    p_item = QTableWidgetItem(str(row[1]))
                    p_item.setFlags(p_item.flags() & ~Qt.ItemIsEditable)
                    p_item.setData(Qt.UserRole, row[4])  # part_id sakla

                    l_item = QTableWidgetItem(str(row[2]))
                    l_item.setFlags(l_item.flags() & ~Qt.ItemIsEditable)

                    q_item = QTableWidgetItem(str(row[3]))
                    q_item.setData(Qt.UserRole, row[0])  # Stock ID sakla

                    c_limit = row[5] if row[5] is not None else 10
                    is_critical = row[3] <= c_limit
                    
                    status_str = "⚠️ Kritik Stok" if is_critical else "✅ Yeterli"
                    status_item = QTableWidgetItem(status_str)
                    status_item.setFlags(status_item.flags() & ~Qt.ItemIsEditable)
                    
                    from PySide6.QtGui import QColor
                    if is_critical:
                        status_item.setForeground(QColor("#F85149"))
                    else:
                        status_item.setForeground(QColor("#238636"))

                    self._table.setItem(r_idx, 0, p_item)
                    self._table.setItem(r_idx, 1, l_item)
                    self._table.setItem(r_idx, 2, q_item)
                    self._table.setItem(r_idx, 3, status_item)
                    self._table.setRowHeight(r_idx, 44)

                self._calculate_occupancy()
            finally:
                db.close()
        except Exception as e:
            print(f"[Error Loading Stock] {e}")
        finally:
            self._table.blockSignals(False)

    def _calculate_occupancy(self):
        selected_part_id = None
        selected_part_name = None
        
        selected_items = self._table.selectedItems()
        if selected_items:
            row = selected_items[0].row()
            p_item = self._table.item(row, 0)
            if p_item:
                selected_part_name = p_item.text()
                selected_part_id = p_item.data(Qt.UserRole)
                
        total_qty = 0
        part_critical_limit = 10
        
        if hasattr(self, '_current_rows'):
            for row in self._current_rows:
                part_id = row[4]
                qty = row[3]
                limit = row[5] if row[5] is not None else 10
                
                if selected_part_id is None or part_id == selected_part_id:
                    total_qty += qty
                    if part_id == selected_part_id:
                        part_critical_limit = limit
                    
        if selected_part_id is None:
            self._occ_lbl.setText("Depo Genel Doluluk Oranı:")
            max_capacity = 1000
            self._progress.setRange(0, 100)
            percentage = min(int((total_qty / max_capacity) * 100), 100)
            self._progress.setValue(percentage)
            self._progress.setFormat("%p%")
            self._critical_lbl.setText("")
            self._progress.setStyleSheet("")
        else:
            self._occ_lbl.setText(f"Seçili Parça ({selected_part_name}) Doluluk:")
            max_capacity = max(50, part_critical_limit * 2)
            self._progress.setRange(0, max_capacity)
            self._progress.setValue(min(total_qty, max_capacity))
            self._progress.setFormat(f"{total_qty} / {max_capacity}")
            
            if total_qty <= part_critical_limit:
                self._critical_lbl.setText("⚠️ Kritik Stok")
                self._progress.setStyleSheet("""
                    QProgressBar { border: 1px solid #30363D; border-radius: 5px; text-align: center; color: white; background-color: #161B22; }
                    QProgressBar::chunk { background-color: #F85149; border-radius: 4px; }
                """)
            else:
                self._critical_lbl.setText("")
                self._progress.setStyleSheet("""
                    QProgressBar { border: 1px solid #30363D; border-radius: 5px; text-align: center; color: white; background-color: #161B22; }
                    QProgressBar::chunk { background-color: #238636; border-radius: 4px; }
                """)

    def _transfer_stock(self):
        """Stok transfer operasyonu."""
        dialog = StockTransferDialog(self)
        if dialog.exec() == QDialog.Accepted:
            source_stock_id = dialog.source_combo.currentData()
            target_location_id = dialog.target_combo.currentData()
            transfer_qty = dialog.qty_spin.value()

            if source_stock_id is None or target_location_id is None:
                return

            try:
                self.service.transfer(source_stock_id, target_location_id, transfer_qty)
                QMessageBox.information(
                    self, "Başarılı", tr("warehouse.transfer_success")
                )
                self._load_stock()
            except InsufficientStockError:
                QMessageBox.warning(self, "Hata", tr("warehouse.insufficient_stock"))
            except ServiceError as e:
                QMessageBox.critical(self, "Hata", f"Stok transfer edilemedi: {e}")

    def _on_item_changed(self, item: QTableWidgetItem):
        """Satır içi stok miktarı güncelleme."""
        stock_id = item.data(Qt.UserRole)
        if stock_id is None:
            return

        try:
            new_qty = int(item.text().strip())
        except ValueError:
            self._load_stock()
            return

        try:
            self.service.set_quantity(stock_id, new_qty)
            self._load_stock()
        except ServiceError as e:
            QMessageBox.critical(self, "Hata", f"Güncelleme başarısız: {e}")
            self._load_stock()

    def _retranslate(self):
        """Dil yeniler."""
        self._title_lbl.setText(tr("warehouse.title"))
        self._subtitle_lbl.setText(tr("warehouse.subtitle"))
        self._on_action_changed(self._action_combo.currentIndex())
        self._load_stock()
