import os
from PySide6.QtCore import QObject, Signal, QFile, QTextStream
from PySide6.QtWidgets import QApplication

class ThemeManager(QObject):
    theme_changed = Signal(bool)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.is_dark = True

    def toggle_theme(self):
        self.is_dark = not self.is_dark
        self.apply_theme()
        self.theme_changed.emit(self.is_dark)

    def apply_theme(self):
        app = QApplication.instance()
        if not app:
            return
            
        theme_file = "styles_dark.qss" if self.is_dark else "styles_light.qss"
        style_path = os.path.join(os.path.dirname(__file__), theme_file)
        
        file = QFile(style_path)
        if file.open(QFile.ReadOnly | QFile.Text):
            stream = QTextStream(file)
            stylesheet = stream.readAll()
            file.close()
            app.setStyleSheet(stylesheet)
        else:
            print(f"[WARN] Style file not found: {style_path}")

_theme_manager_instance = None

def get_theme_manager() -> ThemeManager:
    global _theme_manager_instance
    if _theme_manager_instance is None:
        _theme_manager_instance = ThemeManager()
    return _theme_manager_instance
