import json
from PySide6.QtCore import QObject, Slot, Signal
import json
import logging
import os

def get_cache_dirs():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    # We write to a single external folder.
    # Vite middleware will serve from this folder.
    # Production PySide static server should also be able to serve from it.
    d1 = os.path.join(base_dir, 'api_cache')
    os.makedirs(d1, exist_ok=True)
    return [d1]

def write_to_cache(filename, json_data):
    dirs = get_cache_dirs()
    for d in dirs:
        try:
            with open(os.path.join(d, filename), "w", encoding="utf-8") as f:
                f.write(json_data)
        except Exception as e:
            logging.error(f"Failed to write cache {filename} to {d}: {e}")

from config.database import SessionLocal
from config.auth import verify_password
from models.user import User

from sqlalchemy import event
from sqlalchemy.orm import Session

def clear_api_cache(session):
    """Veritabanında değişiklik olduğunda cache'i temizler, böylece UI sadece yeni veriyi bekler."""
    dirs = get_cache_dirs()
    for d in dirs:
        for filename in ["parts.json", "stock.json", "critical.json"]:
            path = os.path.join(d, filename)
            if os.path.exists(path):
                try: os.remove(path)
                except Exception as e: logging.error(f"Failed to clear cache {path}: {e}")

event.listen(Session, 'after_commit', clear_api_cache)

# Otomatik iş akışıyla yönetilen sabit sistem depoları. Bu depolar arasında
# kullanıcı manuel transfer yapamaz (bkz. transfer_stock).
SYSTEM_LOCATION_KINDS = {
    "good_stock": "Good Stock",
    "doa_stock": "DOA Stock",
    "repair_stock": "Repair Stock",
    "scrap_stock": "Scrap Stock",
    "out_stock": "Out Stock",
}

# work_orders.work_order_type için desteklenen değerler. SERVICE, mevcut/varsayılan
# akıştır (Service Record'a bağlı tamir süreci). PRODUCTION, bir Recipe'ye (ItemBOM,
# bkz. target_part_id) bağlı yarı mamul üretim süreci içindir; Service Record gerektirmez.
WORK_ORDER_TYPE_SERVICE = "SERVICE"
WORK_ORDER_TYPE_PRODUCTION = "PRODUCTION"
WORK_ORDER_TYPES = {WORK_ORDER_TYPE_SERVICE, WORK_ORDER_TYPE_PRODUCTION}

# material_requests.status akışı: WAITING (issued=0) -> PARTIAL (0 < issued < required)
# -> ISSUED (issued >= required). Sadece Production Work Order'lar için kullanılır;
# Service Work Order akışıyla hiçbir ilişkisi yoktur.
MATERIAL_REQUEST_STATUS_WAITING = "WAITING"
MATERIAL_REQUEST_STATUS_PARTIAL = "PARTIAL"
MATERIAL_REQUEST_STATUS_ISSUED = "ISSUED"


def _compute_material_request_status(issued_quantity, required_quantity):
    """issued/required miktarına göre material_requests.status değerini hesaplar."""
    if issued_quantity <= 0:
        return MATERIAL_REQUEST_STATUS_WAITING
    if issued_quantity < required_quantity:
        return MATERIAL_REQUEST_STATUS_PARTIAL
    return MATERIAL_REQUEST_STATUS_ISSUED


# Production Work Order durum akışı: BEKLIYOR -> URETIMDE -> TAMAMLANDI. Service Work
# Order'ın kendi status sözlüğünden (Beklemede/Devam Ediyor/Tamamlandı/...) tamamen
# bağımsızdır; aynı work_orders.status sütununu paylaşırlar ama değer kümeleri farklıdır,
# bu yüzden Service tarafında hiçbir davranış değişikliği olmaz.
PRODUCTION_WO_STATUS_WAITING = "BEKLIYOR"
PRODUCTION_WO_STATUS_IN_PRODUCTION = "URETIMDE"
PRODUCTION_WO_STATUS_COMPLETED = "TAMAMLANDI"


def _get_system_location_id(db, kind):
    """Verilen kind'a ('good_stock' vb.) sahip sistem deposunun id'sini döner."""
    from models.location import Location
    loc = db.query(Location).filter(Location.kind == kind).first()
    return loc.id if loc else None


