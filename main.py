"""
RemaLab - Warehouse Management System
Ana giriş noktası
"""

import sys
import os
from PySide6.QtWidgets import QApplication
from PySide6.QtCore import Qt, QFile, QTextStream
from PySide6.QtGui import QFont

from ui.main_window import MainWindow


def load_stylesheet(app: QApplication):
    """QSS stil dosyasını yükle."""
    style_path = os.path.join(os.path.dirname(__file__), "ui", "styles.qss")
    file = QFile(style_path)
    if file.open(QFile.ReadOnly | QFile.Text):
        stream = QTextStream(file)
        app.setStyleSheet(stream.readAll())
        file.close()
    else:
        print(f"[WARN] Style file not found: {style_path}")


def main():
    """Uygulamayı başlat."""
    # High DPI desteği
    QApplication.setHighDpiScaleFactorRoundingPolicy(
        Qt.HighDpiScaleFactorRoundingPolicy.PassThrough
    )

    # Veritabanını hazırla (Schema ve Tablolar)
    try:
        from config.database import engine
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("CREATE SCHEMA IF NOT EXISTS warehouse;"))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS warehouse.parts (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    barcode VARCHAR(100) UNIQUE
                );
            """))
            # Halihazırda tablo varsa kolon eklemesi için ALTER kontrolü
            try:
                conn.execute(text("ALTER TABLE warehouse.parts ADD COLUMN IF NOT EXISTS barcode VARCHAR(100) UNIQUE;"))
            except Exception:
                pass
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS warehouse.locations (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL
                );
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS warehouse.stock (
                    id SERIAL PRIMARY KEY,
                    part_id INT REFERENCES warehouse.parts(id) ON DELETE CASCADE,
                    location_id INT REFERENCES warehouse.locations(id) ON DELETE CASCADE,
                    quantity INT NOT NULL DEFAULT 0
                );
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS warehouse.stock_movements (
                    id SERIAL PRIMARY KEY,
                    type VARCHAR(50) NOT NULL,
                    quantity INT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS warehouse.inbound_entries (
                    id SERIAL PRIMARY KEY,
                    part_id INT REFERENCES warehouse.parts(id) ON DELETE CASCADE,
                    quantity INT NOT NULL,
                    unit_price DECIMAL(12,2) NOT NULL,
                    total_cost DECIMAL(12,2) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_by VARCHAR(50) NOT NULL
                );
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS warehouse.outbound_entries (
                    id SERIAL PRIMARY KEY,
                    part_id INT REFERENCES warehouse.parts(id) ON DELETE CASCADE,
                    location_id INT REFERENCES warehouse.locations(id) ON DELETE CASCADE,
                    quantity INT NOT NULL,
                    destination VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_by VARCHAR(50) NOT NULL
                );
            """))
            # Örnek dummy verileri PostgreSQL'e yükle (eğer bomboşsa)
            parts_count = conn.execute(text("SELECT COUNT(*) FROM warehouse.parts;")).scalar()
            if parts_count == 0:
                conn.execute(text("INSERT INTO warehouse.parts (name) VALUES ('iPhone 15 Pro LCD'), ('Samsung S24 Battery'), ('Pixel 8 Back Cover');"))
                conn.execute(text("INSERT INTO warehouse.locations (name) VALUES ('A-12-03'), ('B-05-01'), ('C-08-02');"))
                conn.execute(text("INSERT INTO warehouse.stock (part_id, location_id, quantity) VALUES (1, 1, 100), (2, 2, 4), (3, 3, 20);"))
            conn.commit()
    except Exception as db_err:
        print(f"[WARN] Database tables could not be auto-initialized: {db_err}")

    app = QApplication(sys.argv)

    # Varsayılan font
    font = QFont("Segoe UI", 10)
    app.setFont(font)

    # Stylesheet yükle
    load_stylesheet(app)

    # Ana pencere
    window = MainWindow()
    window.show()
    window.raise_()
    window.activateWindow()

    print("✅ RemaLab WMS started successfully!")
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
