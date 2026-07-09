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
    DATABASE_URL, pool_pre_ping=True, connect_args={"connect_timeout": 5}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


@contextmanager
def get_db():
    """Yeni bir veritabanı oturumu oluşturur ve iş bittiğinde kapatır."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