class WebBridge(QObject):
    """React (JavaScript) ile Python (PySide6) arasındaki köprü sınıfı."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._ensure_department_column()
        self._ensure_status_column()
        self._ensure_departments_table()
        self._ensure_stock_movement_columns()
        self._ensure_service_records_table()
        self._ensure_work_orders_table()
        self._ensure_work_order_type_columns()
        self._ensure_production_work_order_lifecycle_columns()
        self._ensure_material_requests_table()
        self._ensure_production_tables()
        self._ensure_work_order_parts_table()
        self._ensure_location_kind_column()
        self._ensure_system_locations()
        self._ensure_part_category_columns()
        self._ensure_part_extra_columns()
        self._ensure_user_gorev_column()
        self._ensure_user_fullname_column()
        self._ensure_item_bom_data()

    def _ensure_item_bom_data(self):
        """ItemBOM tablosunun verilerini Excel dosyasından okuyarak veri tabanına senkronize eder."""
        from sqlalchemy import text
        from models.part import Part
        from models.item_bom import ItemBOM
        import openpyxl
        import os
        
        db = SessionLocal()
        try:
            # Check if table already has data
            count = db.execute(text("SELECT COUNT(*) FROM warehouse.item_bom;")).scalar()
            if count > 0:
                return
            
            print("[WebBridge] ItemBOM tablosu boş. Excel'den veri içe aktarılıyor...")
            files = [f for f in os.listdir('.') if 'dosya' in f.lower() and not f.startswith('~$')]
            if not files:
                return
            
            fname = files[0]
            wb = openpyxl.load_workbook(fname, data_only=True)
            
            # Read Item sheet for names, types
            ws_item = wb['Item']
            item_rows = list(ws_item.iter_rows(values_only=True))
            h_idx = next(i for i, r in enumerate(item_rows) if r and 'code' in [str(x).lower() for x in r])
            headers_item = item_rows[h_idx]
            shortname_col = next(i for i, h in enumerate(headers_item) if h == 'shortName')
            category_col = next(i for i, h in enumerate(headers_item) if h == 'itemCategory')
            type_col = next(i for i, h in enumerate(headers_item) if h == 'itemType')
            
            item_info_map = {}
            for r in item_rows[h_idx+1:]:
                s_name = r[shortname_col]
                cat_val = r[category_col]
                type_val = r[type_col]
                if s_name:
                    item_info_map[str(s_name)] = {
                        "name": str(s_name),
                        "item_category": str(cat_val) if cat_val else None,
                        "part_type": str(type_val) if type_val else None
                    }
            
            # Read ItemBom sheet
            ws_bom = wb['ItemBom']
            bom_rows = list(ws_bom.iter_rows(values_only=True))
            h_idx_bom = next(i for i, r in enumerate(bom_rows) if r and 'UretilenParcaKodu' in [str(x) for x in r])
            headers_bom = bom_rows[h_idx_bom]
            
            parent_col = next(i for i, h in enumerate(headers_bom) if h == 'UretilenParcaKodu')
            child1_col = next(i for i, h in enumerate(headers_bom) if h == 'Tuketilen Parca_1')
            qty1_col = next(i for i, h in enumerate(headers_bom) if h == 'Tuketilen Parca_1_Miktar')
            child2_col = next(i for i, h in enumerate(headers_bom) if h == 'Tuketilen Parca_2')
            qty2_col = next(i for i, h in enumerate(headers_bom) if h == 'Tuketilen Parca_2_Miktar')
            
            bom_data = []
            unique_codes = set()
            
            for r in bom_rows[h_idx_bom+1:]:
                parent = r[parent_col]
                child1 = r[child1_col]
                qty1 = r[qty1_col]
                child2 = r[child2_col]
                qty2 = r[qty2_col]
                
                if not parent:
                    continue
                
                unique_codes.add(parent)
                children = []
                if child1:
                    unique_codes.add(child1)
                    children.append((child1, int(qty1) if qty1 else 1))
                if child2:
                    unique_codes.add(child2)
                    children.append((child2, int(qty2) if qty2 else 1))
                    
                bom_data.append({
                    'parent': parent,
                    'children': children
                })
            
            wb.close()
            
            # Insert missing parts
            existing_parts = db.query(Part).filter(Part.item_code.in_(list(unique_codes))).all()
            existing_codes = {p.item_code for p in existing_parts}
            missing_codes = unique_codes - existing_codes
            
            for code in missing_codes:
                info = item_info_map.get(code, {"name": code, "item_category": None, "part_type": None})
                new_part = Part(
                    item_code=code,
                    name=info["name"],
                    item_category=info.get("item_category"),
                    part_type=info["part_type"],
                    status="Aktif",
                    stock_tracking_type="Stok Takipli",
                    critical_limit=10
                )
                db.add(new_part)
            
            if missing_codes:
                db.commit()
            
            # Insert BOMs
            for item in bom_data:
                parent = item['parent']
                for child, qty in item['children']:
                    new_bom = ItemBOM(
                        parent_item_id=parent,
                        child_item_id=child,
                        quantity=qty
                    )
                    db.add(new_bom)
            
            db.commit()
            print(f"[WebBridge] ItemBOM Excel verisi başarıyla senkronize edildi. Toplam {len(bom_data)} reçete eklendi.")
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] ItemBOM senkronizasyon hatası: {e}")
        finally:
            db.close()

    def _ensure_user_gorev_column(self):
        """warehouse.users tablosuna gorev sütunu yoksa ekler."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            db.execute(text("ALTER TABLE warehouse.users ADD COLUMN IF NOT EXISTS gorev VARCHAR(100);"))
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] users.gorev kolonu eklenemedi: {e}")
        finally:
            db.close()

    def _ensure_user_fullname_column(self):
        """warehouse.users tablosuna fullname sütunu yoksa ekler."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            db.execute(text("ALTER TABLE warehouse.users ADD COLUMN IF NOT EXISTS fullname VARCHAR(150);"))
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] users.fullname kolonu eklenemedi: {e}")
        finally:
            db.close()

    def _ensure_production_tables(self):
        """warehouse.production_runs ve production_materials tablolarını yoksa oluşturur."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS warehouse.production_runs (
                    id SERIAL PRIMARY KEY,
                    target_part_id INTEGER REFERENCES warehouse.parts(id),
                    quantity_produced INTEGER NOT NULL,
                    location_id INTEGER REFERENCES warehouse.locations(id),
                    source_location_id INTEGER REFERENCES warehouse.locations(id),
                    produced_by VARCHAR(150),
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))
            db.execute(text("""
                ALTER TABLE warehouse.production_runs 
                ADD COLUMN IF NOT EXISTS source_location_id INTEGER REFERENCES warehouse.locations(id);
            """))
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS warehouse.production_materials (
                    id SERIAL PRIMARY KEY,
                    production_run_id INTEGER REFERENCES warehouse.production_runs(id) ON DELETE CASCADE,
                    part_id INTEGER REFERENCES warehouse.parts(id),
                    quantity_consumed INTEGER NOT NULL
                );
            """))
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS warehouse.produced_units (
                    id SERIAL PRIMARY KEY,
                    production_run_id INTEGER REFERENCES warehouse.production_runs(id) ON DELETE CASCADE,
                    serial_number VARCHAR(100) UNIQUE NOT NULL
                );
            """))
            
            # Clean up old records to avoid data inconsistency with the new unique serial number system
            run_count = db.execute(text("SELECT COUNT(*) FROM warehouse.production_runs")).scalar() or 0
            unit_count = db.execute(text("SELECT COUNT(*) FROM warehouse.produced_units")).scalar() or 0
            if run_count > 0 and unit_count == 0:
                db.execute(text("TRUNCATE warehouse.production_runs RESTART IDENTITY CASCADE;"))

            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] production tabloları oluşturulamadı: {e}")
        finally:
            db.close()

    def _ensure_work_orders_table(self):
        """warehouse.work_orders tablosu yoksa oluşturur."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS warehouse.work_orders (
                    id SERIAL PRIMARY KEY,
                    service_record_id INTEGER REFERENCES warehouse.service_records(id),
                    description TEXT,
                    assigned_technician VARCHAR(150),
                    priority VARCHAR(20) DEFAULT 'Orta',
                    start_date DATE,
                    end_date DATE,
                    parts_used TEXT,
                    status VARCHAR(30) DEFAULT 'Beklemede',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))
            db.execute(text("ALTER TABLE warehouse.work_orders ADD COLUMN IF NOT EXISTS source_location_id INTEGER REFERENCES warehouse.locations(id);"))
            db.execute(text("ALTER TABLE warehouse.work_orders ADD COLUMN IF NOT EXISTS stock_settled_at TIMESTAMP;"))
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] work_orders tablosu oluşturulamadı: {e}")
        finally:
            db.close()

    def _ensure_work_order_type_columns(self):
        """warehouse.work_orders tablosuna work_order_type ve target_part_id sütunlarını ekler.

        work_order_type: DEFAULT 'SERVICE' olduğu için mevcut kayıtlar ve mevcut Service
        Work Order akışı (create_work_order/update_work_order) hiç değişmeden çalışmaya
        devam eder. PRODUCTION tipi için service_record_id NULL kalır; bunun yerine
        target_part_id üzerinden bir Recipe'ye (warehouse.item_bom, parent_item_id =
        hedef parçanın item_code'u) bağlanır.
        """
        from sqlalchemy import text
        db = SessionLocal()
        try:
            db.execute(text("""
                ALTER TABLE warehouse.work_orders
                ADD COLUMN IF NOT EXISTS work_order_type VARCHAR(20) NOT NULL DEFAULT 'SERVICE';
            """))
            db.execute(text("""
                ALTER TABLE warehouse.work_orders
                ADD COLUMN IF NOT EXISTS target_part_id INTEGER REFERENCES warehouse.parts(id);
            """))
            db.execute(text("""
                ALTER TABLE warehouse.work_orders
                ADD COLUMN IF NOT EXISTS planned_quantity INTEGER;
            """))
            db.execute(text("CREATE INDEX IF NOT EXISTS idx_work_orders_type ON warehouse.work_orders(work_order_type);"))
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] work_order_type sütunları eklenemedi: {e}")
        finally:
            db.close()

    def _ensure_production_work_order_lifecycle_columns(self):
        """warehouse.work_orders tablosuna Production Work Order'ın üretim yaşam
        döngüsü (BEKLIYOR -> URETIMDE -> TAMAMLANDI) için gereken sütunları ekler.
        Hepsi nullable olduğu için Service Work Order kayıtlarında hep NULL kalır ve
        mevcut Service akışı hiç etkilenmez."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            db.execute(text("ALTER TABLE warehouse.work_orders ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;"))
            db.execute(text("ALTER TABLE warehouse.work_orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;"))
            db.execute(text("ALTER TABLE warehouse.work_orders ADD COLUMN IF NOT EXISTS produced_quantity INTEGER;"))
            db.execute(text("ALTER TABLE warehouse.work_orders ADD COLUMN IF NOT EXISTS scrap_quantity INTEGER;"))
            db.execute(text("ALTER TABLE warehouse.work_orders ADD COLUMN IF NOT EXISTS production_notes TEXT;"))
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] production work order lifecycle sütunları eklenemedi: {e}")
        finally:
            db.close()

    def _ensure_material_requests_table(self):
        """warehouse.material_requests tablosunu yoksa oluşturur. Bir Production Work
        Order'ın Recipe'sindeki (item_bom) her satır için bir Material Request kaydı
        tutulur. remaining_quantity kalıcı sütun değil; okuma sırasında
        (required_quantity - issued_quantity) olarak hesaplanır."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS warehouse.material_requests (
                    id SERIAL PRIMARY KEY,
                    work_order_id INTEGER NOT NULL REFERENCES warehouse.work_orders(id) ON DELETE CASCADE,
                    part_id INTEGER NOT NULL REFERENCES warehouse.parts(id),
                    required_quantity INTEGER NOT NULL,
                    issued_quantity INTEGER NOT NULL DEFAULT 0,
                    status VARCHAR(20) NOT NULL DEFAULT 'WAITING',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))
            db.execute(text("CREATE INDEX IF NOT EXISTS idx_material_requests_work_order_id ON warehouse.material_requests(work_order_id);"))
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] material_requests tablosu oluşturulamadı: {e}")
        finally:
            db.close()

    def _ensure_work_order_parts_table(self):
        """warehouse.work_order_parts tablosu yoksa oluşturur (Parça Tedarik Durumu modülü)."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS warehouse.work_order_parts (
                    id SERIAL PRIMARY KEY,
                    work_order_id INTEGER NOT NULL REFERENCES warehouse.work_orders(id) ON DELETE CASCADE,
                    part_id INTEGER NOT NULL REFERENCES warehouse.parts(id),
                    quantity INTEGER NOT NULL DEFAULT 1,
                    status VARCHAR(30) NOT NULL DEFAULT 'Stokta Var',
                    delivered_location_id INTEGER REFERENCES warehouse.locations(id),
                    delivery_movement_id INTEGER REFERENCES warehouse.stock_movements(id),
                    delivered_by VARCHAR(150),
                    delivered_at TIMESTAMP,
                    waiting_notes TEXT,
                    marked_waiting_by VARCHAR(150),
                    marked_waiting_at TIMESTAMP,
                    reversal_movement_id INTEGER REFERENCES warehouse.stock_movements(id),
                    reverted_by VARCHAR(150),
                    reverted_at TIMESTAMP,
                    requested_by VARCHAR(150),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))
            db.execute(text("""
                ALTER TABLE warehouse.work_order_parts
                ADD COLUMN IF NOT EXISTS delivered_location_id INTEGER REFERENCES warehouse.locations(id);
            """))
            db.execute(text("""
                ALTER TABLE warehouse.work_order_parts
                ADD COLUMN IF NOT EXISTS delivery_movement_id INTEGER REFERENCES warehouse.stock_movements(id);
            """))
            db.execute(text("""
                ALTER TABLE warehouse.work_order_parts
                ADD COLUMN IF NOT EXISTS reversal_movement_id INTEGER REFERENCES warehouse.stock_movements(id);
            """))
            db.execute(text("CREATE INDEX IF NOT EXISTS idx_wop_work_order_id ON warehouse.work_order_parts(work_order_id);"))
            db.execute(text("CREATE INDEX IF NOT EXISTS idx_wop_status ON warehouse.work_order_parts(status);"))
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] work_order_parts tablosu oluşturulamadı: {e}")
        finally:
            db.close()

    def _ensure_service_records_table(self):
        """warehouse.service_records tablosu yoksa oluşturur."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS warehouse.service_records (
                    id SERIAL PRIMARY KEY,
                    customer_name VARCHAR(150) NOT NULL,
                    customer_phone VARCHAR(30),
                    customer_email VARCHAR(150),
                    company VARCHAR(150),
                    brand VARCHAR(100),
                    model VARCHAR(100),
                    memory VARCHAR(50),
                    product_code VARCHAR(100),
                    color VARCHAR(50),
                    fault_category VARCHAR(100),
                    fault_type VARCHAR(150),
                    customer_complaint TEXT,
                    preliminary_diagnosis TEXT,
                    status VARCHAR(30) DEFAULT 'Arıza Kabul',
                    technician_note TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))
            db.execute(text("ALTER TABLE warehouse.service_records ADD COLUMN IF NOT EXISTS memory VARCHAR(50);"))
            db.execute(text("ALTER TABLE warehouse.service_records ADD COLUMN IF NOT EXISTS product_code VARCHAR(100);"))
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] service_records tablosu oluşturulamadı: {e}")
        finally:
            db.close()

    def _ensure_stock_movement_columns(self):
        """warehouse.stock_movements tablosuna technician, description ve movement_kind sütunlarını ekler."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            db.execute(text("ALTER TABLE warehouse.stock_movements ADD COLUMN IF NOT EXISTS technician VARCHAR(150);"))
            db.execute(text("ALTER TABLE warehouse.stock_movements ADD COLUMN IF NOT EXISTS description TEXT;"))
            db.execute(text("ALTER TABLE warehouse.stock_movements ADD COLUMN IF NOT EXISTS movement_kind VARCHAR(20);"))
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] stock_movements kolonları eklenemedi: {e}")
        finally:
            db.close()

    def _ensure_location_kind_column(self):
        """warehouse.locations tablosuna kind sütunu yoksa ekler."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            db.execute(text("ALTER TABLE warehouse.locations ADD COLUMN IF NOT EXISTS kind VARCHAR(20);"))
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] locations.kind kolonu eklenemedi: {e}")
        finally:
            db.close()

    def _ensure_system_locations(self):
        """Good/DOA/Repair/Scrap/Out Stock sistem depolarını yoksa oluşturur."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            for kind, name in SYSTEM_LOCATION_KINDS.items():
                db.execute(text("""
                    INSERT INTO warehouse.locations (name, kind)
                    SELECT :name, :kind
                    WHERE NOT EXISTS (SELECT 1 FROM warehouse.locations WHERE kind = :kind)
                """), {"name": name, "kind": kind})
                db.execute(text("""
                    UPDATE warehouse.locations SET name = :name WHERE kind = :kind
                """), {"name": name, "kind": kind})
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] sistem depoları oluşturulamadı: {e}")
        finally:
            db.close()

    def _ensure_part_category_columns(self):
        """warehouse.part_categories tablosuna Parça Kategorisi modülü sütunlarını ekler."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            db.execute(text("ALTER TABLE warehouse.part_categories ADD COLUMN IF NOT EXISTS departments VARCHAR(255);"))
            db.execute(text("ALTER TABLE warehouse.part_categories ADD COLUMN IF NOT EXISTS stock_tracking_type VARCHAR(20) DEFAULT 'Stok Takipli';"))
            db.execute(text("ALTER TABLE warehouse.part_categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;"))
            db.execute(text("ALTER TABLE warehouse.part_categories ADD COLUMN IF NOT EXISTS description TEXT;"))
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] part_categories kolonları eklenemedi: {e}")
        finally:
            db.close()

    def _ensure_part_extra_columns(self):
        """warehouse.parts tablosuna part_category_id, barcode ve part_type sütunlarını ekler."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            db.execute(text("ALTER TABLE warehouse.parts ADD COLUMN IF NOT EXISTS part_category_id INTEGER REFERENCES warehouse.part_categories(id);"))
            db.execute(text("ALTER TABLE warehouse.parts ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);"))
            db.execute(text("ALTER TABLE warehouse.parts ADD COLUMN IF NOT EXISTS part_type VARCHAR(100);"))
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] parts ek kolonları eklenemedi: {e}")
        finally:
            db.close()

    def _ensure_department_column(self):
        """warehouse.parts tablosuna department sütunu yoksa ekler."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            db.execute(text("ALTER TABLE warehouse.parts ADD COLUMN IF NOT EXISTS department VARCHAR(255);"))
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] department kolonu eklenemedi: {e}")
        finally:
            db.close()

    def _ensure_status_column(self):
        """warehouse.parts tablosuna status sütunu yoksa ekler."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            db.execute(text("ALTER TABLE warehouse.parts ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Aktif';"))
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] status kolonu eklenemedi: {e}")
        finally:
            db.close()

    def _ensure_departments_table(self):
        """warehouse.departments tablosu yoksa oluşturur."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS warehouse.departments (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    code VARCHAR(20),
                    responsible VARCHAR(150),
                    default_location_id INTEGER REFERENCES warehouse.locations(id),
                    status VARCHAR(20) DEFAULT 'Aktif'
                );
            """))
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] departments tablosu oluşturulamadı: {e}")
        finally:
            db.close()

    @Slot(str, str, result=str)
    def login(self, username, password):
        """React üzerinden gelen giriş isteğini işler."""
        print(f"[WebBridge] Login request received for username: {username}")
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.username == username).first()
            if not user:
                return json.dumps({"success": False, "message": "Kullanıcı bulunamadı"})
            
            if not verify_password(password, user.password_hash):
                return json.dumps({"success": False, "message": "Hatalı şifre"})

            # Başarılı giriş
            user_data = {
                "id": user.id,
                "username": user.username,
                "tc_no": user.tc_no or "",
                "fullname": user.fullname or "",
                "role": user.role,
                "gorev": user.gorev or "",
                "account_enabled": user.account_enabled if user.account_enabled is not None else True,
                "team_leader": user.team_leader or "",
                "operation_manager": user.operation_manager or "",
                "administrative_manager": user.administrative_manager or ""
            }
            return json.dumps({"success": True, "user": user_data})
        except Exception as e:
            return json.dumps({"success": False, "message": f"Veritabanı hatası: {str(e)}"})
        finally:
            db.close()

    @Slot(result=str)
    def get_users(self):
        """Tüm kullanıcıları getirir."""
        db = SessionLocal()
        try:
            users = db.query(User).all()
            users_list = []
            for u in users:
                users_list.append({
                    "id": u.id,
                    "username": u.username,
                    "tc_no": u.tc_no or "",
                    "fullname": u.fullname or "",
                    "role": u.role,
                    "gorev": u.gorev or "",
                    "account_enabled": u.account_enabled if u.account_enabled is not None else True,
                    "team_leader": u.team_leader or "",
                    "operation_manager": u.operation_manager or "",
                    "administrative_manager": u.administrative_manager or ""
                })
            return json.dumps({"success": True, "users": users_list})
        except Exception as e:
            return json.dumps({"success": False, "message": f"Kullanıcılar getirilemedi: {str(e)}"})
        finally:
            db.close()

    @Slot(str, str, str, str, str, str, bool, str, str, str, result=str)
    def create_user(self, username, tc_no, password, role, gorev, fullname, account_enabled, team_leader, operation_manager, administrative_manager):
        """Yeni bir kullanıcı oluşturur."""
        from config.auth import get_password_hash
        db = SessionLocal()
        try:
            # Var olanı kontrol et
            if db.query(User).filter(User.username == username).first():
                return json.dumps({"success": False, "message": "Bu kullanıcı adı zaten alınmış"})
            if db.query(User).filter(User.tc_no == tc_no).first():
                return json.dumps({"success": False, "message": "Bu TC kimlik numarası zaten kullanımda"})
            
            hashed_pwd = get_password_hash(password)
            new_user = User(
                username=username,
                tc_no=tc_no,
                password_hash=hashed_pwd,
                role=role,
                gorev=gorev or None,
                fullname=fullname or None,
                account_enabled=account_enabled,
                team_leader=team_leader or None,
                operation_manager=operation_manager or None,
                administrative_manager=administrative_manager or None
            )
            db.add(new_user)
            db.commit()
            return json.dumps({"success": True, "message": "Kullanıcı başarıyla oluşturuldu"})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Kullanıcı oluşturulamadı: {str(e)}"})
        finally:
            db.close()

    @Slot(str, str, str, str, str, str, str, bool, str, str, str, result=str)
    def update_user(self, user_id_str, username, tc_no, password, role, gorev, fullname, account_enabled, team_leader, operation_manager, administrative_manager):
        """Var olan bir kullanıcıyı günceller."""
        import sys
        print(f"[WebBridge] update_user called with ID: '{user_id_str}', username: '{username}', tc_no: '{tc_no}', gorev: '{gorev}', fullname: '{fullname}', account_enabled: {account_enabled}")
        sys.stdout.flush()
        from config.auth import get_password_hash
        db = SessionLocal()
        try:
            user_id = int(user_id_str)
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                print("[WebBridge] User not found.")
                sys.stdout.flush()
                return json.dumps({"success": False, "message": "Kullanıcı bulunamadı"})
            
            # Başka bir kullanıcının aynı kullanıcı adını kullanıp kullanmadığını kontrol et
            if username != user.username and db.query(User).filter(User.username == username).first():
                print("[WebBridge] Username already taken.")
                sys.stdout.flush()
                return json.dumps({"success": False, "message": "Bu kullanıcı adı zaten alınmış"})
                
            if tc_no != user.tc_no and db.query(User).filter(User.tc_no == tc_no).first():
                print("[WebBridge] TC No already taken.")
                sys.stdout.flush()
                return json.dumps({"success": False, "message": "Bu TC kimlik numarası zaten kullanımda"})
            
            user.username = username
            user.tc_no = tc_no
            user.role = role
            user.gorev = gorev or None
            user.fullname = fullname or None
            user.account_enabled = account_enabled
            user.team_leader = team_leader or None
            user.operation_manager = operation_manager or None
            user.administrative_manager = administrative_manager or None
            
            # Şifre gönderilmişse güncelle
            if password and len(password.strip()) > 0:
                print("[WebBridge] Updating password.")
                sys.stdout.flush()
                user.password_hash = get_password_hash(password)
                
            db.commit()
            print("[WebBridge] User updated successfully. Role is now:", user.role)
            sys.stdout.flush()
            return json.dumps({"success": True, "message": "Kullanıcı başarıyla güncellendi"})
        except Exception as e:
            print(f"[WebBridge] Update error: {str(e)}")
            sys.stdout.flush()
            db.rollback()
            return json.dumps({"success": False, "message": f"Güncelleme hatası: {str(e)}"})
        finally:
            db.close()

    # ==========================
    # PARTS (PARÇALAR) MODÜLÜ
    # ==========================

    @Slot(result=str)
    def get_parts(self):
        filename = "parts.json"
        path = os.path.join(get_cache_dirs()[0], filename)
        fetch_url = f"http://localhost:5173/api_cache/{filename}" if os.getenv("DEV_MODE", "1") == "1" else f"/api_cache/{filename}"
        if os.path.exists(path):
            return json.dumps({"success": True, "fetch_url": fetch_url})
            
        from sqlalchemy import text
        db = SessionLocal()
        try:
            result = db.execute(text("""
                SELECT p.id, p.name, p.item_code, p.barcode, p.brand, p.model, p.color,
                       p.item_category, p.part_category_id,
                       COALESCE(pc.name, p.part_category) AS part_category,
                       COALESCE(p.part_type, '') AS part_type,
                       COALESCE(pc.departments, p.department, '') AS department,
                       COALESCE(pc.stock_tracking_type, p.stock_tracking_type, 'Stok Takipli') AS stock_tracking_type,
                       NULL AS default_location_id, '' AS default_location_name,
                       p.status, p.critical_limit
                FROM warehouse.parts p
                LEFT JOIN warehouse.part_categories pc ON pc.id = p.part_category_id
                ORDER BY p.id DESC
            """)).mappings().all()
            parts_list = []
            for row in result:
                parts_list.append({
                    "id": str(row["id"]),
                    "name": row["name"] or "",
                    "item_code": row["item_code"] or "",
                    "barcode": row["barcode"] or "",
                    "brand": row["brand"] or "",
                    "model": row["model"] or "",
                    "color": row["color"] or "",
                    "part_category": row["part_category"] or "",
                    "part_type": row["part_type"] or "",
                    "item_category": row["item_category"] or "",
                    "department": row["department"] or "",
                    "stock_tracking_type": row["stock_tracking_type"] or "",
                    "default_location_id": row["default_location_id"] or "",
                    "default_location_name": row["default_location_name"] or "",
                    "status": row["status"] or "Aktif",
                    "critical_limit": row["critical_limit"] or 50,
                    "part_category_id": row["part_category_id"]
                })
            json_data = json.dumps({"success": True, "parts": parts_list})
            write_to_cache("parts.json", json_data)
            return json.dumps({"success": True, "fetch_url": "/api_cache/parts.json"})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(result=str)
    def get_item_boms(self):
        """Tüm ItemBOM (Recipe) kayıtlarını, parent ve child parça bilgileriyle birlikte
        getirir. item_bom küçük bir tablo olduğu için (get_parts/get_products/get_stock'un
        aksine) dosya cache'i kullanılmaz, doğrudan sorgulanır."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            result = db.execute(text("""
                SELECT b.id, b.parent_item_id, b.child_item_id, b.quantity,
                       p_parent.name AS parent_name, p_parent.id AS parent_part_id,
                       p_child.name AS child_name, p_child.id AS child_part_id
                FROM warehouse.item_bom b
                LEFT JOIN warehouse.parts p_parent ON p_parent.item_code = b.parent_item_id
                LEFT JOIN warehouse.parts p_child ON p_child.item_code = b.child_item_id
                ORDER BY b.parent_item_id, b.child_item_id;
            """)).mappings().all()

            bom_map = {}
            for row in result:
                parent_code = row["parent_item_id"]
                if parent_code not in bom_map:
                    bom_map[parent_code] = {
                        "parent_item_id": parent_code,
                        "parent_part_id": str(row["parent_part_id"]) if row["parent_part_id"] else "",
                        "parent_name": row["parent_name"] or parent_code,
                        "materials": []
                    }
                bom_map[parent_code]["materials"].append({
                    "child_item_id": row["child_item_id"],
                    "child_part_id": str(row["child_part_id"]) if row["child_part_id"] else "",
                    "child_name": row["child_name"] or row["child_item_id"],
                    "quantity": int(row["quantity"])
                })

            return json.dumps({"success": True, "item_boms": list(bom_map.values())}, ensure_ascii=False)
        except Exception as e:
            print(f"[WebBridge] get_item_boms hatası: {e}")
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, str, str, str, str, str, str, str, str, str, str, str, result=str)
    def create_part(self, name, item_code, barcode, brand, model, item_category, part_category, part_category_id, stock_tracking_type, department, status, critical_limit, memory, part_type):
        """Yeni parça ekler."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            code = item_code.strip()
            if not code:
                return json.dumps({"success": False, "message": "Parça Kodu zorunludur"})

            part_name = name.strip()
            if not part_name:
                part_name = f"{brand.strip()} {model.strip()}".strip() or code

            sql = """
                INSERT INTO warehouse.parts (name, item_code, barcode, brand, model, item_category, part_category, part_category_id, stock_tracking_type, department, status, critical_limit, memory, part_type)
                VALUES (:name, :code, :barcode, :brand, :model, :icat, :pcat, :pcat_id, :stt, :dept, :status, :critical_limit, :memory, :part_type)
            """
            db.execute(text(sql), {
                "name": part_name, "code": code, "barcode": barcode or None,
                "brand": brand or None, "model": model or None,
                "icat": item_category or None, "pcat": part_category or None,
                "pcat_id": int(part_category_id) if part_category_id.strip() else None,
                "stt": stock_tracking_type or "Stok Takipli",
                "dept": department or None,
                "status": status or "Aktif",
                "critical_limit": int(critical_limit) if critical_limit.strip() else 50,
                "memory": memory or None,
                "part_type": part_type or None
            })
            db.commit()
            return json.dumps({"success": True, "message": "Parça eklendi"})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Kayıt hatası: {str(e)}"})
        finally:
            db.close()

    @Slot(str, str, str, str, str, str, str, str, str, str, str, str, str, str, str, result=str)
    def update_part(self, part_id_str, name, item_code, barcode, brand, model, item_category, part_category, part_category_id, stock_tracking_type, department, status, critical_limit, memory, part_type):
        """Var olan bir parçayı günceller."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            part_id = int(part_id_str)
            code = item_code.strip()
            if not code:
                return json.dumps({"success": False, "message": "Parça Kodu zorunludur"})

            part_name = name.strip()
            if not part_name:
                part_name = f"{brand.strip()} {model.strip()}".strip() or code

            sql = """
                UPDATE warehouse.parts
                SET name = :name, item_code = :code, barcode = :barcode, brand = :brand,
                    model = :model, item_category = :icat, part_category = :pcat,
                    part_category_id = :pcat_id, stock_tracking_type = :stt,
                    department = :dept, status = :status, critical_limit = :critical_limit,
                    memory = :memory, part_type = :part_type
                WHERE id = :id
            """
            db.execute(text(sql), {
                "name": part_name, "code": code, "barcode": barcode or None,
                "brand": brand or None, "model": model or None,
                "icat": item_category or None, "pcat": part_category or None,
                "pcat_id": int(part_category_id) if part_category_id.strip() else None,
                "stt": stock_tracking_type or "Stok Takipli",
                "dept": department or None,
                "status": status or "Aktif",
                "critical_limit": int(critical_limit) if critical_limit.strip() else 50,
                "memory": memory or None,
                "part_type": part_type or None,
                "id": part_id
            })
            db.commit()
            return json.dumps({"success": True, "message": "Parça güncellendi"})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Güncelleme hatası: {str(e)}"})
        finally:
            db.close()

    @Slot(str, result=str)
    def delete_part(self, part_id_str):
        """Belirtilen id'ye sahip parçayı siler."""
        from sqlalchemy import text
        from models.stock import Stock
        from models.stock_movement import StockMovement
        db = SessionLocal()
        try:
            part_id = int(part_id_str)
            
            # Orphan ve Yabancı Anahtar kontrolleri
            stock_count = db.query(Stock).filter(Stock.part_id == part_id, Stock.quantity > 0).count()
            if stock_count > 0:
                return json.dumps({"success": False, "message": "Bu parçanın stokta ürünü var, silinemez."})
            
            movement_count = db.query(StockMovement).filter(StockMovement.part_id == part_id).count()
            if movement_count > 0:
                return json.dumps({"success": False, "message": "Bu parçanın geçmiş stok hareketi var, silinemez."})

            inbound_count = db.execute(text("SELECT COUNT(*) FROM warehouse.inbound_entries WHERE part_id = :id"), {"id": part_id}).scalar()
            if inbound_count > 0:
                return json.dumps({"success": False, "message": "Bu parça giriş işlemlerinde kullanılıyor, silinemez."})
                
            outbound_count = db.execute(text("SELECT COUNT(*) FROM warehouse.outbound_entries WHERE part_id = :id"), {"id": part_id}).scalar()
            if outbound_count > 0:
                return json.dumps({"success": False, "message": "Bu parça çıkış işlemlerinde kullanılıyor, silinemez."})
                
            prun_count = db.execute(text("SELECT COUNT(*) FROM warehouse.production_runs WHERE target_part_id = :id"), {"id": part_id}).scalar()
            if prun_count > 0:
                return json.dumps({"success": False, "message": "Bu parça üretim kayıtlarında (üretilen parça olarak) kullanılıyor, silinemez."})
                
            pmaterial_count = db.execute(text("SELECT COUNT(*) FROM warehouse.production_materials WHERE part_id = :id"), {"id": part_id}).scalar()
            if pmaterial_count > 0:
                return json.dumps({"success": False, "message": "Bu parça üretim reçetelerinde (tüketilen malzeme olarak) kullanılıyor, silinemez."})
                
            wopart_count = db.execute(text("SELECT COUNT(*) FROM warehouse.work_order_parts WHERE part_id = :id"), {"id": part_id}).scalar()
            if wopart_count > 0:
                return json.dumps({"success": False, "message": "Bu parça iş emri malzeme listesinde kullanılıyor, silinemez."})

            # Silinmesi güvenli olan parçanın 0 miktarlı stok kayıtlarını temizle
            db.execute(text("DELETE FROM warehouse.stock WHERE part_id = :id AND quantity = 0"), {"id": part_id})
            db.commit()

            db.execute(text("DELETE FROM warehouse.parts WHERE id = :id"), {"id": part_id})
            db.commit()
            return json.dumps({"success": True, "message": "Parça silindi"})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Silme hatası: {str(e)}"})
        finally:
            db.close()

    @Slot(str, result=str)
    def delete_parts_bulk(self, part_ids_csv):
        """Birden fazla parçayı toplu olarak siler."""
        from sqlalchemy import text
        from models.stock import Stock
        from models.stock_movement import StockMovement
        db = SessionLocal()
        try:
            ids = [int(x.strip()) for x in part_ids_csv.split(",") if x.strip()]
            if not ids:
                return json.dumps({"success": False, "message": "Silinecek parça seçilmedi."})
            
            # Orphan ve Yabancı Anahtar kontrolleri
            safe_ids = []
            skipped_count = 0
            for pid in ids:
                stock_count = db.query(Stock).filter(Stock.part_id == pid, Stock.quantity > 0).count()
                movement_count = db.query(StockMovement).filter(StockMovement.part_id == pid).count()
                
                inbound_count = db.execute(text("SELECT COUNT(*) FROM warehouse.inbound_entries WHERE part_id = :id"), {"id": pid}).scalar()
                outbound_count = db.execute(text("SELECT COUNT(*) FROM warehouse.outbound_entries WHERE part_id = :id"), {"id": pid}).scalar()
                prun_count = db.execute(text("SELECT COUNT(*) FROM warehouse.production_runs WHERE target_part_id = :id"), {"id": pid}).scalar()
                pmaterial_count = db.execute(text("SELECT COUNT(*) FROM warehouse.production_materials WHERE part_id = :id"), {"id": pid}).scalar()
                wopart_count = db.execute(text("SELECT COUNT(*) FROM warehouse.work_order_parts WHERE part_id = :id"), {"id": pid}).scalar()
                
                if (stock_count == 0 and movement_count == 0 and inbound_count == 0 and 
                    outbound_count == 0 and prun_count == 0 and pmaterial_count == 0 and wopart_count == 0):
                    safe_ids.append(pid)
                else:
                    skipped_count += 1
                    
            if not safe_ids:
                return json.dumps({"success": False, "message": "Seçilen parçaların hiçbirisi silinmeye uygun değil (Stok, hareket geçmişi, reçete veya iş emri mevcut)." })
                
            # Silinecek parçaların 0 miktarlı stok kayıtlarını temizle
            db.execute(text("DELETE FROM warehouse.stock WHERE part_id = any(:ids) AND quantity = 0"), {"ids": safe_ids})
            db.commit()
            
            ids_placeholder = ",".join(str(x) for x in safe_ids)
            db.execute(text(f"DELETE FROM warehouse.parts WHERE id IN ({ids_placeholder})"))
            db.commit()
            
            msg = f"{len(safe_ids)} parça başarıyla silindi."
            if skipped_count > 0:
                msg += f" {skipped_count} adet parça ilişkili kayıtları (stok, reçete vb.) olduğu için silinemedi."
            return json.dumps({"success": True, "message": msg})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Toplu silme hatası: {str(e)}"})
        finally:
            db.close()

    @Slot(str, result=str)
    def delete_user(self, user_id_str):
        """Belirtilen id'ye sahip kullanıcıyı siler."""
        import sys
        print(f"[WebBridge] delete_user called with ID: {user_id_str}")
        sys.stdout.flush()
        from models.user import User
        db = SessionLocal()
        try:
            user_id = int(user_id_str)
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                return json.dumps({"success": False, "message": "Kullanıcı bulunamadı"})
            
            if user.role == "Admin":
                admin_count = db.query(User).filter(User.role == "Admin").count()
                if admin_count <= 1:
                    return json.dumps({"success": False, "message": "Sistemdeki son Admin kullanıcısı silinemez!"})
            
            db.delete(user)
            db.commit()
            return json.dumps({"success": True, "message": "Kullanıcı silindi"})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Silme hatası: {str(e)}"})
        finally:
            db.close()

    # --- YENİ EKLENEN LOKASYON FONKSİYONLARI ---
    @Slot(result=str)
    def get_locations(self):
        from models.location import Location
        db = SessionLocal()
        try:
            locs = db.query(Location).all()
            return json.dumps({"success": True, "locations": [{"id": l.id, "name": l.name, "kind": l.kind, "description": l.description} for l in locs]})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(result=str)
    def get_system_locations(self):
        """Good/DOA/Repair/Scrap/Out Stock sistem depolarını döner."""
        from models.location import Location
        db = SessionLocal()
        try:
            locs = db.query(Location).filter(Location.kind.isnot(None)).all()
            return json.dumps({"success": True, "locations": [{"id": l.id, "name": l.name, "kind": l.kind} for l in locs]})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, result=str)
    def create_location(self, name, description):
        from models.location import Location
        db = SessionLocal()
        try:
            if db.query(Location).filter(Location.name == name).first():
                return json.dumps({"success": False, "message": "Bu lokasyon zaten var"})
            loc = Location(name=name, description=description)
            db.add(loc)
            db.commit()
            return json.dumps({"success": True, "message": "Lokasyon eklendi", "id": loc.id})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, result=str)
    def delete_location(self, id_str):
        from models.location import Location
        from models.stock import Stock
        from models.stock_movement import StockMovement
        from sqlalchemy import or_
        db = SessionLocal()
        try:
            loc_id = int(id_str)
            loc = db.query(Location).filter(Location.id == loc_id).first()
            if loc:
                if loc.kind:
                    return json.dumps({"success": False, "message": "Bu depo sistem tarafından otomatik yönetiliyor, silinemez."})
                
                stock_count = db.query(Stock).filter(Stock.location_id == loc_id, Stock.quantity > 0).count()
                if stock_count > 0:
                    return json.dumps({"success": False, "message": "Bu depoda stoklu ürünler var, silinemez."})
                
                movement_count = db.query(StockMovement).filter(or_(StockMovement.source_location_id == loc_id, StockMovement.target_location_id == loc_id)).count()
                if movement_count > 0:
                    return json.dumps({"success": False, "message": "Bu deponun geçmiş stok hareketi var, silinemez."})

                db.delete(loc)
                db.commit()
                return json.dumps({"success": True})
            return json.dumps({"success": False, "message": "Bulunamadı"})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    # ===================    # DEPARTMANLAR MODÜLÜ
    # ==========================

    @Slot(result=str)
    def get_departments(self):
        """Tüm departmanları varsayılan lokasyon adıyla birlikte getirir."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            rows = db.execute(text("""
                SELECT d.id, d.name, d.code, d.responsible, d.default_location_id, d.status, l.name AS location_name
                FROM warehouse.departments d
                LEFT JOIN warehouse.locations l ON l.id = d.default_location_id
                ORDER BY d.id
            """)).mappings().all()
            departments = []
            for row in rows:
                departments.append({
                    "id": str(row["id"]),
                    "name": row["name"] or "",
                    "code": row["code"] or "",
                    "responsible": row["responsible"] or "",
                    "default_location_id": str(row["default_location_id"]) if row["default_location_id"] else "",
                    "default_location_name": row["location_name"] or "",
                    "status": row["status"] or "Aktif"
                })
            return json.dumps({"success": True, "departments": departments})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    # --- PARÇA KATEGORİSİ MODÜLÜ ---
    @Slot(result=str)
    def get_part_categories(self):
        """Tüm Parça Kategorilerini, varsayılan lokasyon adıyla birlikte getirir."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            rows = db.execute(text("""
                SELECT pc.id, pc.name, '' AS part_type, pc.departments, pc.stock_tracking_type,
                       NULL AS default_location_id, '' AS default_location_name,
                       pc.is_active, pc.description
                FROM warehouse.part_categories pc
                ORDER BY pc.id ASC
            """)).mappings().all()
            categories = []
            for r in rows:
                categories.append({
                    "id": r["id"],
                    "name": r["name"],
                    "part_type": r["part_type"] or "",
                    "departments": r["departments"] or "",
                    "stock_tracking_type": r["stock_tracking_type"] or "Stok Takipli",
                    "default_location_id": str(r["default_location_id"]) if r["default_location_id"] else "",
                    "default_location_name": r["default_location_name"] or "",
                    "is_active": r["is_active"] if r["is_active"] is not None else True,
                    "description": r["description"] or ""
                })
            return json.dumps({"success": True, "categories": categories})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, str, str, result=str)
    def create_department(self, name, code, responsible, default_location_id, status):
        """Yeni departman ekler."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            dept_name = name.strip()
            if not dept_name:
                return json.dumps({"success": False, "message": "Departman adı zorunludur"})

            loc_id = int(default_location_id) if default_location_id.strip() else None
            db.execute(text("""
                INSERT INTO warehouse.departments (name, code, responsible, default_location_id, status)
                VALUES (:name, :code, :resp, :loc, :status)
            """), {
                "name": dept_name, "code": code or None, "resp": responsible or None,
                "loc": loc_id, "status": status or "Aktif"
            })
            db.commit()
            return json.dumps({"success": True, "message": "Departman eklendi"})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Kayıt hatası: {str(e)}"})
        finally:
            db.close()

    @Slot(str, str, str, str, str, str, result=str)
    def update_department(self, dept_id_str, name, code, responsible, default_location_id, status):
        """Var olan bir departmanı günceller."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            dept_id = int(dept_id_str)
            dept_name = name.strip()
            if not dept_name:
                return json.dumps({"success": False, "message": "Departman adı zorunludur"})

            loc_id = int(default_location_id) if default_location_id.strip() else None
            db.execute(text("""
                UPDATE warehouse.departments
                SET name = :name, code = :code, responsible = :resp,
                    default_location_id = :loc, status = :status
                WHERE id = :id
            """), {
                "name": dept_name, "code": code or None, "resp": responsible or None,
                "loc": loc_id, "status": status or "Aktif", "id": dept_id
            })
            db.commit()
            return json.dumps({"success": True, "message": "Departman güncellendi"})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Güncelleme hatası: {str(e)}"})
        finally:
            db.close()

    @Slot(str, str, str, str, str, str, result=str)
    def create_part_category(self, name, part_type, departments, stock_tracking_type, default_location_id, description):
        """Yeni Parça Kategorisi ekler."""
        from models.part_category import PartCategory
        db = SessionLocal()
        try:
            name = (name or "").strip()
            if not name:
                return json.dumps({"success": False, "message": "Kategori adı zorunludur"})
            if db.query(PartCategory).filter(PartCategory.name == name).first():
                return json.dumps({"success": False, "message": "Bu kategori zaten var"})
            cat = PartCategory(
                name=name,
                departments=departments or None,
                stock_tracking_type=stock_tracking_type or "Stok Takipli",
                is_active=True,
                description=description or None
            )
            db.add(cat)
            db.commit()
            return json.dumps({"success": True, "message": "Kategori eklendi", "id": cat.id})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, str, str, str, str, str, result=str)
    def update_part_category(self, id_str, name, part_type, departments, stock_tracking_type, default_location_id, is_active, description):
        """Var olan bir Parça Kategorisini günceller."""
        from models.part_category import PartCategory
        db = SessionLocal()
        try:
            cat_id = int(id_str)
            name = (name or "").strip()
            if not name:
                return json.dumps({"success": False, "message": "Kategori adı zorunludur"})
            cat = db.query(PartCategory).filter(PartCategory.id == cat_id).first()
            if not cat:
                return json.dumps({"success": False, "message": "Kategori bulunamadı"})
            if db.query(PartCategory).filter(PartCategory.name == name, PartCategory.id != cat_id).first():
                return json.dumps({"success": False, "message": "Bu isimde başka bir kategori zaten var"})
            cat.name = name
            cat.departments = departments or None
            cat.stock_tracking_type = stock_tracking_type or "Stok Takipli"
            cat.is_active = (is_active == "true" or is_active == "1" or is_active == "True")
            cat.description = description or None
            db.commit()
            return json.dumps({"success": True, "message": "Kategori güncellendi"})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, result=str)
    def delete_department(self, dept_id_str):
        """Belirtilen id'ye sahip departmanı siler."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            dept_id = int(dept_id_str)
            db.execute(text("DELETE FROM warehouse.departments WHERE id = :id"), {"id": dept_id})
            db.commit()
            return json.dumps({"success": True, "message": "Departman silindi"})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Silme hatası: {str(e)}"})
        finally:
            db.close()

    @Slot(str, result=str)
    def delete_part_category(self, id_str):
        from sqlalchemy import text
        from models.part_category import PartCategory
        db = SessionLocal()
        try:
            cat_id = int(id_str)
            cat = db.query(PartCategory).filter(PartCategory.id == cat_id).first()
            if not cat:
                return json.dumps({"success": False, "message": "Bulunamadı"})
            linked = db.execute(text("SELECT COUNT(*) FROM warehouse.parts WHERE part_category_id = :id"), {"id": cat_id}).scalar()
            if linked:
                return json.dumps({"success": False, "message": f"Bu kategoriye bağlı {linked} parça var, önce onları başka kategoriye taşıyın."})
            db.delete(cat)
            db.commit()
            return json.dumps({"success": True})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    # ==========================
    # SERVİS KAYITLARI MODÜLÜ
    # ==========================

    @Slot(result=str)
    def get_service_records(self):
        """Tüm servis kayıtlarını getirir."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            rows = db.execute(text("""
                SELECT id, customer_name, customer_phone, customer_email, company,
                       brand, model, memory, product_code, color, fault_category, fault_type,
                       customer_complaint, preliminary_diagnosis, status, technician_note, created_at
                FROM warehouse.service_records
                ORDER BY id DESC
                LIMIT 200
            """)).mappings().all()
            records = []
            for row in rows:
                records.append({
                    "id": str(row["id"]),
                    "customer_name": row["customer_name"] or "",
                    "customer_phone": row["customer_phone"] or "",
                    "customer_email": row["customer_email"] or "",
                    "company": row["company"] or "",
                    "brand": row["brand"] or "",
                    "model": row["model"] or "",
                    "memory": row["memory"] or "",
                    "product_code": row["product_code"] or "",
                    "color": row["color"] or "",
                    "fault_category": row["fault_category"] or "",
                    "fault_type": row["fault_type"] or "",
                    "customer_complaint": row["customer_complaint"] or "",
                    "preliminary_diagnosis": row["preliminary_diagnosis"] or "",
                    "status": row["status"] or "Arıza Kabul",
                    "technician_note": row["technician_note"] or "",
                    "created_at": row["created_at"].strftime("%Y-%m-%d %H:%M") if row["created_at"] else ""
                })
            return json.dumps({"success": True, "records": records})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, str, str, str, str, str, str, str, str, str, str, str, str, result=str)
    def create_service_record(self, customer_name, customer_phone, customer_email, company,
                               brand, model, memory, product_code, color, fault_category, fault_type,
                               customer_complaint, preliminary_diagnosis, status, technician_note):
        """Yeni servis kaydı ekler."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            name = customer_name.strip()
            if not name:
                return json.dumps({"success": False, "message": "Müşteri adı zorunludur"})

            db.execute(text("""
                INSERT INTO warehouse.service_records (
                    customer_name, customer_phone, customer_email, company,
                    brand, model, memory, product_code, color, fault_category, fault_type,
                    customer_complaint, preliminary_diagnosis, status, technician_note
                ) VALUES (
                    :name, :phone, :email, :company,
                    :brand, :model, :memory, :code, :color, :fcat, :ftype,
                    :complaint, :diagnosis, :status, :note
                )
            """), {
                "name": name, "phone": customer_phone or None, "email": customer_email or None,
                "company": company or None, "brand": brand or None, "model": model or None,
                "memory": memory or None, "code": product_code or None, "color": color or None,
                "fcat": fault_category or None, "ftype": fault_type or None,
                "complaint": customer_complaint or None, "diagnosis": preliminary_diagnosis or None,
                "status": status or "Arıza Kabul", "note": technician_note or None
            })
            db.commit()
            return json.dumps({"success": True, "message": "Servis kaydı eklendi"})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Kayıt hatası: {str(e)}"})
        finally:
            db.close()

    @Slot(str, str, str, str, str, str, str, str, str, str, str, str, str, str, str, str, result=str)
    def update_service_record(self, record_id_str, customer_name, customer_phone, customer_email, company,
                               brand, model, memory, product_code, color, fault_category, fault_type,
                               customer_complaint, preliminary_diagnosis, status, technician_note):
        """Var olan bir servis kaydını günceller."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            record_id = int(record_id_str)
            name = customer_name.strip()
            if not name:
                return json.dumps({"success": False, "message": "Müşteri adı zorunludur"})

            db.execute(text("""
                UPDATE warehouse.service_records
                SET customer_name = :name, customer_phone = :phone, customer_email = :email, company = :company,
                    brand = :brand, model = :model, memory = :memory, product_code = :code, color = :color,
                    fault_category = :fcat, fault_type = :ftype,
                    customer_complaint = :complaint, preliminary_diagnosis = :diagnosis,
                    status = :status, technician_note = :note
                WHERE id = :id
            """), {
                "name": name, "phone": customer_phone or None, "email": customer_email or None,
                "company": company or None, "brand": brand or None, "model": model or None,
                "memory": memory or None, "code": product_code or None, "color": color or None,
                "fcat": fault_category or None, "ftype": fault_type or None,
                "complaint": customer_complaint or None, "diagnosis": preliminary_diagnosis or None,
                "status": status or "Arıza Kabul", "note": technician_note or None,
                "id": record_id
            })
            db.commit()
            return json.dumps({"success": True, "message": "Servis kaydı güncellendi"})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Güncelleme hatası: {str(e)}"})
        finally:
            db.close()

    @Slot(str, result=str)
    def delete_service_record(self, record_id_str):
        """Belirtilen id'ye sahip servis kaydını siler."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            record_id = int(record_id_str)
            db.execute(text("DELETE FROM warehouse.service_records WHERE id = :id"), {"id": record_id})
            db.commit()
            return json.dumps({"success": True, "message": "Servis kaydı silindi"})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Silme hatası: {str(e)}"})
        finally:
            db.close()

    # ==========================
    # İŞ EMİRLERİ MODÜLÜ
    # ==========================

    @Slot(result=str)
    def get_work_orders(self):
        """Tüm iş emirlerini, bağlı olduğu servis kaydı bilgileriyle birlikte getirir."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            rows = db.execute(text("""
                SELECT w.id, w.service_record_id, w.description, w.assigned_technician, w.priority,
                       w.start_date, w.end_date, w.parts_used, w.status, w.created_at,
                       w.source_location_id, w.stock_settled_at,
                       w.work_order_type, w.target_part_id, w.planned_quantity,
                       w.started_at, w.completed_at, w.produced_quantity, w.scrap_quantity, w.production_notes,
                       s.customer_name, s.brand, s.model, s.fault_category, s.fault_type,
                       tp.item_code AS target_part_code, tp.name AS target_part_name
                FROM warehouse.work_orders w
                LEFT JOIN warehouse.service_records s ON s.id = w.service_record_id
                LEFT JOIN warehouse.parts tp ON tp.id = w.target_part_id
                ORDER BY w.id DESC
                LIMIT 200
            """)).mappings().all()
            orders = []
            for row in rows:
                orders.append({
                    "id": str(row["id"]),
                    "work_order_type": row["work_order_type"] or WORK_ORDER_TYPE_SERVICE,
                    "service_record_id": str(row["service_record_id"]) if row["service_record_id"] else "",
                    "customer_name": row["customer_name"] or "",
                    "brand": row["brand"] or "",
                    "model": row["model"] or "",
                    "fault_category": row["fault_category"] or "",
                    "fault_type": row["fault_type"] or "",
                    "target_part_id": str(row["target_part_id"]) if row["target_part_id"] else "",
                    "target_part_code": row["target_part_code"] or "",
                    "target_part_name": row["target_part_name"] or "",
                    "planned_quantity": row["planned_quantity"] if row["planned_quantity"] is not None else "",
                    "started_at": row["started_at"].strftime("%Y-%m-%d %H:%M") if row["started_at"] else "",
                    "completed_at": row["completed_at"].strftime("%Y-%m-%d %H:%M") if row["completed_at"] else "",
                    "produced_quantity": row["produced_quantity"] if row["produced_quantity"] is not None else "",
                    "scrap_quantity": row["scrap_quantity"] if row["scrap_quantity"] is not None else "",
                    "production_notes": row["production_notes"] or "",
                    "description": row["description"] or "",
                    "assigned_technician": row["assigned_technician"] or "",
                    "priority": row["priority"] or "Orta",
                    "start_date": row["start_date"].strftime("%Y-%m-%d") if row["start_date"] else "",
                    "end_date": row["end_date"].strftime("%Y-%m-%d") if row["end_date"] else "",
                    "parts_used": row["parts_used"] or "[]",
                    "status": row["status"] or "Beklemede",
                    "source_location_id": str(row["source_location_id"]) if row["source_location_id"] else "",
                    "stock_settled_at": row["stock_settled_at"].strftime("%Y-%m-%d %H:%M") if row["stock_settled_at"] else "",
                    "created_at": row["created_at"].strftime("%Y-%m-%d %H:%M") if row["created_at"] else ""
                })
            return json.dumps({"success": True, "work_orders": orders})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, str, str, str, str, str, str, result=str)
    def create_work_order(self, service_record_id, description, assigned_technician, priority,
                           start_date, end_date, parts_used, status, source_location_id):
        """Yeni iş emri ekler. parts_used doluysa kaynak depodan (Good/DOA Stock) Repair Stock'a
        otomatik transfer yapar; stok yetersizse iş emri hiç oluşturulmaz."""
        from sqlalchemy import text
        from models.stock import Stock
        from models.stock_movement import StockMovement
        db = SessionLocal()
        try:
            lines = []
            if parts_used and parts_used.strip():
                try:
                    lines = [l for l in json.loads(parts_used) if l.get("part_id") and int(l.get("quantity") or 0) > 0]
                except (ValueError, TypeError):
                    lines = []

            src_loc_id = int(source_location_id) if source_location_id and source_location_id.strip() else None

            if lines:
                if not src_loc_id:
                    return json.dumps({"success": False, "message": "Parça kullanılan bir iş emri için kaynak depo seçmelisiniz."})
                repair_stock_id = _get_system_location_id(db, "repair_stock")
                if not repair_stock_id:
                    return json.dumps({"success": False, "message": "Repair Stock deposu bulunamadı."})

                agg = {}
                for line in lines:
                    pid = int(line["part_id"])
                    agg[pid] = agg.get(pid, 0) + int(line["quantity"])

                for part_id, qty in agg.items():
                    stock = db.query(Stock).filter(Stock.part_id == part_id, Stock.location_id == src_loc_id).first()
                    if not stock or stock.quantity < qty:
                        return json.dumps({"success": False, "message": f"Parça #{part_id} için seçilen depoda yeterli stok yok."})

                for part_id, qty in agg.items():
                    stock = db.query(Stock).filter(Stock.part_id == part_id, Stock.location_id == src_loc_id).first()
                    stock.quantity -= qty
                    target_stock = db.query(Stock).filter(Stock.part_id == part_id, Stock.location_id == repair_stock_id).first()
                    if target_stock:
                        target_stock.quantity += qty
                    else:
                        db.add(Stock(part_id=part_id, location_id=repair_stock_id, quantity=qty))
                    db.add(StockMovement(
                        type="İş Emri: Tamire Alındı",
                        movement_kind="Transfer",
                        quantity=qty,
                        part_id=part_id,
                        source_location_id=src_loc_id,
                        target_location_id=repair_stock_id,
                        created_by=assigned_technician or "system"
                    ))

            new_id = db.execute(text("""
                INSERT INTO warehouse.work_orders (
                    service_record_id, description, assigned_technician, priority,
                    start_date, end_date, parts_used, status, source_location_id
                ) VALUES (
                    :sr_id, :desc, :tech, :priority, :start, :end, :parts, :status, :src_loc
                ) RETURNING id
            """), {
                "sr_id": int(service_record_id) if service_record_id.strip() else None,
                "desc": description or None,
                "tech": assigned_technician or None,
                "priority": priority or "Orta",
                "start": start_date or None,
                "end": end_date or None,
                "parts": parts_used or None,
                "status": status or "Beklemede",
                "src_loc": src_loc_id
            }).scalar()
            db.commit()
            return json.dumps({"success": True, "message": "İş emri eklendi", "id": str(new_id)})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Kayıt hatası: {str(e)}"})
        finally:
            db.close()

    @Slot(str, str, str, str, str, str, str, str, str, result=str)
    def update_work_order(self, order_id_str, service_record_id, description, assigned_technician, priority,
                           start_date, end_date, parts_used, status):
        """Var olan bir iş emrini günceller. Durum Tamamlandı/Başarısız/İptal'e geçerse Repair
        Stock'taki parçaları otomatik olarak ilgili depoya taşır (yalnızca bir kez, stock_settled_at guard'ı)."""
        from sqlalchemy import text
        from models.stock import Stock
        from models.stock_movement import StockMovement
        db = SessionLocal()
        try:
            order_id = int(order_id_str)
            current = db.execute(text("""
                SELECT status, parts_used, source_location_id, stock_settled_at
                FROM warehouse.work_orders WHERE id = :id
            """), {"id": order_id}).mappings().first()
            if not current:
                return json.dumps({"success": False, "message": "İş emri bulunamadı."})

            new_status = status or "Beklemede"
            settle_now = False

            if (new_status != current["status"] and current["stock_settled_at"] is None
                    and new_status in ("Tamamlandı", "Başarısız", "İptal")):
                lines = []
                if current["parts_used"]:
                    try:
                        lines = [l for l in json.loads(current["parts_used"]) if l.get("part_id") and int(l.get("quantity") or 0) > 0]
                    except (ValueError, TypeError):
                        lines = []
                src_loc_id = current["source_location_id"]

                if lines and src_loc_id:
                    repair_stock_id = _get_system_location_id(db, "repair_stock")
                    if new_status == "Tamamlandı":
                        target_id = _get_system_location_id(db, "good_stock")
                        movement_kind = "Repair"
                        mov_type = "Tamir Başarılı: Good Stock'a Alındı"
                    elif new_status == "Başarısız":
                        target_id = _get_system_location_id(db, "scrap_stock")
                        movement_kind = "Scrap"
                        mov_type = "Tamir Başarısız: Scrap Stock'a Alındı"
                    else:  # İptal
                        target_id = src_loc_id
                        movement_kind = "Transfer"
                        mov_type = "İş Emri İptal: Depoya İade"

                    if not repair_stock_id or not target_id:
                        return json.dumps({"success": False, "message": "Sistem depoları bulunamadı."})

                    agg = {}
                    for line in lines:
                        pid = int(line["part_id"])
                        agg[pid] = agg.get(pid, 0) + int(line["quantity"])

                    for part_id, qty in agg.items():
                        repair_stock = db.query(Stock).filter(Stock.part_id == part_id, Stock.location_id == repair_stock_id).first()
                        if not repair_stock or repair_stock.quantity < qty:
                            return json.dumps({"success": False, "message": f"Repair Stock'ta parça #{part_id} için yeterli miktar yok."})

                    for part_id, qty in agg.items():
                        repair_stock = db.query(Stock).filter(Stock.part_id == part_id, Stock.location_id == repair_stock_id).first()
                        repair_stock.quantity -= qty
                        target_stock = db.query(Stock).filter(Stock.part_id == part_id, Stock.location_id == target_id).first()
                        if target_stock:
                            target_stock.quantity += qty
                        else:
                            db.add(Stock(part_id=part_id, location_id=target_id, quantity=qty))
                        db.add(StockMovement(
                            type=mov_type,
                            movement_kind=movement_kind,
                            quantity=qty,
                            part_id=part_id,
                            source_location_id=repair_stock_id,
                            target_location_id=target_id,
                            created_by=assigned_technician or "system"
                        ))
                settle_now = True

            settle_clause = ", stock_settled_at = NOW()" if settle_now else ""
            db.execute(text(f"""
                UPDATE warehouse.work_orders
                SET service_record_id = :sr_id, description = :desc, assigned_technician = :tech,
                    priority = :priority, start_date = :start, end_date = :end,
                    parts_used = :parts, status = :status{settle_clause}
                WHERE id = :id
            """), {
                "sr_id": int(service_record_id) if service_record_id.strip() else None,
                "desc": description or None,
                "tech": assigned_technician or None,
                "priority": priority or "Orta",
                "start": start_date or None,
                "end": end_date or None,
                "parts": parts_used or None,
                "status": new_status,
                "id": order_id
            })
            db.commit()
            return json.dumps({"success": True, "message": "İş emri güncellendi"})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Güncelleme hatası: {str(e)}"})
        finally:
            db.close()

    @Slot(str, result=str)
    def delete_work_order(self, order_id_str):
        """Belirtilen id'ye sahip iş emrini siler."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            order_id = int(order_id_str)
            delivered_count = db.execute(text("""
                SELECT COUNT(*) FROM warehouse.work_order_parts
                WHERE work_order_id = :id AND status = 'Teslim Edildi'
            """), {"id": order_id}).scalar()
            if delivered_count:
                return json.dumps({"success": False, "message": "Teslim edilmiş parçaları olan bir iş emri silinemez. Önce parça teslimatlarını geri alın."})
            db.execute(text("DELETE FROM warehouse.work_orders WHERE id = :id"), {"id": order_id})
            db.commit()
            return json.dumps({"success": True, "message": "İş emri silindi"})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Silme hatası: {str(e)}"})
        finally:
            db.close()

    # ==========================
    # PRODUCTION WORK ORDER (Yarı Mamul Üretim İş Emri)
    # Service Work Order akışıyla aynı work_orders tablosunu paylaşır; work_order_type
    # sütunu üzerinden ayrışır. Service Record'a bağlı değildir; bunun yerine
    # target_part_id ile bir Recipe'ye (warehouse.item_bom) bağlanır. Bu aşamada
    # malzeme talebi (Material Request) veya stok hareketi oluşturulmaz.
    # ==========================

    @Slot(str, str, str, str, str, result=str)
    def create_production_work_order(self, target_part_id, description, priority, planned_quantity, assigned_technician):
        """PRODUCTION tipinde yeni bir iş emri oluşturur. target_part_id, üretilecek yarı
        mamulün parça id'sidir; bu parçanın item_code'una karşılık gelen bir Recipe
        (warehouse.item_bom kaydı) bulunmalıdır. Service Record gerekmez. Recipe'deki her
        BOM satırı için bir Material Request kaydı (WAITING durumunda) oluşturulur. Durum
        BEKLIYOR ile başlar (bkz. start_production_work_order/complete_production_work_order).
        Bu aşamada stok düşme, depo transferi veya üretim tamamlama yapılmaz."""
        from sqlalchemy import text
        from models.part import Part
        db = SessionLocal()
        try:
            if not target_part_id or not target_part_id.strip():
                return json.dumps({"success": False, "message": "Üretilecek parça (Recipe) seçmelisiniz."})

            part_id = int(target_part_id)
            part = db.query(Part).filter(Part.id == part_id).first()
            if not part:
                return json.dumps({"success": False, "message": "Parça bulunamadı."})

            bom_rows = db.execute(text("""
                SELECT b.child_item_id, b.quantity, cp.id AS child_part_id
                FROM warehouse.item_bom b
                LEFT JOIN warehouse.parts cp ON cp.item_code = b.child_item_id
                WHERE b.parent_item_id = :code
            """), {"code": part.item_code}).mappings().all()
            if not bom_rows:
                return json.dumps({"success": False, "message": "Bu parça için tanımlı bir Recipe (ItemBOM) bulunamadı."})

            qty = int(planned_quantity) if planned_quantity and planned_quantity.strip() else None
            multiplier = qty if qty else 1

            new_id = db.execute(text("""
                INSERT INTO warehouse.work_orders (
                    work_order_type, target_part_id, description, priority, planned_quantity,
                    assigned_technician, status
                ) VALUES (
                    :wtype, :target, :desc, :priority, :qty, :tech, :status
                ) RETURNING id
            """), {
                "wtype": WORK_ORDER_TYPE_PRODUCTION,
                "target": part_id,
                "desc": description or None,
                "priority": priority or "Orta",
                "qty": qty,
                "tech": assigned_technician or None,
                "status": PRODUCTION_WO_STATUS_WAITING
            }).scalar()

            for bom_row in bom_rows:
                if not bom_row["child_part_id"]:
                    print(f"[WebBridge] Material Request atlandı, parça bulunamadı: {bom_row['child_item_id']}")
                    continue
                required_qty = int(bom_row["quantity"]) * multiplier
                db.execute(text("""
                    INSERT INTO warehouse.material_requests (work_order_id, part_id, required_quantity, issued_quantity, status)
                    VALUES (:wid, :pid, :req, 0, :status)
                """), {
                    "wid": new_id,
                    "pid": bom_row["child_part_id"],
                    "req": required_qty,
                    "status": MATERIAL_REQUEST_STATUS_WAITING
                })

            db.commit()
            return json.dumps({"success": True, "message": "Üretim iş emri eklendi", "id": str(new_id)})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Kayıt hatası: {str(e)}"})
        finally:
            db.close()

    # ==========================
    # PRODUCTION WORK ORDER YAŞAM DÖNGÜSÜ (BEKLIYOR -> URETIMDE -> TAMAMLANDI)
    # Sadece PRODUCTION tipi work order'lar için çalışır; Service Work Order'ın kendi
    # status akışını (create_work_order/update_work_order) hiç etkilemez. Bu aşamada
    # stok düşme, depo transferi, yarı mamul stok oluşturma veya Scrap Stock hareketi
    # yapılmaz — sadece iş emrinin üretim verileri kaydedilir.
    # ==========================

    @Slot(str, str, result=str)
    def start_production_work_order(self, work_order_id_str, username):
        """PRODUCTION tipi bir iş emrini BEKLIYOR durumundan URETIMDE durumuna geçirir ve
        started_at zaman damgasını kaydeder. Stok/depo işlemi yapmaz."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            work_order_id = int(work_order_id_str)
            row = db.execute(
                text("SELECT id, work_order_type, status FROM warehouse.work_orders WHERE id = :id FOR UPDATE"),
                {"id": work_order_id}
            ).mappings().first()
            if not row:
                return json.dumps({"success": False, "message": "İş emri bulunamadı."})
            if row["work_order_type"] != WORK_ORDER_TYPE_PRODUCTION:
                return json.dumps({"success": False, "message": "Bu işlem sadece Production Work Order'lar için geçerlidir."})
            if row["status"] != PRODUCTION_WO_STATUS_WAITING:
                return json.dumps({"success": False, "message": f"Sadece {PRODUCTION_WO_STATUS_WAITING} durumundaki iş emirleri üretime alınabilir."})

            db.execute(text("""
                UPDATE warehouse.work_orders
                SET status = :status, started_at = CURRENT_TIMESTAMP
                WHERE id = :id
            """), {"status": PRODUCTION_WO_STATUS_IN_PRODUCTION, "id": work_order_id})
            db.commit()
            return json.dumps({"success": True, "message": "Üretim başlatıldı", "status": PRODUCTION_WO_STATUS_IN_PRODUCTION})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"İşlem hatası: {str(e)}"})
        finally:
            db.close()

    @Slot(str, str, str, str, str, result=str)
    def complete_production_work_order(self, work_order_id_str, produced_quantity_str, scrap_quantity_str, production_notes, username):
        """PRODUCTION tipi bir iş emrini URETIMDE durumundan TAMAMLANDI durumuna geçirir.
        Üretilen Adet + Fire Adedi, Planlanan Üretim'e eşit olmak zorundadır; değilse
        işlem reddedilir ve hiçbir kayıt değişmez. Stok düşme, depo transferi, yarı mamul
        stok oluşturma veya Scrap Stock hareketi yapmaz — bunlar sonraki aşamada eklenecek."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            work_order_id = int(work_order_id_str)
            try:
                produced_quantity = int(produced_quantity_str)
            except (ValueError, TypeError):
                return json.dumps({"success": False, "message": "Üretilen Adet geçerli bir sayı olmalıdır."})
            try:
                scrap_quantity = int(scrap_quantity_str)
            except (ValueError, TypeError):
                return json.dumps({"success": False, "message": "Fire Adedi geçerli bir sayı olmalıdır."})

            if produced_quantity < 0 or scrap_quantity < 0:
                return json.dumps({"success": False, "message": "Üretilen Adet ve Fire Adedi negatif olamaz."})

            row = db.execute(
                text("""SELECT id, work_order_type, status, planned_quantity
                        FROM warehouse.work_orders WHERE id = :id FOR UPDATE"""),
                {"id": work_order_id}
            ).mappings().first()
            if not row:
                return json.dumps({"success": False, "message": "İş emri bulunamadı."})
            if row["work_order_type"] != WORK_ORDER_TYPE_PRODUCTION:
                return json.dumps({"success": False, "message": "Bu işlem sadece Production Work Order'lar için geçerlidir."})
            if row["status"] != PRODUCTION_WO_STATUS_IN_PRODUCTION:
                return json.dumps({"success": False, "message": f"Sadece {PRODUCTION_WO_STATUS_IN_PRODUCTION} durumundaki iş emirleri tamamlanabilir."})
            if row["planned_quantity"] is None:
                return json.dumps({"success": False, "message": "Bu iş emrinde Planlanan Üretim Adedi tanımlı değil, tamamlanamaz."})

            planned_quantity = row["planned_quantity"]
            if produced_quantity + scrap_quantity != planned_quantity:
                return json.dumps({
                    "success": False,
                    "message": f"Üretilen Adet ({produced_quantity}) + Fire Adedi ({scrap_quantity}) = {produced_quantity + scrap_quantity}, "
                                f"Planlanan Üretim'e ({planned_quantity}) eşit olmalıdır."
                })

            db.execute(text("""
                UPDATE warehouse.work_orders
                SET status = :status, completed_at = CURRENT_TIMESTAMP,
                    produced_quantity = :produced, scrap_quantity = :scrap, production_notes = :notes
                WHERE id = :id
            """), {
                "status": PRODUCTION_WO_STATUS_COMPLETED,
                "produced": produced_quantity,
                "scrap": scrap_quantity,
                "notes": production_notes or None,
                "id": work_order_id
            })
            db.commit()
            return json.dumps({"success": True, "message": "Üretim tamamlandı", "status": PRODUCTION_WO_STATUS_COMPLETED})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"İşlem hatası: {str(e)}"})
        finally:
            db.close()

    @Slot(str, result=str)
    def get_material_requests(self, work_order_id_str):
        """Bir Production Work Order'a bağlı Material Request kayıtlarını, parça
        bilgileriyle birlikte getirir. Salt okunurdur; stok düşme/depo transferi bu
        aşamada yapılmaz. remaining_quantity, required_quantity - issued_quantity olarak
        canlı hesaplanır."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            work_order_id = int(work_order_id_str)
            rows = db.execute(text("""
                SELECT mr.id, mr.work_order_id, mr.part_id,
                       mr.required_quantity, mr.issued_quantity,
                       (mr.required_quantity - mr.issued_quantity) AS remaining_quantity,
                       mr.status, mr.created_at,
                       p.item_code, p.name AS part_name_raw, p.brand, p.model, p.color, p.part_category
                FROM warehouse.material_requests mr
                LEFT JOIN warehouse.parts p ON p.id = mr.part_id
                WHERE mr.work_order_id = :wid
                ORDER BY mr.id ASC
            """), {"wid": work_order_id}).mappings().all()

            requests = []
            for row in rows:
                part_name = " ".join(filter(None, [row["brand"], row["model"], row["color"], row["part_category"]])) or (row["part_name_raw"] or "")
                requests.append({
                    "id": str(row["id"]),
                    "work_order_id": str(row["work_order_id"]),
                    "part_id": str(row["part_id"]),
                    "part_name": part_name,
                    "item_code": row["item_code"] or "",
                    "required_quantity": row["required_quantity"],
                    "issued_quantity": row["issued_quantity"],
                    "remaining_quantity": row["remaining_quantity"],
                    "status": row["status"] or MATERIAL_REQUEST_STATUS_WAITING,
                    "created_at": row["created_at"].strftime("%Y-%m-%d %H:%M") if row["created_at"] else ""
                })
            return json.dumps({"success": True, "material_requests": requests})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, result=str)
    def issue_material_request(self, mr_id_str, quantity_str, username):
        """Bir Material Request satırının bir kısmını veya tamamını Good Stock'tan teslim
        eder (Malzeme Teslim / Material Issue). Kısmi teslimi destekler: WAITING ->
        PARTIAL -> ISSUED, issued_quantity/required_quantity oranına göre otomatik
        hesaplanır. Stok yetersizse işlem iptal edilir, hiçbir kayıt değişmez. Başarılı
        teslimde bir StockMovement kaydı açılır. Sadece PRODUCTION tipi Work Order'lara
        aittir; Service Work Order akışını hiçbir şekilde etkilemez. Üretim tamamlama,
        fire hesaplama, yarı mamul oluşturma bu aşamada yapılmaz."""
        from sqlalchemy import text
        from models.stock import Stock
        from models.stock_movement import StockMovement
        db = SessionLocal()
        try:
            mr_id = int(mr_id_str)
            try:
                quantity = int(quantity_str)
            except (ValueError, TypeError):
                quantity = 0
            if quantity <= 0:
                return json.dumps({"success": False, "message": "Teslim miktarı 0'dan büyük olmalıdır."})

            row = db.execute(
                text("""SELECT id, work_order_id, part_id, required_quantity, issued_quantity, status
                        FROM warehouse.material_requests WHERE id = :id FOR UPDATE"""),
                {"id": mr_id}
            ).mappings().first()
            if not row:
                return json.dumps({"success": False, "message": "Malzeme talebi bulunamadı."})

            wo_type = db.execute(
                text("SELECT work_order_type FROM warehouse.work_orders WHERE id = :id"),
                {"id": row["work_order_id"]}
            ).scalar()
            if wo_type != WORK_ORDER_TYPE_PRODUCTION:
                return json.dumps({"success": False, "message": "Malzeme teslimi sadece Production Work Order'lar için yapılabilir."})

            remaining = row["required_quantity"] - row["issued_quantity"]
            if quantity > remaining:
                return json.dumps({"success": False, "message": f"Kalan miktardan ({remaining}) fazla teslim edilemez."})

            good_stock_id = _get_system_location_id(db, "good_stock")
            if not good_stock_id:
                return json.dumps({"success": False, "message": "Good Stock deposu bulunamadı."})

            stock = db.query(Stock).filter(Stock.part_id == row["part_id"], Stock.location_id == good_stock_id).first()
            available = stock.quantity if stock else 0
            if available < quantity:
                return json.dumps({"success": False, "message": f"Good Stock'ta yeterli stok yok. Mevcut: {available}, İstenen: {quantity}."})

            stock.quantity -= quantity
            db.add(StockMovement(
                type="Üretim İçin Malzeme Teslimi",
                movement_kind="Transfer",
                quantity=quantity,
                part_id=row["part_id"],
                source_location_id=good_stock_id,
                created_by=username or None,
                technician=username or None,
                description=f"Production Work Order #{row['work_order_id']} - Material Request #{mr_id} teslimi"
            ))

            new_issued = row["issued_quantity"] + quantity
            new_status = _compute_material_request_status(new_issued, row["required_quantity"])

            db.execute(text("""
                UPDATE warehouse.material_requests
                SET issued_quantity = :issued, status = :status
                WHERE id = :id
            """), {"issued": new_issued, "status": new_status, "id": mr_id})

            db.commit()
            return json.dumps({
                "success": True,
                "message": "Malzeme teslim edildi",
                "issued_quantity": new_issued,
                "remaining_quantity": row["required_quantity"] - new_issued,
                "status": new_status
            })
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Teslim hatası: {str(e)}"})
        finally:
            db.close()

    # ==========================
    # PARÇA TEDARİK DURUMU (İş Emri Parça Satırları / Stok Teslim-Bekleme-Geri Alma)
    # ==========================

    @Slot(str, result=str)
    def get_work_order_parts(self, work_order_id_str):
        """Bir iş emrine ait parça satırlarını, parça/lokasyon bilgileriyle birlikte getirir."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            work_order_id = int(work_order_id_str)
            rows = db.execute(text("""
                SELECT wop.id, wop.work_order_id, wop.part_id, wop.quantity, wop.status,
                       wop.delivered_location_id, wop.delivery_movement_id, wop.delivered_by, wop.delivered_at,
                       wop.waiting_notes, wop.marked_waiting_by, wop.marked_waiting_at,
                       wop.reversal_movement_id, wop.reverted_by, wop.reverted_at,
                       wop.requested_by, wop.created_at,
                       p.brand, p.model, p.color, p.part_category, p.item_code, p.name AS part_name_raw,
                       dl.name AS delivered_location_name
                FROM warehouse.work_order_parts wop
                LEFT JOIN warehouse.parts p ON p.id = wop.part_id
                LEFT JOIN warehouse.locations dl ON dl.id = wop.delivered_location_id
                WHERE wop.work_order_id = :wid
                ORDER BY wop.id ASC
            """), {"wid": work_order_id}).mappings().all()

            parts = []
            for row in rows:
                part_name = " ".join(filter(None, [row["brand"], row["model"], row["color"], row["part_category"]])) or (row["part_name_raw"] or "")
                parts.append({
                    "id": str(row["id"]),
                    "work_order_id": str(row["work_order_id"]),
                    "part_id": str(row["part_id"]),
                    "part_name": part_name,
                    "item_code": row["item_code"] or "",
                    "quantity": row["quantity"],
                    "status": row["status"] or "Stokta Var",
                    "delivered_location_id": str(row["delivered_location_id"]) if row["delivered_location_id"] else "",
                    "delivered_location_name": row["delivered_location_name"] or "",
                    "delivery_movement_id": str(row["delivery_movement_id"]) if row["delivery_movement_id"] else "",
                    "delivered_by": row["delivered_by"] or "",
                    "delivered_at": row["delivered_at"].strftime("%Y-%m-%d %H:%M") if row["delivered_at"] else "",
                    "waiting_notes": row["waiting_notes"] or "",
                    "marked_waiting_by": row["marked_waiting_by"] or "",
                    "marked_waiting_at": row["marked_waiting_at"].strftime("%Y-%m-%d %H:%M") if row["marked_waiting_at"] else "",
                    "reverted_by": row["reverted_by"] or "",
                    "reverted_at": row["reverted_at"].strftime("%Y-%m-%d %H:%M") if row["reverted_at"] else "",
                    "requested_by": row["requested_by"] or "",
                    "created_at": row["created_at"].strftime("%Y-%m-%d %H:%M") if row["created_at"] else ""
                })
            return json.dumps({"success": True, "parts": parts})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, result=str)
    def add_work_order_parts_bulk(self, work_order_id_str, rows_json, username):
        """Yeni oluşturulan bir iş emri için taslak parça satırlarını toplu olarak kaydeder."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            work_order_id = int(work_order_id_str)
            try:
                rows = json.loads(rows_json or "[]")
            except (ValueError, TypeError):
                rows = []

            inserted = 0
            for row in rows:
                part_id = row.get("part_id")
                try:
                    qty = int(row.get("quantity") or 0)
                except (ValueError, TypeError):
                    qty = 0
                if not part_id or qty < 1:
                    continue
                db.execute(text("""
                    INSERT INTO warehouse.work_order_parts (work_order_id, part_id, quantity, status, requested_by)
                    VALUES (:wid, :pid, :qty, 'Stokta Var', :req)
                """), {"wid": work_order_id, "pid": int(part_id), "qty": qty, "req": username or None})
                inserted += 1
            db.commit()
            return json.dumps({"success": True, "inserted": inserted})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, str, result=str)
    def add_work_order_part(self, work_order_id_str, part_id_str, quantity_str, username):
        """Kayıtlı bir iş emrine tek bir parça satırı ekler ve eklenen satırı döner."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            work_order_id = int(work_order_id_str)
            part_id = int(part_id_str)
            qty = int(quantity_str) if quantity_str and int(quantity_str) > 0 else 1

            new_id = db.execute(text("""
                INSERT INTO warehouse.work_order_parts (work_order_id, part_id, quantity, status, requested_by)
                VALUES (:wid, :pid, :qty, 'Stokta Var', :req)
                RETURNING id
            """), {"wid": work_order_id, "pid": part_id, "qty": qty, "req": username or None}).scalar()
            db.commit()

            row = db.execute(text("""
                SELECT wop.id, wop.work_order_id, wop.part_id, wop.quantity, wop.status, wop.created_at,
                       p.brand, p.model, p.color, p.part_category, p.item_code, p.name AS part_name_raw
                FROM warehouse.work_order_parts wop
                LEFT JOIN warehouse.parts p ON p.id = wop.part_id
                WHERE wop.id = :id
            """), {"id": new_id}).mappings().first()

            part_name = " ".join(filter(None, [row["brand"], row["model"], row["color"], row["part_category"]])) or (row["part_name_raw"] or "")
            part = {
                "id": str(row["id"]),
                "work_order_id": str(row["work_order_id"]),
                "part_id": str(row["part_id"]),
                "part_name": part_name,
                "item_code": row["item_code"] or "",
                "quantity": row["quantity"],
                "status": row["status"],
                "delivered_location_id": "", "delivered_location_name": "", "delivery_movement_id": "",
                "delivered_by": "", "delivered_at": "",
                "waiting_notes": "", "marked_waiting_by": "", "marked_waiting_at": "",
                "reverted_by": "", "reverted_at": "",
                "requested_by": username or "",
                "created_at": row["created_at"].strftime("%Y-%m-%d %H:%M") if row["created_at"] else ""
            }
            return json.dumps({"success": True, "part": part})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, result=str)
    def deliver_work_order_part(self, wop_id_str, location_id_str, username):
        """'Depodan Teslim Al': stoktan düşer, StockMovement kaydı açar, satırı 'Teslim Edildi' yapar."""
        from sqlalchemy import text
        from models.stock import Stock
        from models.stock_movement import StockMovement
        db = SessionLocal()
        try:
            wop_id = int(wop_id_str)
            location_id = int(location_id_str)

            row = db.execute(
                text("SELECT id, work_order_id, part_id, quantity, status FROM warehouse.work_order_parts WHERE id = :id FOR UPDATE"),
                {"id": wop_id}
            ).mappings().first()
            if not row:
                return json.dumps({"success": False, "message": "Parça satırı bulunamadı."})
            if row["status"] == "Teslim Edildi":
                return json.dumps({"success": False, "message": "Bu parça zaten teslim edilmiş."})

            qty = row["quantity"]
            stock = db.query(Stock).filter(Stock.part_id == row["part_id"], Stock.location_id == location_id).first()
            if not stock or stock.quantity < qty:
                return json.dumps({"success": False, "message": "Seçilen lokasyonda yeterli stok yok."})

            stock.quantity -= qty
            movement = StockMovement(
                type="Servis Kullanımı",
                quantity=qty,
                part_id=row["part_id"],
                source_location_id=location_id,
                created_by=username or None,
                technician=username or None,
                description=f"İş Emri #{row['work_order_id']} için teslim edildi"
            )
            db.add(movement)
            db.flush()

            db.execute(text("""
                UPDATE warehouse.work_order_parts
                SET status = 'Teslim Edildi', delivered_location_id = :loc, delivery_movement_id = :mov,
                    delivered_by = :user, delivered_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = :id
            """), {"loc": location_id, "mov": movement.id, "user": username or None, "id": wop_id})
            db.commit()
            return json.dumps({"success": True})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, result=str)
    def mark_work_order_part_waiting(self, wop_id_str, notes, username):
        """Sağ tık aksiyonu: parçayı 'Tedarik Bekleniyor' olarak işaretler (stok hareketi yok)."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            wop_id = int(wop_id_str)
            result = db.execute(text("""
                UPDATE warehouse.work_order_parts
                SET status = 'Tedarik Bekleniyor', waiting_notes = :notes,
                    marked_waiting_by = :user, marked_waiting_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = :id AND status != 'Teslim Edildi'
            """), {"notes": notes or None, "user": username or None, "id": wop_id})
            if result.rowcount == 0:
                db.rollback()
                return json.dumps({"success": False, "message": "Zaten teslim edilmiş bir parça bekliyor olarak işaretlenemez."})
            db.commit()
            return json.dumps({"success": True})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, result=str)
    def revert_work_order_part_status(self, wop_id_str, username):
        """Durumu geri alır: Tedarik Bekleniyor -> Stokta Var, veya Teslim Edildi -> Stokta Var (stok iadeli)."""
        from sqlalchemy import text
        from models.stock import Stock
        from models.stock_movement import StockMovement
        db = SessionLocal()
        try:
            wop_id = int(wop_id_str)
            row = db.execute(
                text("""SELECT id, work_order_id, part_id, quantity, status, delivered_location_id, delivery_movement_id
                        FROM warehouse.work_order_parts WHERE id = :id FOR UPDATE"""),
                {"id": wop_id}
            ).mappings().first()
            if not row:
                return json.dumps({"success": False, "message": "Parça satırı bulunamadı."})

            if row["status"] == "Stokta Var":
                return json.dumps({"success": False, "message": "Bu parça zaten başlangıç durumunda."})

            if row["status"] in ("Tedarik Bekleniyor", "İptal Edildi"):
                # waiting_notes/marked_waiting_by/marked_waiting_at kasıtlı olarak silinmiyor:
                # Tedarik Talepleri geçmişinde bu satırın bir talep olduğu bilgisi korunur (Onaylandı olarak görünür).
                db.execute(text("""
                    UPDATE warehouse.work_order_parts
                    SET status = 'Stokta Var',
                        reverted_by = :user, reverted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                    WHERE id = :id
                """), {"user": username or None, "id": wop_id})
                db.commit()
                return json.dumps({"success": True})

            # status == 'Teslim Edildi' -> stok iadesi + telafi hareketi
            qty = row["quantity"]
            location_id = row["delivered_location_id"]
            stock = db.query(Stock).filter(Stock.part_id == row["part_id"], Stock.location_id == location_id).first()
            if stock:
                stock.quantity += qty
            else:
                stock = Stock(part_id=row["part_id"], location_id=location_id, quantity=qty)
                db.add(stock)

            reversal = StockMovement(
                type="Teslimat İptali",
                quantity=qty,
                part_id=row["part_id"],
                target_location_id=location_id,
                created_by=username or None,
                description=f"İş Emri #{row['work_order_id']} teslimatı geri alındı (orijinal hareket #{row['delivery_movement_id']})"
            )
            db.add(reversal)
            db.flush()

            db.execute(text("""
                UPDATE warehouse.work_order_parts
                SET status = 'Stokta Var', delivered_location_id = NULL, delivery_movement_id = NULL,
                    delivered_by = NULL, delivered_at = NULL,
                    reversal_movement_id = :rev, reverted_by = :user, reverted_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :id
            """), {"rev": reversal.id, "user": username or None, "id": wop_id})
            db.commit()
            return json.dumps({"success": True})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, result=str)
    def remove_work_order_part(self, wop_id_str):
        """Bir parça satırını siler. Teslim edilmiş satırlar önce geri alınmadan silinemez."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            wop_id = int(wop_id_str)
            result = db.execute(text("""
                DELETE FROM warehouse.work_order_parts WHERE id = :id AND status != 'Teslim Edildi'
            """), {"id": wop_id})
            if result.rowcount == 0:
                db.rollback()
                return json.dumps({"success": False, "message": "Teslim edilmiş bir parça silinemez, önce geri alın."})
            db.commit()
            return json.dumps({"success": True})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, result=str)
    def cancel_supply_request(self, wop_id_str, username):
        """Bir tedarik talebini iptal eder (satır silinmez, durum 'İptal Edildi' olur; geçmişte görünmeye devam eder)."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            wop_id = int(wop_id_str)
            result = db.execute(text("""
                UPDATE warehouse.work_order_parts
                SET status = 'İptal Edildi', reverted_by = :user, reverted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = :id AND status != 'Teslim Edildi'
            """), {"user": username or None, "id": wop_id})
            if result.rowcount == 0:
                db.rollback()
                return json.dumps({"success": False, "message": "Teslim edilmiş bir talep iptal edilemez, önce geri alın."})
            db.commit()
            return json.dumps({"success": True})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, str, str, result=str)
    def create_supply_request(self, work_order_id_str, part_id_str, quantity_str, notes, username):
        """Teknisyenin doğrudan tedarik talebi oluşturması: satır doğrudan 'Tedarik Bekleniyor' olarak eklenir."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            work_order_id = int(work_order_id_str)
            part_id = int(part_id_str)
            qty = int(quantity_str) if quantity_str and int(quantity_str) > 0 else 1
            db.execute(text("""
                INSERT INTO warehouse.work_order_parts
                    (work_order_id, part_id, quantity, status, waiting_notes, marked_waiting_by, marked_waiting_at, requested_by)
                VALUES
                    (:wid, :pid, :qty, 'Tedarik Bekleniyor', :notes, :user, CURRENT_TIMESTAMP, :user)
            """), {"wid": work_order_id, "pid": part_id, "qty": qty, "notes": notes or None, "user": username or None})
            db.commit()
            return json.dumps({"success": True})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(result=str)
    def get_supply_requests(self):
        """Tüm iş emirlerinde 'Tedarik Bekleniyor' durumundaki parça satırlarını getirir (Tedarik İstekleri sayfası)."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            rows = db.execute(text("""
                SELECT wop.id, wop.work_order_id, wop.quantity, wop.waiting_notes, wop.marked_waiting_by, wop.marked_waiting_at,
                       p.id AS part_id, p.brand, p.model, p.color, p.part_category, p.item_code, p.name AS part_name_raw,
                       w.assigned_technician, w.priority, w.status AS work_order_status,
                       s.customer_name, s.brand AS device_brand, s.model AS device_model
                FROM warehouse.work_order_parts wop
                JOIN warehouse.work_orders w ON w.id = wop.work_order_id
                LEFT JOIN warehouse.service_records s ON s.id = w.service_record_id
                LEFT JOIN warehouse.parts p ON p.id = wop.part_id
                WHERE wop.status = 'Tedarik Bekleniyor'
                ORDER BY wop.marked_waiting_at ASC
            """)).mappings().all()

            requests = []
            for row in rows:
                part_name = " ".join(filter(None, [row["brand"], row["model"], row["color"], row["part_category"]])) or (row["part_name_raw"] or "")
                requests.append({
                    "id": str(row["id"]),
                    "work_order_id": str(row["work_order_id"]),
                    "part_id": str(row["part_id"]) if row["part_id"] else "",
                    "part_name": part_name,
                    "item_code": row["item_code"] or "",
                    "quantity": row["quantity"],
                    "customer_name": row["customer_name"] or "",
                    "device_brand": row["device_brand"] or "",
                    "device_model": row["device_model"] or "",
                    "assigned_technician": row["assigned_technician"] or "",
                    "priority": row["priority"] or "Orta",
                    "work_order_status": row["work_order_status"] or "",
                    "waiting_notes": row["waiting_notes"] or "",
                    "marked_waiting_by": row["marked_waiting_by"] or "",
                    "marked_waiting_at": row["marked_waiting_at"].strftime("%Y-%m-%d %H:%M") if row["marked_waiting_at"] else ""
                })
            return json.dumps({"success": True, "requests": requests})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, result=str)
    def get_supply_request_history(self, username):
        """Oturumdaki kullanıcının kendi oluşturduğu tedarik taleplerini getirir (Tedarik Talepleri sayfası).
        Başka kullanıcıların talepleri dahil edilmez; depocunun tüm talepleri gördüğü kuyruk için
        bkz. get_supply_requests (ayrı, kullanıcıya göre filtrelenmeyen bir Slot)."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            rows = db.execute(text("""
                SELECT wop.id, wop.work_order_id, wop.quantity, wop.status, wop.waiting_notes,
                       wop.marked_waiting_by, wop.marked_waiting_at,
                       p.id AS part_id, p.brand, p.model, p.color, p.part_category, p.item_code, p.name AS part_name_raw,
                       w.assigned_technician, w.priority, w.status AS work_order_status,
                       s.customer_name, s.brand AS device_brand, s.model AS device_model
                FROM warehouse.work_order_parts wop
                JOIN warehouse.work_orders w ON w.id = wop.work_order_id
                LEFT JOIN warehouse.service_records s ON s.id = w.service_record_id
                LEFT JOIN warehouse.parts p ON p.id = wop.part_id
                WHERE wop.marked_waiting_at IS NOT NULL AND wop.requested_by = :username
                ORDER BY wop.marked_waiting_at DESC
            """), {"username": username or None}).mappings().all()

            requests = []
            for row in rows:
                part_name = " ".join(filter(None, [row["brand"], row["model"], row["color"], row["part_category"]])) or (row["part_name_raw"] or "")
                requests.append({
                    "id": str(row["id"]),
                    "work_order_id": str(row["work_order_id"]),
                    "part_id": str(row["part_id"]) if row["part_id"] else "",
                    "part_name": part_name,
                    "item_code": row["item_code"] or "",
                    "quantity": row["quantity"],
                    "status": row["status"] or "Tedarik Bekleniyor",
                    "customer_name": row["customer_name"] or "",
                    "device_brand": row["device_brand"] or "",
                    "device_model": row["device_model"] or "",
                    "assigned_technician": row["assigned_technician"] or "",
                    "priority": row["priority"] or "Orta",
                    "work_order_status": row["work_order_status"] or "",
                    "waiting_notes": row["waiting_notes"] or "",
                    "marked_waiting_by": row["marked_waiting_by"] or "",
                    "marked_waiting_at": row["marked_waiting_at"].strftime("%Y-%m-%d %H:%M") if row["marked_waiting_at"] else ""
                })
            return json.dumps({"success": True, "requests": requests})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    # ==========================
    # ÜRETİM MODÜLÜ (Yarı Mamul Üretimi / Malzeme Tüketimi / Üretim Geçmişi)
    # ==========================

    @Slot(result=str)
    def get_production_runs(self):
        """Tüm üretilen cihaz kayıtlarını, benzersiz seri numaraları (Cihaz Kimlik ID) ve tükettikleri malzemelerle birlikte getirir."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            units = db.execute(text("""
                SELECT pu.id AS unit_id, pu.serial_number, pr.id AS run_id, pr.target_part_id, pr.quantity_produced, pr.location_id, pr.source_location_id,
                       pr.produced_by, pr.notes, pr.created_at,
                       p.brand AS target_brand, p.model AS target_model,
                       p.item_code AS target_code, p.name AS target_name,
                       l.name AS location_name,
                       sl.name AS source_location_name
                FROM warehouse.produced_units pu
                JOIN warehouse.production_runs pr ON pr.id = pu.production_run_id
                LEFT JOIN warehouse.parts p ON p.id = pr.target_part_id
                LEFT JOIN warehouse.locations l ON l.id = pr.location_id
                LEFT JOIN warehouse.locations sl ON sl.id = pr.source_location_id
                ORDER BY pu.id DESC
            """)).mappings().all()

            materials = db.execute(text("""
                SELECT pm.production_run_id, pm.part_id, pm.quantity_consumed,
                       p.brand, p.model, p.item_code, p.name
                FROM warehouse.production_materials pm
                LEFT JOIN warehouse.parts p ON p.id = pm.part_id
            """)).mappings().all()

            materials_by_run = {}
            for m in materials:
                part_label = f'{m["brand"] or ""} {m["model"] or ""}'.strip() or (m["name"] or "")
                materials_by_run.setdefault(m["production_run_id"], []).append({
                    "part_id": str(m["part_id"]) if m["part_id"] else "",
                    "part_name": part_label,
                    "item_code": m["item_code"] or "",
                    "quantity_consumed": m["quantity_consumed"]
                })

            result = []
            for u in units:
                target_label = f'{u["target_brand"] or ""} {u["target_model"] or ""}'.strip() or (u["target_name"] or "")
                run_qty = u["quantity_produced"]
                
                # Her bir cihaz için malzeme tüketimini adet bazlı hesapla
                unit_materials = []
                for m in materials_by_run.get(u["run_id"], []):
                    qty_per_unit = float(m["quantity_consumed"]) / run_qty if run_qty > 0 else 0
                    if qty_per_unit.is_integer():
                        qty_per_unit = int(qty_per_unit)
                    else:
                        qty_per_unit = round(qty_per_unit, 2)
                        
                    unit_materials.append({
                        "part_id": m["part_id"],
                        "part_name": m["part_name"],
                        "item_code": m["item_code"],
                        "quantity_consumed": qty_per_unit
                    })

                result.append({
                    "id": str(u["run_id"]),  # Geri alma işlemleri için run_id
                    "unit_id": str(u["unit_id"]),
                    "serial_number": u["serial_number"],
                    "target_part_id": str(u["target_part_id"]) if u["target_part_id"] else "",
                    "target_part_name": target_label,
                    "target_item_code": u["target_code"] or "",
                    "quantity_produced": 1,  # Rapor satırında cihaz adedi her zaman 1'dir
                    "location_id": str(u["location_id"]) if u["location_id"] else "",
                    "location_name": u["location_name"] or "",
                    "source_location_id": str(u["source_location_id"]) if u["source_location_id"] else "",
                    "source_location_name": u["source_location_name"] or "",
                    "produced_by": u["produced_by"] or "",
                    "notes": u["notes"] or "",
                    "created_at": u["created_at"].strftime("%Y-%m-%d %H:%M") if u["created_at"] else "",
                    "materials": unit_materials
                })
            return json.dumps({"success": True, "production_runs": result})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, str, str, str, str, result=str)
    def create_production_run(self, target_part_id, quantity_produced, source_location_id, target_location_id, produced_by, notes, materials_json):
        """Hammadde tüketip yarı mamul/ürün stoku oluşturan bir üretim kaydı ekler."""
        from sqlalchemy import text
        import json as json_module
        db = SessionLocal()
        try:
            qty = int(quantity_produced)
            src_loc_id = int(source_location_id)
            tgt_loc_id = int(target_location_id)
            tgt_id = int(target_part_id)
            materials = json_module.loads(materials_json or "[]")

            if qty <= 0:
                return json.dumps({"success": False, "message": "Üretilecek miktar sıfırdan büyük olmalıdır."})

            # Stok yeterliliğini kontrol et (hangi lokasyonda olursa olsun toplam stok esas alınır)
            for m in materials:
                part_id = int(m["part_id"])
                needed = int(m["quantity_consumed"])
                total_available = db.execute(text("""
                    SELECT COALESCE(SUM(quantity), 0) FROM warehouse.stock WHERE part_id = :pid
                """), {"pid": part_id}).scalar()
                if total_available < needed:
                    return json.dumps({"success": False, "message": f"Yetersiz stok (parça id {part_id}): mevcut {total_available}, gerekli {needed}"})

            # Hammaddeleri, stoğu nerede varsa oradan düş (birden fazla lokasyona/satıra yayılmış olabilir)
            for m in materials:
                part_id = int(m["part_id"])
                remaining = int(m["quantity_consumed"])
                rows = db.execute(text("""
                    SELECT id, quantity FROM warehouse.stock
                    WHERE part_id = :pid AND quantity > 0
                    ORDER BY id
                    FOR UPDATE
                """), {"pid": part_id}).all()
                for stock_id, stock_qty in rows:
                    if remaining <= 0:
                        break
                    take = min(stock_qty, remaining)
                    db.execute(text("""
                        UPDATE warehouse.stock SET quantity = quantity - :take WHERE id = :id
                    """), {"take": take, "id": stock_id})
                    remaining -= take

            # Üretilen parçanın stokunu artır (yoksa oluştur)
            existing = db.execute(text("""
                SELECT id FROM warehouse.stock WHERE part_id = :pid AND location_id = :lid
            """), {"pid": tgt_id, "lid": tgt_loc_id}).first()
            if existing:
                db.execute(text("UPDATE warehouse.stock SET quantity = quantity + :qty WHERE id = :id"),
                           {"qty": qty, "id": existing[0]})
            else:
                db.execute(text("""
                    INSERT INTO warehouse.stock (part_id, location_id, quantity) VALUES (:pid, :lid, :qty)
                """), {"pid": tgt_id, "lid": tgt_loc_id, "qty": qty})

            # Üretim kaydını oluştur
            run_id = db.execute(text("""
                INSERT INTO warehouse.production_runs (target_part_id, quantity_produced, source_location_id, location_id, produced_by, notes)
                VALUES (:tgt, :qty, :slid, :tlid, :by, :notes) RETURNING id
            """), {
                "tgt": tgt_id, "qty": qty, "slid": src_loc_id, "tlid": tgt_loc_id,
                "by": produced_by or None, "notes": notes or None
            }).scalar()

            # Her bir cihaz için sıralı ve benzersiz serial number (Cihaz Kimlik ID) oluştur
            for idx in range(qty):
                next_id = db.execute(text("SELECT nextval(pg_get_serial_sequence('warehouse.produced_units', 'id'))")).scalar()
                serial_num = f"REM-PRD-{next_id:06d}"
                db.execute(text("""
                    INSERT INTO warehouse.produced_units (id, production_run_id, serial_number)
                    VALUES (:id, :run_id, :serial)
                """), {"id": next_id, "run_id": run_id, "serial": serial_num})

            for m in materials:
                db.execute(text("""
                    INSERT INTO warehouse.production_materials (production_run_id, part_id, quantity_consumed)
                    VALUES (:run_id, :pid, :qty)
                """), {"run_id": run_id, "pid": int(m["part_id"]), "qty": int(m["quantity_consumed"])})

            db.commit()
            return json.dumps({"success": True, "message": "Üretim kaydı oluşturuldu"})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Üretim kaydı hatası: {str(e)}"})
        finally:
            db.close()

    @Slot(str, str, result=str)
    def delete_production_run(self, run_id_str, return_location_id_str):
        """Belirtilen üretim kaydını siler ve stok hareketlerini geri alır (üretilen ürünü düşer, hammaddeleri seçilen iade lokasyonuna aktarır)."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            run_id = int(run_id_str)
            target_return_location_id = None
            if return_location_id_str and return_location_id_str.strip():
                try:
                    target_return_location_id = int(return_location_id_str)
                except ValueError:
                    pass
            
            # 1. Üretim kaydını çek
            run = db.execute(text("""
                SELECT target_part_id, quantity_produced, location_id, source_location_id
                FROM warehouse.production_runs
                WHERE id = :id
            """), {"id": run_id}).first()
            
            if not run:
                return json.dumps({"success": False, "message": "Üretim kaydı bulunamadı."})
                
            target_part_id = run[0]
            quantity_produced = run[1]
            location_id = run[2]
            source_location_id = run[3]
            
            # 2. Üretilen parçanın stoğunu kontrol et
            target_stock = db.execute(text("""
                SELECT id, quantity FROM warehouse.stock
                WHERE part_id = :pid AND location_id = :lid
                FOR UPDATE
            """), {"pid": target_part_id, "lid": location_id}).first()
            
            if not target_stock or target_stock[1] < quantity_produced:
                current_qty = target_stock[1] if target_stock else 0
                return json.dumps({
                    "success": False, 
                    "message": f"Üretilen parçanın bu lokasyondaki stoğu yetersiz ({current_qty} adet var, {quantity_produced} adet üretilmişti). Üretim geri alınamaz."
                })
                
            # 3. Tüketilen malzemeleri çek
            materials = db.execute(text("""
                SELECT part_id, quantity_consumed
                FROM warehouse.production_materials
                WHERE production_run_id = :run_id
            """), {"run_id": run_id}).all()
            
            # 4. Üretilen parçanın stoğunu düş
            db.execute(text("""
                UPDATE warehouse.stock
                SET quantity = quantity - :qty
                WHERE id = :id
            """), {"qty": quantity_produced, "id": target_stock[0]})
            
            # 5. Tüketilen malzemeleri kaynak lokasyona veya seçilen iade lokasyonuna geri ekle
            return_loc_id = target_return_location_id if target_return_location_id is not None else source_location_id
            for m in materials:
                m_part_id = m[0]
                m_qty = m[1]
                
                existing_m = db.execute(text("""
                    SELECT id FROM warehouse.stock
                    WHERE part_id = :pid AND location_id = :lid
                    FOR UPDATE
                """), {"pid": m_part_id, "lid": return_loc_id}).first()
                
                if existing_m:
                    db.execute(text("""
                        UPDATE warehouse.stock
                        SET quantity = quantity + :qty
                        WHERE id = :id
                    """), {"qty": m_qty, "id": existing_m[0]})
                else:
                    db.execute(text("""
                        INSERT INTO warehouse.stock (part_id, location_id, quantity)
                        VALUES (:pid, :lid, :qty)
                    """), {"pid": m_part_id, "lid": return_loc_id, "qty": m_qty})
            
            # 6. Malzeme tüketim ve üretim kayıtlarını sil
            db.execute(text("DELETE FROM warehouse.production_materials WHERE production_run_id = :run_id"), {"run_id": run_id})
            db.execute(text("DELETE FROM warehouse.production_runs WHERE id = :id"), {"id": run_id})
            
            db.commit()
            return json.dumps({"success": True, "message": "Üretim iade/değişim işlemi başarıyla tamamlandı."})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Silme hatası: {str(e)}"})
        finally:
            db.close()

    # --- YENİ EKLENEN ÜRÜN (TELEFON) VE TEDARİKÇİ FONKSİYONLARI ---
    # Products verileri artik kendi 'products' tablosundan cekiliyor (parts'tan bagimsiz).

    @Slot(result=str)
    def get_products(self):
        from models.product import Product
        db = SessionLocal()
        try:
            products = db.query(Product).all()
            res = []
            for p in products:
                res.append({
                    "id": p.id,
                    "item_code": p.item_code,
                    "brand": p.brand,
                    "model": p.model,
                    "memory": p.memory,
                    "color": p.color
                })
            json_data = json.dumps({"success": True, "products": res})
            write_to_cache("products.json", json_data)
            return json.dumps({"success": True, "fetch_url": "/api_cache/products.json"})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, str, str, str, result=str)
    def create_product(self, item_code, brand, model, memory, color, name):
        from models.product import Product
        db = SessionLocal()
        try:
            product = Product(
                item_code=item_code or None,
                brand=brand,
                model=model,
                memory=memory,
                color=color
            )
            db.add(product)
            db.commit()
            return json.dumps({"success": True, "id": product.id})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, str, str, str, str, result=str)
    def update_product(self, product_id_str, item_code, brand, model, memory, color, name):
        from models.product import Product
        db = SessionLocal()
        try:
            product_id = int(product_id_str)
            product = db.query(Product).filter(Product.id == product_id).first()
            if not product:
                return json.dumps({"success": False, "message": "Ürün bulunamadı"})

            product.item_code = item_code or None
            product.brand = brand
            product.model = model
            product.memory = memory
            product.color = color

            db.commit()
            return json.dumps({"success": True})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, result=str)
    def delete_product(self, product_id_str):
        from models.product import Product
        db = SessionLocal()
        try:
            product_id = int(product_id_str)
            product = db.query(Product).filter(Product.id == product_id).first()
            if not product:
                return json.dumps({"success": False, "message": "Ürün bulunamadı"})
            db.delete(product)
            db.commit()
            return json.dumps({"success": True})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()


    @Slot(result=str)
    def get_suppliers(self):
        from models.part import Part
        db = SessionLocal()
        try:
            parts = db.query(Part).filter(Part.supplier != None).all()
            res = []
            for p in parts:
                res.append({
                    "id": p.id,
                    "supplier": p.supplier,
                    "brand": p.brand,
                    "model": p.model,
                    "item_code": p.item_code,
                    "barcode": p.barcode
                })
            return json.dumps({"success": True, "suppliers": res})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()
            
    @Slot(str, str, str, str, str, result=str)
    def create_supplier(self, supplier, brand, model, item_code, barcode):
        from models.part import Part
        db = SessionLocal()
        try:
            part = Part(
                supplier=supplier,
                brand=brand,
                model=model,
                item_code=item_code,
                barcode=barcode,
                name=f"{supplier} - {brand} {model}"
            )
            db.add(part)
            db.commit()
            return json.dumps({"success": True, "id": part.id})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    # ==========================
    # STOK & DEPO YÖNETİMİ
    # ==========================

    @Slot(result=str)
    def get_stock_status(self):
        filename = "stock.json"
        path = os.path.join(get_cache_dirs()[0], filename)
        fetch_url = f"http://localhost:5173/api_cache/{filename}" if os.getenv("DEV_MODE", "1") == "1" else f"/api_cache/{filename}"
        if os.path.exists(path):
            return json.dumps({"success": True, "fetch_url": fetch_url})

        from sqlalchemy import text
        db = SessionLocal()
        try:
            stocks = db.execute(text("""
                SELECT s.id, p.id as part_id, p.brand, p.model, p.name as pname, 
                       l.id as location_id, l.name as location_name, l.kind as location_kind, 
                       s.quantity, p.critical_limit 
                FROM warehouse.stock s 
                JOIN warehouse.parts p ON s.part_id = p.id 
                JOIN warehouse.locations l ON s.location_id = l.id
                ORDER BY s.id DESC
            """)).mappings().all()
            res = []
            for row in stocks:
                res.append({
                    "id": row["id"],
                    "part_id": row["part_id"],
                    "part_name": (row['pname'] or '').strip(),
                    "location_id": row["location_id"],
                    "location_name": row["location_name"],
                    "location_kind": row["location_kind"],
                    "quantity": row["quantity"],
                    "critical_limit": row["critical_limit"] or 50
                })
            json_data = json.dumps({"success": True, "stock": res})
            write_to_cache("stock.json", json_data)
            return json.dumps({"success": True, "fetch_url": "/api_cache/stock.json"})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, str, str, result=str)
    def transfer_stock(self, part_id, from_loc_id, to_loc_id, qty, username):
        from models.stock import Stock
        from models.stock_movement import StockMovement
        from models.location import Location
        db = SessionLocal()
        try:
            qty = int(qty)

            locs = db.query(Location).filter(Location.id.in_([int(from_loc_id), int(to_loc_id)])).all()
            # Artık hiçbir depoyu kısıtlamıyoruz


            source_stock = db.query(Stock).with_for_update().filter(Stock.part_id == part_id, Stock.location_id == from_loc_id).first()
            if not source_stock or source_stock.quantity < qty:
                return json.dumps({"success": False, "message": "Yetersiz stok veya lokasyon bulunamadı."})

            source_stock.quantity -= qty
            
            target_stock = db.query(Stock).with_for_update().filter(Stock.part_id == part_id, Stock.location_id == to_loc_id).first()
            if target_stock:
                target_stock.quantity += qty
            else:
                target_stock = Stock(part_id=part_id, location_id=to_loc_id, quantity=qty)
                db.add(target_stock)
                
            movement = StockMovement(
                type="İç Transfer",
                quantity=qty,
                part_id=part_id,
                source_location_id=from_loc_id,
                target_location_id=to_loc_id,
                created_by=username
            )
            db.add(movement)
            db.commit()
            return json.dumps({"success": True})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, result=str)
    def get_stock_movements(self, mov_type):
        # mov_type can be 'in' or 'out' or 'all'
        from models.stock_movement import StockMovement
        from models.part import Part
        from models.location import Location
        from sqlalchemy.orm import aliased
        db = SessionLocal()
        try:
            SourceLoc = aliased(Location)
            TargetLoc = aliased(Location)
            query = db.query(StockMovement, Part, SourceLoc, TargetLoc) \
                .outerjoin(Part, StockMovement.part_id == Part.id) \
                .outerjoin(SourceLoc, StockMovement.source_location_id == SourceLoc.id) \
                .outerjoin(TargetLoc, StockMovement.target_location_id == TargetLoc.id)
                
            if mov_type == 'in':
                query = query.filter(StockMovement.type.in_(["Giriş", "İç Transfer", "Yeni Alım", "Inbound", "Transfer"]))
            elif mov_type == 'out':
                query = query.filter(StockMovement.type.in_(["Çıkış", "İç Transfer", "Müşteri Satışı", "Tedarikçiye İade", "Outbound", "Transfer"]))
                
            query = query.order_by(StockMovement.created_at.desc()).limit(200)
            results = query.all()
            
            res = []
            for mov, p, sloc, tloc in results:
                res.append({
                    "id": mov.id,
                    "type": mov.type,
                    "quantity": mov.quantity,
                    "part_id": mov.part_id,
                    "part_name": p.name if p else "Silinmiş Parça",
                    "source_location_id": mov.source_location_id,
                    "source_location": sloc.name if sloc else "-",
                    "target_location_id": mov.target_location_id,
                    "target_location": tloc.name if tloc else "-",
                    "created_by": mov.created_by,
                    "technician": mov.technician or "-",
                    "description": mov.description or "-",
                    "unit_price": float(mov.unit_price) if mov.unit_price else None,
                    "created_at": mov.created_at.strftime("%Y-%m-%d %H:%M") if mov.created_at else ""
                })
            return json.dumps({"success": True, "movements": res})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, str, str, str, result=str)
    def add_inbound_entry(self, part_id, location_id, qty, unit_price, type_str, username):
        from models.stock import Stock
        from models.stock_movement import StockMovement
        from models.location import Location
        db = SessionLocal()
        try:
            qty = int(qty)
            price = float(unit_price) if unit_price else 0.0

            stock = db.query(Stock).filter(Stock.part_id == part_id, Stock.location_id == location_id).first()
            if stock:
                stock.quantity += qty
            else:
                stock = Stock(part_id=part_id, location_id=location_id, quantity=qty)
                db.add(stock)

            target_loc = db.query(Location).filter(Location.id == int(location_id)).first()
            movement_kind = "Inbound" if target_loc and target_loc.kind in ("good_stock", "doa_stock") else None

            mov = StockMovement(
                type=type_str or "Giriş",
                movement_kind=movement_kind,
                quantity=qty,
                part_id=part_id,
                target_location_id=location_id,
                unit_price=price,
                total_cost=qty * price,
                created_by=username
            )
            db.add(mov)
            db.commit()
            return json.dumps({"success": True})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, str, str, str, str, result=str)
    def add_outbound_entry(self, part_id, location_id, qty, type_str, username, technician, description):
        from models.stock import Stock
        from models.stock_movement import StockMovement
        from models.location import Location
        db = SessionLocal()
        try:
            qty = int(qty)

            stock = db.query(Stock).with_for_update().filter(Stock.part_id == part_id, Stock.location_id == location_id).first()
            if not stock or stock.quantity < qty:
                return json.dumps({"success": False, "message": "Yetersiz stok."})

            stock.quantity -= qty

            source_loc = db.query(Location).filter(Location.id == int(location_id)).first()
            target_location_id = None
            movement_kind = None
            if source_loc and source_loc.kind in ("good_stock", "doa_stock"):
                target_kind = "scrap_stock" if type_str == "Fire" else "out_stock"
                target_location_id = _get_system_location_id(db, target_kind)
                movement_kind = "Scrap" if target_kind == "scrap_stock" else "Outbound"
                if target_location_id:
                    target_stock = db.query(Stock).filter(Stock.part_id == part_id, Stock.location_id == target_location_id).first()
                    if target_stock:
                        target_stock.quantity += qty
                    else:
                        db.add(Stock(part_id=part_id, location_id=target_location_id, quantity=qty))

            mov = StockMovement(
                type=type_str or "Çıkış",
                movement_kind=movement_kind,
                quantity=qty,
                part_id=part_id,
                source_location_id=location_id,
                target_location_id=target_location_id,
                created_by=username,
                technician=technician or None,
                description=description or None
            )
            db.add(mov)
            db.commit()
            return json.dumps({"success": True})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, result=str)
    def get_reports(self, start_date, end_date):
        from models.stock_movement import StockMovement
        from models.part import Part
        from models.location import Location
        from sqlalchemy.orm import aliased
        from datetime import datetime
        db = SessionLocal()
        try:
            TargetLoc = aliased(Location)
            SourceLoc = aliased(Location)
            
            query = db.query(StockMovement, Part, SourceLoc, TargetLoc) \
                .outerjoin(Part, StockMovement.part_id == Part.id) \
                .outerjoin(SourceLoc, StockMovement.source_location_id == SourceLoc.id) \
                .outerjoin(TargetLoc, StockMovement.target_location_id == TargetLoc.id)
                
            if start_date:
                try:
                    if 'T' in start_date:
                        dt = datetime.fromisoformat(start_date)
                    else:
                        dt = datetime.strptime(start_date, "%Y-%m-%d")
                    query = query.filter(StockMovement.created_at >= dt)
                except Exception as e:
                    print(f"Error parsing start_date '{start_date}': {e}")
            if end_date:
                try:
                    if 'T' in end_date:
                        dt = datetime.fromisoformat(end_date)
                        query = query.filter(StockMovement.created_at <= dt)
                    else:
                        dt = datetime.strptime(end_date, "%Y-%m-%d")
                        import datetime as dt_module
                        dt = dt + dt_module.timedelta(days=1)
                        query = query.filter(StockMovement.created_at < dt)
                except Exception as e:
                    print(f"Error parsing end_date '{end_date}': {e}")
                    
            query = query.order_by(StockMovement.created_at.desc()).limit(10000)
            results = query.all()
            
            res = []
            for mov, p, sloc, tloc in results:
                # determine generic loc
                loc_name = tloc.name if tloc else (sloc.name if sloc else "-")
                if mov.type == "İç Transfer" and sloc and tloc:
                    loc_name = f"{sloc.name} -> {tloc.name}"
                    
                res.append({
                    "id": mov.id,
                    "date": mov.created_at.strftime("%Y-%m-%d %H:%M") if mov.created_at else "",
                    "type": mov.type,
                    "part_name": p.name if p else "-",
                    "location": loc_name,
                    "quantity": mov.quantity,
                    "user": mov.created_by
                })
            return json.dumps({"success": True, "reports": res})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    # ==========================
    # DEV MODE (Sadece Admin)
    # ==========================

    @Slot(result=str)
    def get_dev_mode(self):
        import os
        return json.dumps({"success": True, "dev_mode": os.getenv("DEV_MODE", "1") == "1"})

    @Slot(bool, result=str)
    def set_dev_mode(self, enabled):
        import dotenv
        import os
        env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        try:
            dotenv.set_key(env_file, "DEV_MODE", "1" if enabled else "0")
            dotenv.load_dotenv(env_file, override=True)
            return json.dumps({"success": True})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})

    @Slot(str, str, str, str, str, result=str)
    def update_db_settings(self, host, port, db_name, user, password):
        import dotenv
        import os
        env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        try:
            dotenv.set_key(env_file, "PG_HOST", host)
            dotenv.set_key(env_file, "PG_PORT", port)
            dotenv.set_key(env_file, "PG_DATABASE", db_name)
            dotenv.set_key(env_file, "PG_USER", user)
            dotenv.set_key(env_file, "PG_PASSWORD", password)
            dotenv.load_dotenv(env_file, override=True)
            return json.dumps({"success": True})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})


    # ==========================
    # DASHBOARD & EXCEL (NEW)
    # ==========================

    @Slot(result=str)
    def get_dashboard_stats(self):
        from models.part import Part
        from models.stock import Stock
        from models.stock_movement import StockMovement
        from models.location import Location
        from sqlalchemy import func
        from datetime import date
        db = SessionLocal()
        try:
            total_parts = db.query(func.count(Part.id)).scalar() or 0
            
            good_stock_id = _get_system_location_id(db, "good_stock")
            if good_stock_id:
                critical_count = db.query(func.count(Stock.id)).join(Part, Stock.part_id == Part.id).filter(
                    Stock.location_id == good_stock_id,
                    Stock.quantity < func.coalesce(Part.critical_limit, 50)
                ).scalar() or 0
            else:
                critical_count = 0
            
            from datetime import datetime, time
            today = date.today()
            today_start = datetime.combine(today, time.min)
            
            todays_inbound = db.query(func.sum(StockMovement.quantity)).filter(
                StockMovement.type.in_(["Giriş", "İç Transfer", "Yeni Alım", "Inbound", "Transfer"]),
                StockMovement.created_at >= today_start
            ).scalar() or 0
            
            todays_outbound = db.query(func.sum(StockMovement.quantity)).filter(
                StockMovement.type.in_(["Çıkış", "İç Transfer", "Müşteri Satışı", "Tedarikçiye İade", "Outbound", "Transfer"]),
                StockMovement.created_at >= today_start
            ).scalar() or 0
            
            active_locations = db.query(func.count(Location.id)).scalar() or 0
            
            import json
            return json.dumps({
                "success": True,
                "stats": {
                    "totalParts": str(total_parts),
                    "criticalStock": str(critical_count),
                    "todaysInbound": str(int(todays_inbound)),
                    "todaysOutbound": str(int(todays_outbound)),
                    "activeLocations": str(active_locations)
                }
            })
        except Exception as e:
            import json
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(result=str)
    def get_critical_stock(self):
        filename = "critical.json"
        path = os.path.join(get_cache_dirs()[0], filename)
        fetch_url = f"http://localhost:5173/api_cache/{filename}" if os.getenv("DEV_MODE", "1") == "1" else f"/api_cache/{filename}"
        if os.path.exists(path):
            return json.dumps({"success": True, "fetch_url": fetch_url})

        from models.stock import Stock
        from models.part import Part
        from models.location import Location
        db = SessionLocal()
        try:
            from sqlalchemy import func
            good_stock_id = _get_system_location_id(db, "good_stock")
            if good_stock_id:
                stocks = db.query(Stock, Part, Location).join(Part, Stock.part_id == Part.id).join(Location, Stock.location_id == Location.id).filter(
                    Stock.location_id == good_stock_id,
                    Stock.quantity < func.coalesce(Part.critical_limit, 50)
                ).all()
            else:
                stocks = []

            res = []
            for s, p, l in stocks:
                limit = p.critical_limit or 50
                res.append({
                    "id": s.id,
                    "part_name": f"{p.brand} {p.model} {p.name}",
                    "location_name": l.name,
                    "quantity": s.quantity,
                    "critical_limit": limit,
                    "status": "Kritik" if s.quantity > 0 else "Tükendi"
                })
            import json
            return json.dumps({"success": True, "critical_stock": res})
        except Exception as e:
            import json
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, result=str)
    def export_table_to_excel(self, data_json_str, filename):
        """
        Genel amaçlı excel export - Direkt İndirilenler Klasörüne Kaydeder
        """
        from core.excel_utils import style_excel_file
        import json
        import pandas as pd
        import os
        from pathlib import Path
        try:
            data = json.loads(data_json_str)
            if not data:
                return json.dumps({"success": False, "message": "Dışa aktarılacak veri yok."})
                
            downloads_path = str(Path.home() / "Downloads")
            file_path = os.path.join(downloads_path, filename)
            
            # Eğer dosya varsa ismini değiştir
            counter = 1
            base_name, ext = os.path.splitext(filename)
            while os.path.exists(file_path):
                file_path = os.path.join(downloads_path, f"{base_name}_{counter}{ext}")
                counter += 1
                
            df = pd.DataFrame(data)
            df.to_excel(file_path, index=False)
            try:
                style_excel_file(file_path)
            except:
                pass
                
            # Dosyayı otomatik aç (Windows)
            os.startfile(file_path)
            
            return json.dumps({"success": True})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})

    @Slot(str, result=str)
    def export_all_tables_to_excel(self, filename):
        """
        Tüm veritabanı tablolarını tek bir excel dosyasında farklı sheet'lerde dışa aktarır.
        JS üzerinden veri transferini atlayarak (size limitleri aşmamak için) direkt db'den çeker.
        """
        from core.excel_utils import style_excel_file
        import json
        import pandas as pd
        import os
        import re
        from pathlib import Path
        from sqlalchemy import text
        from config.database import get_db
        try:
            downloads_path = str(Path.home() / "Downloads")
            file_path = os.path.join(downloads_path, filename)
            
            # Eğer dosya varsa ismini değiştir
            counter = 1
            base_name, ext = os.path.splitext(filename)
            while os.path.exists(file_path):
                file_path = os.path.join(downloads_path, f"{base_name}_{counter}{ext}")
                counter += 1
                
            # Sheet adlarını temizleme fonksiyonu
            def clean_sheet_name(name):
                # Excel kısıtlamaları: max 31 karakter, : \ / ? * [ ] yasak
                name = re.sub(r'[:\\/?*\[\]]', '_', name)
                return name[:31]
                
            with get_db() as db:
                tables_query = text('''
                    SELECT table_schema, table_name 
                    FROM information_schema.tables 
                    WHERE table_schema IN ('public', 'warehouse', 'auth') 
                      AND table_type = 'BASE TABLE'
                ''')
                tables_result = db.execute(tables_query).fetchall()

                with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
                    used_sheet_names = set()
                    
                    for schema, t_name in tables_result:
                        query = text(f'SELECT * FROM "{schema}"."{t_name}"')
                        result = db.execute(query).fetchall()
                        keys = result[0]._mapping.keys() if result else []
                        data = [dict(zip(keys, row)) for row in result]
                        
                        for row in data:
                            for k, v in row.items():
                                if hasattr(v, 'isoformat'):
                                    row[k] = v.isoformat()
                                    
                        cleaned_name = clean_sheet_name(t_name)
                        
                        # Aynı isim çakışmasını önle
                        original_clean = cleaned_name
                        suffix = 1
                        while cleaned_name in used_sheet_names:
                            suffix_str = f"_{suffix}"
                            cleaned_name = f"{original_clean[:31-len(suffix_str)]}{suffix_str}"
                            suffix += 1
                            
                        used_sheet_names.add(cleaned_name)
                        
                        df = pd.DataFrame(data)
                        df.to_excel(writer, sheet_name=cleaned_name, index=False)
                    
            try:
                style_excel_file(file_path)
            except:
                pass
                
            # Dosyayı otomatik aç (Windows)
            os.startfile(file_path)
            
            return json.dumps({"success": True})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})

    # ==========================================
    # LOCAL DB & DATA FOLDERS (AYARLAR SEKME)
    # ==========================================
    def _get_settings_file(self):
        import os
        from pathlib import Path
        settings_dir = os.path.join(str(Path.home()), ".remalab")
        os.makedirs(settings_dir, exist_ok=True)
        return os.path.join(settings_dir, "settings.json")

    def _read_settings(self):
        import json, os
        settings_file = self._get_settings_file()
        if not os.path.exists(settings_file):
            return {"local_files": [], "data_folders": []}
        try:
            with open(settings_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            return {"local_files": [], "data_folders": []}

    def _write_settings(self, data):
        import json
        settings_file = self._get_settings_file()
        with open(settings_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=4)

    @Slot(result=str)
    def get_local_files(self):
        import json, os, datetime
        settings = self._read_settings()
        files = settings.get("local_files", [])
        valid_files = []
        for f in files:
            path = f.get("path")
            if path and os.path.exists(path):
                size_bytes = os.path.getsize(path)
                size_mb = size_bytes / (1024 * 1024)
                mod_time = os.path.getmtime(path)
                mod_date = datetime.datetime.fromtimestamp(mod_time).strftime('%d.%m.%Y %H:%M')
                
                f["size"] = f"{size_mb:.2f} MB"
                f["modified"] = mod_date
                
                # Mock tables/records count if sqlite
                if f.get("type") == "sqlite":
                    f["tables"] = 0
                    f["records"] = 0
                    try:
                        import sqlite3
                        conn = sqlite3.connect(path)
                        cursor = conn.cursor()
                        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
                        tables = cursor.fetchall()
                        f["tables"] = len(tables)
                        conn.close()
                    except:
                        pass
                
                valid_files.append(f)
            else:
                f["size"] = "Kayıp"
                f["modified"] = "Bilinmiyor"
                valid_files.append(f)
        
        return json.dumps({"success": True, "local_files": valid_files})

    @Slot(result=str)
    def add_local_file(self):
        from PySide6.QtWidgets import QFileDialog, QApplication
        import json, os, uuid
        
        main_win = QApplication.instance().main_window
        file_path, _ = QFileDialog.getOpenFileName(
            main_win, "Var Olan Veritabanı veya Betiği Seç", "", "Database Files (*.db *.sqlite *.sql);;All Files (*)"
        )
        if not file_path:
            return json.dumps({"success": False, "message": "Seçim iptal edildi"})
            
        settings = self._read_settings()
        
        # Check if already exists
        for f in settings.get("local_files", []):
            if f.get("path") == file_path:
                return json.dumps({"success": False, "message": "Bu dosya zaten listede."})
                
        file_type = "sqlite" if file_path.endswith((".db", ".sqlite")) else "sql"
        new_file = {
            "id": str(uuid.uuid4()),
            "name": os.path.basename(file_path),
            "path": file_path,
            "type": file_type
        }
        
        settings.setdefault("local_files", []).append(new_file)
        self._write_settings(settings)
        return json.dumps({"success": True, "file": new_file})

    @Slot(result=str)
    def create_local_file(self):
        from PySide6.QtWidgets import QFileDialog, QApplication
        import json, os, uuid, sqlite3
        
        main_win = QApplication.instance().main_window
        file_path, _ = QFileDialog.getSaveFileName(
            main_win, "Yeni SQLite Veritabanı Oluştur", "yeni_veritabani.db", "SQLite Database (*.db)"
        )
        if not file_path:
            return json.dumps({"success": False, "message": "İşlem iptal edildi"})
            
        try:
            # Create empty sqlite
            conn = sqlite3.connect(file_path)
            conn.close()
            
            settings = self._read_settings()
            new_file = {
                "id": str(uuid.uuid4()),
                "name": os.path.basename(file_path),
                "path": file_path,
                "type": "sqlite"
            }
            settings.setdefault("local_files", []).append(new_file)
            self._write_settings(settings)
            return json.dumps({"success": True, "file": new_file})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})

    @Slot(str, result=str)
    def delete_local_file(self, file_id):
        import json
        settings = self._read_settings()
        files = settings.get("local_files", [])
        settings["local_files"] = [f for f in files if f.get("id") != file_id]
        self._write_settings(settings)
        return json.dumps({"success": True})

    @Slot(str, result=str)
    def open_local_folder(self, file_path):
        import json, os, sys
        import subprocess
        try:
            folder = os.path.dirname(file_path)
            if not os.path.exists(folder):
                return json.dumps({"success": False, "message": "Klasör bulunamadı."})
            if os.name == 'nt':
                os.startfile(folder)
            elif sys.platform == 'darwin':
                subprocess.Popen(['open', folder])
            else:
                subprocess.Popen(['xdg-open', folder])
            return json.dumps({"success": True})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})

    @Slot(result=str)
    def get_data_folders(self):
        import json
        settings = self._read_settings()
        return json.dumps({"success": True, "data_folders": settings.get("data_folders", [])})

    @Slot(result=str)
    def add_data_folder(self):
        from PySide6.QtWidgets import QFileDialog, QApplication
        import json, os, uuid
        
        main_win = QApplication.instance().main_window
        folder_path = QFileDialog.getExistingDirectory(
            main_win, "Klasör Seç"
        )
        if not folder_path:
            return json.dumps({"success": False, "message": "Seçim iptal edildi"})
            
        settings = self._read_settings()
        
        # Check if already exists
        for f in settings.get("data_folders", []):
            if f.get("path") == folder_path:
                return json.dumps({"success": False, "message": "Bu klasör zaten listede."})
                
        # Determine type based on name heuristically or default to data
        folder_type = "backup" if "backup" in folder_path.lower() or "yedek" in folder_path.lower() else "data"
        new_folder = {
            "id": str(uuid.uuid4()),
            "name": os.path.basename(folder_path) or folder_path,
            "path": folder_path,
            "type": folder_type
        }
        
        settings.setdefault("data_folders", []).append(new_folder)
        self._write_settings(settings)
        return json.dumps({"success": True, "folder": new_folder})

    @Slot(str, result=str)
    def delete_data_folder(self, folder_id):
        import json
        settings = self._read_settings()
        folders = settings.get("data_folders", [])
        settings["data_folders"] = [f for f in folders if f.get("id") != folder_id]
        self._write_settings(settings)
        return json.dumps({"success": True})

    # ==========================
    # DYNAMIC TABLE MANAGEMENT
    # ==========================
    @Slot(result=str)
    def get_all_tables_schema(self):
        """Fetch all tables and their columns from specific schemas."""
        import json
        from sqlalchemy import text
        from config.database import get_db
        try:
            with get_db() as db:
                # First fetch tables
                tables_query = text('''
                    SELECT table_schema, table_name 
                    FROM information_schema.tables 
                    WHERE table_schema IN ('public', 'warehouse', 'auth') 
                      AND table_type = 'BASE TABLE'
                ''')
                tables_result = db.execute(tables_query).fetchall()
                
                tables_data = []
                for schema, t_name in tables_result:
                    cols_query = text('''
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_schema = :schema AND table_name = :t_name
                    ''')
                    cols_result = db.execute(cols_query, {"schema": schema, "t_name": t_name}).fetchall()
                    columns = [row[0] for row in cols_result]
                    
                    tables_data.append({
                        "id": f"{schema}.{t_name}",
                        "name": f"{t_name} ({schema})",
                        "schema": schema,
                        "table_name": t_name,
                        "columns": columns
                    })
                return json.dumps({"success": True, "tables": tables_data})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})

    @Slot(str, str, result=str)
    def get_table_data(self, schema, table_name):
        """Fetch all rows from a dynamically specified table."""
        import json
        from sqlalchemy import text
        from config.database import get_db
        
        # Security: whitelist check or ensure schema is valid
        if schema not in ['public', 'warehouse', 'auth']:
            return json.dumps({"success": False, "message": "Invalid schema"})
            
        try:
            with get_db() as db:
                query = text(f'SELECT * FROM "{schema}"."{table_name}"')
                result = db.execute(query).fetchall()
                keys = result[0]._mapping.keys() if result else []
                data = [dict(zip(keys, row)) for row in result]
                # convert datetime objects to string
                for row in data:
                    for k, v in row.items():
                        if hasattr(v, 'isoformat'):
                            row[k] = v.isoformat()
                return json.dumps({"success": True, "data": data})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})

    @Slot(str, str, str, result=str)
    def insert_table_data(self, schema, table_name, data_json):
        """Insert row into a specified table."""
        import json
        from sqlalchemy import text
        from config.database import get_db
        
        if schema not in ['public', 'warehouse', 'auth']:
            return json.dumps({"success": False, "message": "Invalid schema"})
            
        try:
            data = json.loads(data_json)
            if not isinstance(data, dict):
                return json.dumps({"success": False, "message": "Data must be a dictionary"})
                
            columns = list(data.keys())
            values = list(data.values())
            
            placeholders = ', '.join([f':{col}' for col in columns])
            col_names = ', '.join([f'"{col}"' for col in columns])
            
            with get_db() as db:
                query = text(f'INSERT INTO "{schema}"."{table_name}" ({col_names}) VALUES ({placeholders})')
                db.execute(query, data)
                db.commit()
                return json.dumps({"success": True})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
