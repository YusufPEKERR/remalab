"""
RemaLab WMS - Waybill Page
Giriş ve Çıkış işlemlerinin tek sayfa altında birleştirilmiş hali.
"""

from PySide6.QtWidgets import QWidget, QVBoxLayout, QTabWidget
from ui.translations import tr, get_translator
from ui.inbound_page import InboundPage
from ui.outbound_page import OutboundPage


class WaybillPage(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self._setup_ui()
        get_translator().language_changed.connect(self._retranslate)

    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        
        self.tabs = QTabWidget()
        self.tabs.setStyleSheet("""
            QTabWidget::pane { border: none; }
            QTabBar::tab { background: #0D1117; color: #8B949E; padding: 12px 24px; border: none; font-size: 14px; font-weight: bold; }
            QTabBar::tab:selected { background: #161B22; color: #F0F6FC; border-bottom: 2px solid #1F6FEB; }
        """)
        
        self.inbound_page = InboundPage()
        self.outbound_page = OutboundPage()
        
        self.tabs.addTab(self.inbound_page, tr("nav.inbound"))
        self.tabs.addTab(self.outbound_page, tr("nav.outbound"))
        
        layout.addWidget(self.tabs)

    def _retranslate(self):
        self.tabs.setTabText(0, tr("nav.inbound"))
        self.tabs.setTabText(1, tr("nav.outbound"))

    def refresh(self):
        """Top bar'dan yenile tıklandığında aktif olan sekmeyi yeniler."""
        current_widget = self.tabs.currentWidget()
        if hasattr(current_widget, "_load_data"):
            current_widget._load_data()
        elif hasattr(current_widget, "load_data"):
            current_widget.load_data()
        elif hasattr(current_widget, "refresh"):
            current_widget.refresh()
