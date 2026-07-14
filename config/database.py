"""
RemaLab WMS - Database Configuration
SQLAlchemy engine ve session yönetimi.
"""

import os
from contextlib import contextmanager
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# .env dosyasını yükle
load_dotenv()


DB_HOST = os.getenv("PG_HOST") or os.getenv("DB_HOST")
DB_PORT = os.getenv("PG_PORT") or os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("PG_DATABASE") or os.getenv("DB_NAME", "remalab")
DB_USER = os.getenv("PG_USER") or os.getenv("DB_USER")
DB_PASSWORD = os.getenv("PG_PASSWORD") or os.getenv("DB_PASSWORD")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Engine & Session
engine = create_engine(
    DATABASE_URL, 
    pool_pre_ping=True, 
    connect_args={
        "connect_timeout": 10,
        "options": "-c statement_timeout=10000",
        "keepalives": 1,
        "keepalives_idle": 3,
        "keepalives_interval": 1,
        "keepalives_count": 3
    }
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def init_database_schema():
    """Veritabanı tablolarını oluşturur."""
    from models.user import User # Modellerin kaydolması için import
    from models.item_bom import ItemBOM
    from models.product import Product
    # Diğer modeller de buraya eklenebilir
    Base.metadata.create_all(bind=engine)

def reconnect_engine():
    """Rebuilds the engine and sessionmaker using current os.environ credentials."""
    global engine, SessionLocal, DATABASE_URL
    from dotenv import load_dotenv
    load_dotenv(override=True)
    
    DB_HOST = os.getenv("PG_HOST") or os.getenv("DB_HOST")
    DB_PORT = os.getenv("PG_PORT") or os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("PG_DATABASE") or os.getenv("DB_NAME", "remalab")
    DB_USER = os.getenv("PG_USER") or os.getenv("DB_USER")
    DB_PASSWORD = os.getenv("PG_PASSWORD") or os.getenv("DB_PASSWORD")
    
    DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    
    engine.dispose() # Dispose old connections
    
    engine = create_engine(
        DATABASE_URL, 
        pool_pre_ping=True, 
        connect_args={
            "connect_timeout": 10,
            "options": "-c statement_timeout=10000",
            "keepalives": 1,
            "keepalives_idle": 3,
            "keepalives_interval": 1,
            "keepalives_count": 3
        }
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)



@contextmanager
def get_db():
    """Yeni bir veritabanı oturumu oluşturur ve iş bittiğinde kapatır."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Global hata yakalama (Local try-except blokları yutsa bile yakalar)
from sqlalchemy import event
import sqlalchemy.exc
import psycopg2

from sqlalchemy.engine import Engine

def receive_handle_error(exception_context):
    e = exception_context.original_exception
    is_db_error = False
    err_str = str(e).lower()
    
    if isinstance(e, sqlalchemy.exc.OperationalError):
        is_db_error = True
    elif "psycopg2.operationalerror" in err_str or ("connection" in err_str and "failed" in err_str):
        is_db_error = True
        
    if is_db_error:
        from PySide6.QtWidgets import QApplication
        if QApplication.instance():
            from ui.db_error_dialog import DatabaseErrorDialog
            from PySide6.QtWidgets import QDialog
            
            print(f"[WARN] Intercepted Database Error: {e}")
            dialog = DatabaseErrorDialog(str(e))
            result = dialog.exec()
            
            if result == QDialog.Accepted:
                reconnect_engine()
                # Kullanıcının işlemi tekrar yapması gerekecek (UI tarafında) ama en azından ayarlar güncellendi.
            else:
                import sys
                sys.exit(1)


def register_db_error_listener():
    """Veritabanı çalışma zamanı bağlantı hatalarını yakalamak için dinleyiciyi kaydeder."""
    event.listen(Engine, "handle_error", receive_handle_error)


