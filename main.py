import sys
import os
from PySide6.QtWidgets import QApplication
from PySide6.QtGui import QIcon, QFont
from PySide6.QtCore import Qt

from config.database import init_database_schema, register_db_error_listener
from core.main_window import MainWindow

def main():
    """Uygulamayı başlat (PySide6 + React WebEngine via QWebChannel)."""
    # Server-only (headless) mod kontrolü
    headless = os.getenv("SERVER_ONLY", "0") == "1" or "--server" in sys.argv

    if not headless:
        # High DPI desteği
        QApplication.setHighDpiScaleFactorRoundingPolicy(
            Qt.HighDpiScaleFactorRoundingPolicy.PassThrough
        )

    from PySide6.QtCore import QLocale
    QLocale.setDefault(QLocale(QLocale.Turkish, QLocale.Turkey))
    
    import os
    os.environ["QTWEBENGINE_CHROMIUM_FLAGS"] = "--lang=tr-TR"

    if headless:
        from PySide6.QtCore import QCoreApplication
        app = QCoreApplication(sys.argv)
    else:
        app = QApplication(sys.argv)

    if sys.platform == "win32":
        import ctypes
        myappid = "remalab.wms.app.1.0"
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(myappid)



    icon_path = os.path.join(
        os.path.dirname(__file__), "assets", "Uygulama-Amblemi.png"
    )
    if os.path.exists(icon_path):
        app.setWindowIcon(QIcon(icon_path))

    # Veritabanı şema kontrolünü arka planda yap ki pencere hemen açılsın
    # (uzak DB'ye bağlanıp tüm tabloları introspect etmek pencerenin
    # görünmesini bloklamamalı).
    import threading

    def _init_db_background():
        try:
            init_database_schema()
            register_db_error_listener()
        except Exception as db_err:
            print(f"[WARN] Database tables could not be auto-initialized: {db_err}")

    threading.Thread(target=_init_db_background, daemon=True).start()

    if headless:
        from core.main_window import HeadlessServer
        server = HeadlessServer()
        app.server = server
        # Uygulama sonlanırken dev sunucuyu durdurmak için
        app.aboutToQuit.connect(server.stop)
        print("RemaLab WMS Headless Server started successfully!")
    else:
        # Ana pencereyi (WebEngine) aç
        window = MainWindow()
        window.show()
        window.raise_()
        window.activateWindow()
        # Bu referansı app içinde tutuyoruz ki Garbage Collector yok etmesin
        app.main_window = window 
        print("RemaLab WMS (React + QWebChannel) started successfully!")

    sys.exit(app.exec())

if __name__ == "__main__":
    main()