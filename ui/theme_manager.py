import os
from PySide6.QtCore import QObject, Signal, QFile, QTextStream, QSettings
from PySide6.QtWidgets import QApplication

class ThemeManager(QObject):
    theme_changed = Signal(bool)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.settings = QSettings("RemaLab", "WMS")
        self.current_username = None
        # Son kullanılan temayı yükle (uygulama ilk açıldığında giriş ekranı için)
        self.is_dark = self.settings.value("theme_last_global", False, type=bool)

    def load_user_theme(self, username: str):
        """Kullanıcı giriş yaptığında o kullanıcıya özel temayı yükler."""
        self.current_username = username
        self.is_dark = self.settings.value(f"theme_{username}", self.is_dark, type=bool)
        self.apply_theme()
        self.theme_changed.emit(self.is_dark)

    def toggle_theme(self):
        self.is_dark = not self.is_dark
        self.apply_theme()
        self.theme_changed.emit(self.is_dark)
        
        # Seçimi global olarak kaydet
        self.settings.setValue("theme_last_global", self.is_dark)
        
        # Giriş yapmış bir kullanıcı varsa, ona özel de kaydet
        if self.current_username:
            self.settings.setValue(f"theme_{self.current_username}", self.is_dark)

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
