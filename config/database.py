"""
RemaLab WMS - Database Configuration
SQLAlchemy engine ve session yönetimi.
Lazy initialization: Engine, ilk kullanılana kadar oluşturulmaz.
"""

import os
from contextlib import contextmanager
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# .env dosyasını yükle
load_dotenv()

Base = declarative_base()

# --- Lazy engine & session ---------------------------------------------------
_engine = None
_SessionLocal = None


def _get_connect_args():
    """Ortak bağlantı parametrelerini döndürür."""
    return {
        "connect_timeout": 5,
        "options": "-c statement_timeout=10000",
        "keepalives": 1,
        "keepalives_idle": 3,
        "keepalives_interval": 1,
        "keepalives_count": 3,
    }


def _build_database_url():
    """Mevcut ortam değişkenlerinden DATABASE_URL oluşturur."""
    db_host = os.getenv("PG_HOST") or os.getenv("DB_HOST")
    db_port = os.getenv("PG_PORT") or os.getenv("DB_PORT", "5432")
    db_name = os.getenv("PG_DATABASE") or os.getenv("DB_NAME", "remalab")
    db_user = os.getenv("PG_USER") or os.getenv("DB_USER")
    db_password = os.getenv("PG_PASSWORD") or os.getenv("DB_PASSWORD")
    return f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"


def _create_engine_instance():
    """Yeni bir SQLAlchemy engine oluşturur."""
    return create_engine(
        _build_database_url(),
        pool_pre_ping=True,
        pool_timeout=5,
        pool_recycle=300,
        connect_args=_get_connect_args(),
    )


def get_engine():
    """Engine'i lazily döndürür. İlk çağrıda oluşturulur."""
    global _engine
    if _engine is None:
        _engine = _create_engine_instance()
    return _engine


def get_session_factory():
    """SessionLocal'ı lazily döndürür."""
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=get_engine())
    return _SessionLocal


# Geriye dönük uyumluluk için property-benzeri erişim
# (Mevcut kodda `engine` ve `SessionLocal` doğrudan kullanılıyor olabilir)
class _LazyEngine:
    """engine modül değişkeni gibi davranır ama ilk erişimde oluşturulur."""
    def __getattr__(self, name):
        return getattr(get_engine(), name)

class _LazySession:
    """SessionLocal() çağrıldığında lazily session oluşturur."""
    def __call__(self, *args, **kwargs):
        return get_session_factory()(*args, **kwargs)
    def __getattr__(self, name):
        return getattr(get_session_factory(), name)


engine = _LazyEngine()
SessionLocal = _LazySession()


def init_database_schema():
    """Veritabanı tablolarını oluşturur."""
    from models.user import User  # Modellerin kaydolması için import
    from models.item_bom import ItemBOM
    from models.product import Product
    from models.product_bom import ProductBOM
    # Diğer modeller de buraya eklenebilir
    try:
        Base.metadata.create_all(bind=get_engine())
    except Exception as e:
        print(f"[WARN] Tablo oluşturma başarısız: {e}")


def reconnect_engine():
    """Rebuilds the engine and sessionmaker using current os.environ credentials."""
    global _engine, _SessionLocal
    from dotenv import load_dotenv
    load_dotenv(override=True)

    if _engine is not None:
        try:
            _engine.dispose()
        except Exception:
            pass

    _engine = _create_engine_instance()
    _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)

    # Modül seviyesi proxy nesnelerini güncellemeye gerek yok,
    # get_engine() / get_session_factory() zaten yeni _engine/_SessionLocal kullanır.


@contextmanager
def get_db():
    """Yeni bir veritabanı oturumu oluşturur ve iş bittiğinde kapatır."""
    db = get_session_factory()()
    try:
        yield db
    finally:
        db.close()


# Global hata yakalama (Local try-except blokları yutsa bile yakalar)
from sqlalchemy import event
import sqlalchemy.exc

try:
    import psycopg2
except ImportError:
    psycopg2 = None  # psycopg2 yüklü değilse hata vermesin

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
        print(f"[WARN] Database connection error: {e}")


def register_db_error_listener():
    """Veritabanı çalışma zamanı bağlantı hatalarını yakalamak için dinleyiciyi kaydeder."""
    event.listen(Engine, "handle_error", receive_handle_error)
