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
        "options": "-c statement_timeout=15000",
        "keepalives": 1,
        "keepalives_idle": 5,
        "keepalives_interval": 2,
        "keepalives_count": 5,
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
        pool_timeout=10,
        pool_recycle=120,
        pool_size=40,
        max_overflow=60,
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
    # Modellerin kaydolması için import
    from models.user import User  
    from models.part import Part
    from models.part_category import PartCategory
    from models.item_bom import ItemBOM
    from models.product import Product
    from models.product_bom import ProductBOM
    
    # --- Modül 2 (Warehouse) ---
    from models.item_type import ItemType
    from models.item_category import ItemCategory
    from models.item_category_mission import ItemCategoryMission
    from models.item_labour import ItemLabour
    from models.item_fault import ItemFault
    from models.item_supply_status import ItemSupplyStatus
    from models.item import Item
    from models.product_family import ProductFamily
    from models.product_category import ProductCategory
    from models.brand import Brand
    from models.product_model import ProductModel
    from models.product_bom_node import ProductBomNode
    
    # --- Modül 3 (Service State Machine) ---
    from models.service_statu import ServiceStatu
    from models.service_statu_map import ServiceStatuMap
    from models.service_request_type import ServiceRequestType
    from models.service_request_item_category import ServiceRequestItemCategory

    # --- Modül 4 (Repair and Warranty) ---
    from models.repair_result_type import RepairResultType
    from models.repair_item_operation_type import RepairItemOperationType
    from models.repair_item_warranty import RepairItemWarranty
    from models.repair_record import RepairRecord
    from models.test_detected_part import TestDetectedPart
    from models.test_result_fault import TestResultFault
    from models.phonecheck_test_result import PhonecheckTestResult
    from models.service_repair import ServiceRepair
    from models.batch_entry_statu_history import BatchEntryStatuHistory

    from models.warehouse import Warehouse
    from models.customer import Customer
    from models.mission_group import MissionGroup
    from models.mission_workgroup import MissionWorkgroup
    from models.mission import Mission
    from models.flow_dgd_mapping import FlowDgdMapping
    from models.customer_item_price import CustomerItemPrice
    from models.customer_target_price import CustomerTargetPrice

    try:
        # organization şemasını oluştur (yoksa)
        from sqlalchemy import text
        with get_engine().connect() as conn:
            conn.execute(text("CREATE SCHEMA IF NOT EXISTS organization"))
            conn.commit()
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


# ─────────────────────────────────────────────────────────────────────
# STOK HAREKETİ BAKİYE DAMGASI
#
# Raporlar > Transfer Hareketleri ekranında "kaynak depoda kaç adet kaldı"
# görünmesi isteniyordu. Bu sayı geçmişe dönük HESAPLANAMIYOR: başlangıç
# stokları (MioCreate aktarımı) hareket kaydı üretmeden doğrudan yazılmış,
# bu yüzden hareketlerin toplamı mevcut bakiyeyi açıklamıyor (ölçüldü:
# iPAirWAn giren 2145 / çıkan 10 / bakiye 105). Tek doğru yol, bakiyeyi
# hareket YAZILIRKEN damgalamak.
#
# Kod tabanında 30 ayrı yerde StockMovement üretiliyor. Hepsine tek tek
# dokunmak yerine oturum düzeyinde tek bir kanca kullanılıyor: yeni eklenen
# her StockMovement, flush'tan hemen önce o anki stok miktarıyla damgalanır.
# Böylece bundan sonra eklenen HER hareket türü otomatik kapsanır.
# ─────────────────────────────────────────────────────────────────────

def _o_anki_miktar(session, part_id, location_id):
    """part/lokasyon için işlemin O ANKİ stok miktarı; bulunamazsa None."""
    if part_id is None or location_id is None:
        return None
    from models.stock import Stock

    # 1) Aynı oturumda değiştirilmiş bir Stock nesnesi varsa onun güncel değeri
    #    esas alınır - ORM üzerinden yapılan değişiklikler henüz veritabanına
    #    yazılmadığı için sorgu eski değeri döndürürdü.
    for nesne in list(session.dirty) + list(session.new):
        if isinstance(nesne, Stock) and nesne.part_id == part_id and nesne.location_id == location_id:
            return int(nesne.quantity or 0)

    # 2) Aksi halde veritabanından okunur. Ham SQL ile miktar güncelleyen
    #    yerler aynı işlem içinde zaten yazmış olur, doğru değer gelir.
    #    no_autoflush: sorgu yüzünden yeniden flush tetiklenmesin (sonsuz döngü).
    with session.no_autoflush:
        satir = session.query(Stock.quantity).filter(
            Stock.part_id == part_id, Stock.location_id == location_id
        ).first()
    return int(satir[0] or 0) if satir else 0


def _stok_hareketi_bakiye_damgala(session, flush_context, instances):
    from models.stock_movement import StockMovement

    for nesne in session.new:
        if not isinstance(nesne, StockMovement):
            continue
        try:
            if nesne.source_balance_after is None:
                nesne.source_balance_after = _o_anki_miktar(
                    session, nesne.part_id, nesne.source_location_id)
            if nesne.target_balance_after is None:
                nesne.target_balance_after = _o_anki_miktar(
                    session, nesne.part_id, nesne.target_location_id)
        except Exception as e:
            # Bakiye damgası KOZMETİKTİR. Burada oluşan bir hata gerçek stok
            # işlemini geri almamalı; sessizce boş bırakılır.
            print(f"[WARN] stok hareketi bakiye damgasi atlandi: {type(e).__name__}: {e}")


def register_stock_balance_listener():
    """Yeni stok hareketlerine 'işlem sonrası kalan miktar' damgasını ekler."""
    from sqlalchemy.orm import Session as _Session
    if not event.contains(_Session, "before_flush", _stok_hareketi_bakiye_damgala):
        event.listen(_Session, "before_flush", _stok_hareketi_bakiye_damgala)


# Kanca modül yüklenirken kurulur: WebBridge, betikler ve testler dahil
# oturum açan her yol aynı davranışı görsün.
register_stock_balance_listener()
