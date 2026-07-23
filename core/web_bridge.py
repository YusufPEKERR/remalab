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

def clear_api_cache(session=None):
    """Veritabanında değişiklik olduğunda cache'i temizler, böylece UI sadece yeni veriyi bekler."""
    dirs = get_cache_dirs()
    for d in dirs:
        for filename in ["parts.json", "stock.json", "critical.json"]:
            path = os.path.join(d, filename)
            if os.path.exists(path):
                try: 
                    os.remove(path)
                except Exception as e: 
                    logging.error(f"Failed to clear cache {path}: {e}")

event.listen(Session, 'after_commit', clear_api_cache)

# Otomatik iş akışıyla yönetilen sabit sistem depoları. Bu depolar arasındaki
# manuel transferler (bkz. transfer_stock) SYSTEM_TRANSFER_RULES ile kısıtlanır.
SYSTEM_LOCATION_KINDS = {
    "good_stock": "Good Stock",
    "doa_stock": "DOA Stock",
    "repair_stock": "Repair Stock",
    "scrap_stock": "Scrap Stock",
    "out_stock": "Out Stock",
}

# Depolar arası manuel "Stok Transferi" akışının izin verdiği kaynak->hedef
# eşleşmeleri. Bir kaynak kind burada yoksa (ör. custom raf lokasyonu) kısıtlama
# uygulanmaz.
SYSTEM_TRANSFER_RULES = {
    "good_stock": {"repair_stock"},
    "repair_stock": {"out_stock", "doa_stock"},
    "doa_stock": {"good_stock", "scrap_stock"},
    "out_stock": set(),
    "scrap_stock": set(),
    "wip_stock": set(),
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

# Müşteriler sayfası toplu (Excel) yükleme modülü için "Flow (İş Akışı)" alanının
# kabul ettiği sabit değer kümesi. Hem şablon oluşturma (dropdown listesi) hem
# de içe aktarma doğrulaması bu listeyi kullanır.
CUSTOMER_FLOW_VALUES = ["Refurbish", "Repair", "RMA", "Battery Replacement"]

# Toplu yüklemede zorunlu olan sütunlar (şablon başlığı -> customers alanı).
CUSTOMER_BULK_REQUIRED_COLUMNS = [
    ("IMEI Numarası", "imei_number"),
    ("Seri Numarası", "serial_number"),
    ("Internal ID", "internal_id"),
    ("Cihaz Modeli", "cihaz_modeli"),
    ("Flow (İş Akışı)", "flow"),
    ("Müşteri Şikayeti", "customer_reported_complaint"),
    ("Giriş Tarihi", "intake_date"),
]


def _get_system_location_id(db, kind):
    """Verilen kind'a ('good_stock' vb.) sahip sistem deposunun id'sini döner."""
    from models.location import Location
    loc = db.query(Location).filter(Location.kind == kind).first()
    return loc.id if loc else None


def _build_part_display_name(brand, model, color, part_category, name, item_code):
    """Parça için kullanıcıya gösterilecek ismi (marka+model+renk+kategori, yoksa
    ad, o da yoksa item_code) üretir. get_stock_status ile aynı öncelik sırasını kullanır."""
    display_name = " ".join(filter(None, [brand, model, color, part_category])).strip()
    if not display_name:
        display_name = (name or "").strip()
    if not display_name:
        display_name = item_code or "Parça"
    return display_name


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
        self._ensure_item_model_lookup()
        self._ensure_batch_entries_table()

    def _find_reference_excel_file(self):
        """Proje kök dizininde MioCreate referans veri dosyasını arar.
        Hem eski isimlendirmeyi ('...dosya...') hem de mevcut 'MioCreate.xlsx' adını destekler."""
        import os
        candidates = [
            f for f in os.listdir('.')
            if f.lower().endswith('.xlsx')
            and not f.startswith('~$')
            and ('dosya' in f.lower() or 'miocreate' in f.lower())
        ]
        return candidates[0] if candidates else None

    def _ensure_item_bom_data(self):
        """ItemBOM tablosunun verilerini Excel dosyasından okuyarak veri tabanına senkronize eder."""
        from sqlalchemy import text
        from models.part import Part
        from models.item_bom import ItemBOM
        import openpyxl

        db = SessionLocal()
        try:
            # Check if table already has data
            count = db.execute(text("SELECT COUNT(*) FROM warehouse.item_bom;")).scalar()
            if count > 0:
                return

            print("[WebBridge] ItemBOM tablosu boş. Excel'den veri içe aktarılıyor...")
            fname = self._find_reference_excel_file()
            if not fname:
                print("[WebBridge] Referans Excel dosyası (MioCreate.xlsx) bulunamadı.")
                return
            wb = openpyxl.load_workbook(fname, data_only=True)
            
            # Read Item sheet for names, types
            ws_item = wb['Item']
            item_rows = list(ws_item.iter_rows(values_only=True))
            h_idx = next(i for i, r in enumerate(item_rows) if r and 'code' in [str(x).lower() for x in r])
            headers_item = item_rows[h_idx]
            code_col = next(i for i, h in enumerate(headers_item) if h == 'code')
            shortname_col = next(i for i, h in enumerate(headers_item) if h == 'shortName')
            category_col = next(i for i, h in enumerate(headers_item) if h == 'itemCategory')
            type_col = next(i for i, h in enumerate(headers_item) if h == 'itemType')

            item_info_map = {}
            for r in item_rows[h_idx+1:]:
                item_code_val = r[code_col]
                s_name = r[shortname_col]
                cat_val = r[category_col]
                type_val = r[type_col]
                if item_code_val:
                    item_info_map[str(item_code_val)] = {
                        "name": str(s_name) if s_name else str(item_code_val),
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

    def _insert_item_models_batch(self, db, batch):
        """warehouse.item_models tablosuna tek seferde birden çok satır ekler.
        30k satırı tek tek INSERT etmek uzak veritabanına çok fazla round-trip
        açıp bağlantının zaman aşımına uğramasına/kopmasına yol açıyordu."""
        from sqlalchemy import text
        values_sql = ", ".join(f"(:code{i}, :model{i}, :brand{i})" for i in range(len(batch)))
        params = {}
        for i, row in enumerate(batch):
            params[f"code{i}"] = row["code"]
            params[f"model{i}"] = row["model"]
            params[f"brand{i}"] = row["brand"]
        db.execute(text(f"""
            INSERT INTO warehouse.item_models (item_code, model, brand)
            VALUES {values_sql}
            ON CONFLICT (item_code) DO UPDATE SET model = EXCLUDED.model, brand = EXCLUDED.brand;
        """), params)

    def _ensure_item_model_lookup(self):
        """Parça kodu girildiğinde 'Model' alanının otomatik doldurulabilmesi için
        ProductBom (item -> productFamily) ve ProductFamily (productFamily -> shortName)
        sayfalarından warehouse.item_models (item_code -> model) eşleşme tablosunu kurar."""
        from sqlalchemy import text
        import openpyxl

        db = SessionLocal()
        try:
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS warehouse.item_models (
                    item_code VARCHAR(100) PRIMARY KEY,
                    model TEXT
                );
            """))
            db.execute(text("ALTER TABLE warehouse.item_models ALTER COLUMN model TYPE TEXT;"))
            db.execute(text("ALTER TABLE warehouse.item_models ADD COLUMN IF NOT EXISTS brand TEXT;"))
            db.commit()

            # brand sütunu sonradan eklendiği için, marka verisi henüz işlenmemiş
            # kurulumlarda (model dolu ama brand boş) tabloyu yeniden içe aktarmamız gerekir.
            count = db.execute(text("SELECT COUNT(*) FROM warehouse.item_models WHERE brand IS NOT NULL AND brand <> '';")).scalar()
            if count > 0:
                return

            fname = self._find_reference_excel_file()
            if not fname:
                print("[WebBridge] Referans Excel dosyası (MioCreate.xlsx) bulunamadı.")
                return

            print("[WebBridge] item_models tablosu boş. Excel'den Parça Kodu -> Model eşleşmesi içe aktarılıyor...")
            wb = openpyxl.load_workbook(fname, data_only=True)

            # ProductFamily: kod (örn. 'iP11') -> okunabilir model adı (örn. 'iPhone 11')
            ws_family = wb['ProductFamily']
            family_rows = list(ws_family.iter_rows(values_only=True))
            h_idx_family = next(i for i, r in enumerate(family_rows) if r and 'code' in [str(x).lower() for x in r])
            headers_family = family_rows[h_idx_family]
            fam_code_col = next(i for i, h in enumerate(headers_family) if h == 'code')
            fam_shortname_col = next(i for i, h in enumerate(headers_family) if h == 'shortName')
            fam_brand_col = next((i for i, h in enumerate(headers_family) if h == 'brand'), None)

            family_name_map = {}
            family_brand_map = {}
            for r in family_rows[h_idx_family + 1:]:
                fam_code = r[fam_code_col]
                fam_name = r[fam_shortname_col]
                if fam_code:
                    family_name_map[str(fam_code)] = str(fam_name) if fam_name else str(fam_code)
                    if fam_brand_col is not None and r[fam_brand_col]:
                        family_brand_map[str(fam_code)] = str(r[fam_brand_col])

            # ProductBom: item_code -> productFamily kodları (bir parça birden fazla modelde kullanılabilir)
            ws_bom = wb['ProductBom']
            bom_rows = list(ws_bom.iter_rows(values_only=True))
            h_idx_bom = next(i for i, r in enumerate(bom_rows) if r and 'item' in [str(x).lower() for x in r])
            headers_bom = bom_rows[h_idx_bom]
            item_col = next(i for i, h in enumerate(headers_bom) if h == 'item')
            family_col = next(i for i, h in enumerate(headers_bom) if h == 'productFamily')

            item_families = {}
            for r in bom_rows[h_idx_bom + 1:]:
                item_code = r[item_col]
                fam_code = r[family_col]
                if not item_code or not fam_code:
                    continue
                item_families.setdefault(str(item_code), set()).add(str(fam_code))

            wb.close()

            inserted = 0
            batch = []
            batch_size = 500
            for item_code, fam_codes in item_families.items():
                model_names = sorted({family_name_map.get(fc, fc) for fc in fam_codes})
                model_str = ', '.join(model_names)
                if not model_str:
                    continue
                brand_names = sorted({family_brand_map[fc] for fc in fam_codes if fc in family_brand_map})
                brand_str = ', '.join(brand_names)
                batch.append({"code": item_code, "model": model_str, "brand": brand_str or None})
                if len(batch) >= batch_size:
                    self._insert_item_models_batch(db, batch)
                    inserted += len(batch)
                    batch = []
            if batch:
                self._insert_item_models_batch(db, batch)
                inserted += len(batch)

            db.commit()
            print(f"[WebBridge] item_models eşleşmesi tamamlandı. Toplam {inserted} parça kodu için model belirlendi.")
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] item_models senkronizasyon hatası: {e}")
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
                    serial_number VARCHAR(100) NOT NULL,
                    is_returned BOOLEAN DEFAULT FALSE,
                    return_reason VARCHAR(500),
                    returned_at TIMESTAMP WITH TIME ZONE,
                    return_location_id INTEGER REFERENCES warehouse.locations(id)
                );
            """))
            db.execute(text("ALTER TABLE warehouse.produced_units DROP CONSTRAINT IF EXISTS produced_units_serial_number_key;"))
            db.execute(text("ALTER TABLE warehouse.produced_units ADD COLUMN IF NOT EXISTS is_returned BOOLEAN DEFAULT FALSE;"))
            db.execute(text("ALTER TABLE warehouse.produced_units ADD COLUMN IF NOT EXISTS return_reason VARCHAR(500);"))
            db.execute(text("ALTER TABLE warehouse.produced_units ADD COLUMN IF NOT EXISTS returned_at TIMESTAMP WITH TIME ZONE;"))
            db.execute(text("ALTER TABLE warehouse.produced_units ADD COLUMN IF NOT EXISTS return_location_id INTEGER REFERENCES warehouse.locations(id);"))
            db.execute(text("ALTER TABLE warehouse.produced_units ADD COLUMN IF NOT EXISTS returned_materials VARCHAR(2000);"))
            db.execute(text("ALTER TABLE warehouse.produced_units ADD COLUMN IF NOT EXISTS replacement_requested_qty INTEGER DEFAULT 0;"))
            
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
            db.execute(text("UPDATE warehouse.work_orders SET status = 'URETIMDE' WHERE work_order_type = 'PRODUCTION' AND status = 'BEKLIYOR';"))
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
        (required_quantity + fire_quantity - issued_quantity) olarak hesaplanır.
        fire_quantity: teknisyenden fire olarak DOA Stock'a iade edilip sisteme
        işlenmiş miktardır (bkz. report_material_fire) — depocunun ek teslim
        yapabileceği miktarı, fire bildirilmeden büyütmeden, açar."""
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
            db.execute(text("ALTER TABLE warehouse.material_requests ADD COLUMN IF NOT EXISTS fire_quantity INTEGER NOT NULL DEFAULT 0;"))
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
            db.execute(text("ALTER TABLE warehouse.part_categories ADD COLUMN IF NOT EXISTS part_type VARCHAR(100);"))
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
            db.execute(text("ALTER TABLE warehouse.parts ADD COLUMN IF NOT EXISTS brand VARCHAR(100);"))
            db.execute(text("ALTER TABLE warehouse.parts ADD COLUMN IF NOT EXISTS model VARCHAR(100);"))
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
        fetch_url = f"/api_cache/{filename}"
        if os.path.exists(path):
            return json.dumps({"success": True, "fetch_url": fetch_url})
            
        from sqlalchemy import text
        db = SessionLocal()
        try:
            result = db.execute(text("""
                SELECT p.id, p.name, p.item_code, p.barcode, p.brand, p.model, p.color,
                       p.item_category, p.part_category_id,
                       COALESCE(pc.name, p.part_category) AS part_category,
                       COALESCE(NULLIF(p.part_type, ''), NULLIF(pc.part_type, ''), '') AS part_type,
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
            return json.dumps({"success": True, "fetch_url": fetch_url})
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
            bom_result = db.execute(text("""
                SELECT b.id, b.parent_item_id, b.child_item_id, b.quantity,
                       p_parent.name AS parent_name, p_parent.id AS parent_part_id,
                       p_child.name AS child_name, p_child.id AS child_part_id
                FROM warehouse.item_bom b
                LEFT JOIN warehouse.parts p_parent ON p_parent.item_code = b.parent_item_id
                LEFT JOIN warehouse.parts p_child ON p_child.item_code = b.child_item_id
                ORDER BY b.parent_item_id, b.child_item_id;
            """)).mappings().all()

            bom_map = {}
            for row in bom_result:
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

            # Reçetesi (BOM) olmayan ama 'Mamül' veya 'Yarı Mamül' olan parçaları da listeye ekle
            products = db.execute(text("""
                SELECT id, item_code, name 
                FROM warehouse.parts 
                WHERE part_type ILIKE '%Mamül%' OR part_type ILIKE '%Mamul%'
                   OR part_category ILIKE '%Mamül%' OR part_category ILIKE '%Mamul%'
                   OR item_category ILIKE '%Mamül%' OR item_category ILIKE '%Mamul%'
            """)).mappings().all()

            for p in products:
                parent_code = p["item_code"]
                if parent_code and parent_code not in bom_map:
                    bom_map[parent_code] = {
                        "parent_item_id": parent_code,
                        "parent_part_id": str(p["id"]),
                        "parent_name": p["name"] or parent_code,
                        "materials": []
                    }

            return json.dumps({"success": True, "item_boms": list(bom_map.values())}, ensure_ascii=False)
        except Exception as e:
            print(f"[WebBridge] get_item_boms hatası: {e}")
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, str, str, result=str)
    def get_product_boms(self, page="1", page_size="50", search_term="", model_filter="", status_filter=""):
        """Sayfalanmis (LIMIT/OFFSET) ve filtrelemeli sekilde doner."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            page = max(1, int(page or 1))
            page_size = min(1000, max(1, int(page_size or 50)))
            offset = (page - 1) * page_size

            where_clauses = []
            params = {"limit": page_size, "offset": offset}

            if search_term and str(search_term).strip():
                where_clauses.append("(b.product_model ILIKE :search OR b.child_item_code ILIKE :search OR p_child.name ILIKE :search)")
                params["search"] = f"%{str(search_term).strip()}%"

            if model_filter and str(model_filter).strip():
                where_clauses.append("b.product_model = :model_filter")
                params["model_filter"] = str(model_filter).strip()

            if status_filter and str(status_filter).strip() and str(status_filter).strip().lower() != "tümü":
                where_clauses.append("b.status = :status_filter")
                params["status_filter"] = str(status_filter).strip()

            where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

            count_sql = f"""
                SELECT COUNT(*)
                FROM warehouse.product_boms b
                LEFT JOIN warehouse.parts p_child ON p_child.item_code = b.child_item_code
                {where_sql};
            """
            total = db.execute(text(count_sql), params).scalar()

            data_sql = f"""
                SELECT b.id, b.product_model, b.child_item_code, b.quantity, b.status,
                       b.created_at, b.updated_at,
                       p_child.name AS child_name, p_child.id AS child_part_id
                FROM warehouse.product_boms b
                LEFT JOIN warehouse.parts p_child ON p_child.item_code = b.child_item_code
                {where_sql}
                ORDER BY b.product_model, b.child_item_code
                LIMIT :limit OFFSET :offset;
            """
            bom_result = db.execute(text(data_sql), params).mappings().all()

            boms = [{
                "id": row["id"],
                "product_model": row["product_model"],
                "child_item_code": row["child_item_code"],
                "child_part_id": str(row["child_part_id"]) if row["child_part_id"] else "",
                "child_name": row["child_name"] or row["child_item_code"],
                "quantity": int(row["quantity"]),
                "status": row["status"] or "Aktif",
                "created_at": row["created_at"].strftime("%d.%m.%Y %H:%M") if row["created_at"] else "-",
                "updated_at": row["updated_at"].strftime("%d.%m.%Y %H:%M") if row["updated_at"] else "-"
            } for row in bom_result]

            return json.dumps({
                "success": True,
                "boms": boms,
                "total": total,
                "page": page,
                "page_size": page_size
            }, ensure_ascii=False)
        except Exception as e:
            print(f"[WebBridge] get_product_boms hatası: {e}")
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, result=str)
    def create_product_bom(self, product_model, child_item_code, quantity):
        from models.product_bom import ProductBOM
        db = SessionLocal()
        try:
            new_bom = ProductBOM(
                product_model=product_model,
                child_item_code=child_item_code,
                quantity=int(quantity) if quantity else 1
            )
            db.add(new_bom)
            db.commit()
            return json.dumps({"success": True})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, str, result=str)
    def update_product_bom(self, bom_id, product_model, child_item_code, quantity):
        from models.product_bom import ProductBOM
        from datetime import datetime
        db = SessionLocal()
        try:
            bom = db.query(ProductBOM).filter(ProductBOM.id == int(bom_id)).first()
            if not bom:
                return json.dumps({"success": False, "message": "BOM bulunamadı."})
            
            bom.product_model = product_model
            bom.child_item_code = child_item_code
            bom.quantity = int(quantity) if quantity else 1
            bom.updated_at = datetime.now()
            db.commit()
            return json.dumps({"success": True})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, result=str)
    def delete_product_bom(self, bom_id):
        from models.product_bom import ProductBOM
        db = SessionLocal()
        try:
            bom = db.query(ProductBOM).filter(ProductBOM.id == int(bom_id)).first()
            if bom:
                db.delete(bom)
                db.commit()
                return json.dumps({"success": True})
            return json.dumps({"success": False, "message": "BOM bulunamadı"})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, result=str)
    def toggle_product_bom_status(self, bom_id):
        from models.product_bom import ProductBOM
        db = SessionLocal()
        try:
            bom = db.query(ProductBOM).filter(ProductBOM.id == int(bom_id)).first()
            if not bom:
                return json.dumps({"success": False, "message": "BOM kaydı bulunamadı."})
            
            # Toggle between Aktif and Pasif
            from datetime import datetime
            bom.status = "Pasif" if bom.status == "Aktif" else "Aktif"
            bom.updated_at = datetime.now()
            db.commit()
            return json.dumps({"success": True, "message": f"Durum '{bom.status}' olarak güncellendi."})
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] toggle_product_bom_status hatası: {e}")
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, result=str)
    def get_item_model(self, item_code):
        """Parça Kodu girildiğinde Model alanını otomatik doldurmak için warehouse.item_models
        (ProductBom/ProductFamily'den türetilmiş) ve mevcut parts kayıtlarını sorgular."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            code = (item_code or "").strip()
            if not code:
                return json.dumps({"success": False, "model": "", "brand": ""})

            row = db.execute(
                text("SELECT model, brand FROM warehouse.item_models WHERE item_code = :code"),
                {"code": code}
            ).first()
            if row and (row[0] or row[1]):
                return json.dumps({"success": True, "model": row[0] or "", "brand": row[1] or ""})

            row2 = db.execute(
                text("SELECT model, brand FROM warehouse.parts WHERE item_code = :code AND ((model IS NOT NULL AND model <> '') OR (brand IS NOT NULL AND brand <> '')) LIMIT 1"),
                {"code": code}
            ).first()
            if row2 and (row2[0] or row2[1]):
                return json.dumps({"success": True, "model": row2[0] or "", "brand": row2[1] or ""})

            return json.dumps({"success": False, "model": "", "brand": ""})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, result=str)
    def get_item_codes_by_model(self, model_name):
        """Ürün Ağacı (BOM) ekranında Model seçilince, Ana Parça/Alt Parça alanlarını
        sadece o modele ait parça kodlarıyla sınırlamak için warehouse.item_models'i
        (virgülle ayrılmış model listesi) sorgular."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            name = (model_name or "").strip()
            if not name:
                return json.dumps({"success": False, "item_codes": []})

            rows = db.execute(text("""
                SELECT item_code FROM warehouse.item_models
                WHERE :name = ANY(string_to_array(model, ', '))
                ORDER BY item_code
            """), {"name": name}).all()
            codes = [r[0] for r in rows]
            return json.dumps({"success": True, "item_codes": codes})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(result=str)
    def get_item_codes(self):
        """MioCreate.xlsx ProductBom sayfasından (warehouse.item_models üzerinden) bilinen
        tüm parça kodlarını döner. 'Yeni Stok Kartı Ekle' formundaki Parça Kodu alanı
        bu listeyi otomatik tamamlama (datalist) için kullanır."""
        filename = "item_codes.json"
        path = os.path.join(get_cache_dirs()[0], filename)
        fetch_url = f"http://localhost:5173/api_cache/{filename}" if os.getenv("DEV_MODE", "1") == "1" else f"/api_cache/{filename}"
        if os.path.exists(path):
            return json.dumps({"success": True, "fetch_url": fetch_url})

        from sqlalchemy import text
        db = SessionLocal()
        try:
            result = db.execute(text(
                "SELECT item_code FROM warehouse.item_models ORDER BY item_code"
            )).all()
            codes = [row[0] for row in result if row[0]]
            json_data = json.dumps({"success": True, "item_codes": codes})
            write_to_cache(filename, json_data)
            return json.dumps({"success": True, "fetch_url": fetch_url})
        except Exception as e:
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

            # Check if item_code already exists
            existing = db.execute(text("SELECT id FROM warehouse.parts WHERE item_code = :code"), {"code": code}).scalar()
            if existing:
                return json.dumps({
                    "success": False, 
                    "message": f"'{code}' kodlu parça zaten sistemde kayıtlı. Eklemek yerine arama çubuğundan bulup düzenleyebilirsiniz."
                })

            sql = """
                INSERT INTO warehouse.parts (name, item_code, barcode, brand, model, item_category, part_category, part_category_id, stock_tracking_type, department, status, critical_limit, memory, part_type)
                VALUES (:name, :code, :barcode, :brand, :model, :icat, :pcat, :pcat_id, :stt, :dept, :status, :critical_limit, :memory, :part_type)
            """
            if part_type in ["Labour", "Service", "Cost", "SparePartLabour", "Labor (İşçilik)", "Stoksuz Parça / Hizmet"]:
                stock_tracking_type = "Stok Takipsiz"
            
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
            if part_type in ["Labour", "Service", "Cost", "SparePartLabour", "Labor (İşçilik)", "Stoksuz Parça / Hizmet"]:
                stock_tracking_type = "Stok Takipsiz"

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
        """Belirtilen id'ye sahip parçayı siler (Stok miktarı 0 ise parçayı ve ilişkili tüm kayıtlarını temizler)."""
        from sqlalchemy import text, func
        from models.stock import Stock
        from models.location import Location
        db = SessionLocal()
        try:
            part_id = int(part_id_str)

            # Stok Miktarı Kontrolü — sadece fiziksel/depoda bulunan lokasyonlar sayılır
            # (Out Stock / Scrap Stock lokasyonlarındaki miktar, ürünün depodan çıktığının
            # kaydıdır; parçanın silinmesini engellememeli).
            total_stock_qty = db.query(func.coalesce(func.sum(Stock.quantity), 0)) \
                .join(Location, Stock.location_id == Location.id) \
                .filter(Stock.part_id == part_id, Location.kind.in_(("good_stock", "doa_stock", "repair_stock"))) \
                .scalar() or 0
            if total_stock_qty > 0:
                return json.dumps({"success": False, "message": f"Bu parçanın stokta {total_stock_qty} adet ürünü var. Silmeden önce stok miktarını sıfırlayınız."})

            # İrsaliye geçmişinde gösterilmeye devam etsin diye, parça silinmeden önce
            # görünen adının anlık görüntüsünü alıyoruz.
            part_row = db.execute(text("""
                SELECT item_code, brand, model, color, part_category, name
                FROM warehouse.parts WHERE id = :id
            """), {"id": part_id}).mappings().first()
            snapshot_name = _build_part_display_name(
                part_row.get("brand") if part_row else None,
                part_row.get("model") if part_row else None,
                part_row.get("color") if part_row else None,
                part_row.get("part_category") if part_row else None,
                part_row.get("name") if part_row else None,
                part_row.get("item_code") if part_row else None,
            )

            queries = [
                "DELETE FROM warehouse.stock WHERE part_id = :id",
                # İrsaliye geçmişi korunsun diye hareket kayıtları silinmiyor, sadece
                # silinen parçaya olan referans temizleniyor; ekranda isim anlık
                # görüntüsü + "(silindi)" ibaresiyle gösterilir.
                "UPDATE warehouse.stock_movements SET part_id = NULL, part_name_snapshot = :snapshot_name WHERE part_id = :id",
                "DELETE FROM warehouse.inbound_entries WHERE part_id = :id",
                "DELETE FROM warehouse.outbound_entries WHERE part_id = :id",
                "DELETE FROM warehouse.work_order_parts WHERE part_id = :id",
                "DELETE FROM warehouse.production_materials WHERE part_id = :id",
                "DELETE FROM warehouse.bom_items WHERE part_id = :id OR parent_item_id = :id",
                "DELETE FROM warehouse.item_bom WHERE part_id = :id OR parent_item_id = :id",
                "DELETE FROM warehouse.part_supplier_prices WHERE part_id = :id",
                "DELETE FROM warehouse.part_suppliers WHERE part_id = :id",
                "UPDATE warehouse.production_runs SET target_part_id = NULL WHERE target_part_id = :id",
                "UPDATE warehouse.work_orders SET target_part_id = NULL WHERE target_part_id = :id",
                "DELETE FROM warehouse.parts WHERE id = :id"
            ]

            for q in queries:
                try:
                    with db.begin_nested():
                        db.execute(text(q), {"id": part_id, "snapshot_name": snapshot_name})
                except Exception as ex:
                    logging.warning(f"delete_part subquery bypass: {ex}")

            db.commit()
            clear_api_cache()
            return json.dumps({"success": True, "message": "Parça başarıyla silindi."})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Silme hatası: {str(e)}"})
        finally:
            db.close()

    @Slot(str, result=str)
    def delete_parts_bulk(self, part_ids_csv):
        """Birden fazla parçayı toplu olarak siler."""
        from sqlalchemy import text, func
        from models.stock import Stock
        from models.location import Location
        db = SessionLocal()
        try:
            ids = [int(x.strip()) for x in part_ids_csv.split(",") if x.strip()]
            if not ids:
                return json.dumps({"success": False, "message": "Silinecek parça seçilmedi."})

            safe_ids = []
            skipped_count = 0
            for pid in ids:
                # Sadece fiziksel/depoda bulunan lokasyonlar sayılır (bkz. delete_part)
                total_stock_qty = db.query(func.coalesce(func.sum(Stock.quantity), 0)) \
                    .join(Location, Stock.location_id == Location.id) \
                    .filter(Stock.part_id == pid, Location.kind.in_(("good_stock", "doa_stock", "repair_stock"))) \
                    .scalar() or 0
                if total_stock_qty == 0:
                    safe_ids.append(pid)
                else:
                    skipped_count += 1
                    
            if not safe_ids:
                return json.dumps({"success": False, "message": "Seçilen parçaların tamamının stokta ürünü var. Önce stok miktarlarını sıfırlayınız."})
                
            queries = [
                "DELETE FROM warehouse.stock WHERE part_id = :id",
                # İrsaliye geçmişi korunsun diye hareket kayıtları silinmiyor, sadece
                # silinen parçaya olan referans temizleniyor; ekranda isim anlık
                # görüntüsü + "(silindi)" ibaresiyle gösterilir.
                "UPDATE warehouse.stock_movements SET part_id = NULL, part_name_snapshot = :snapshot_name WHERE part_id = :id",
                "DELETE FROM warehouse.inbound_entries WHERE part_id = :id",
                "DELETE FROM warehouse.outbound_entries WHERE part_id = :id",
                "DELETE FROM warehouse.work_order_parts WHERE part_id = :id",
                "DELETE FROM warehouse.production_materials WHERE part_id = :id",
                "DELETE FROM warehouse.bom_items WHERE part_id = :id OR parent_item_id = :id",
                "DELETE FROM warehouse.item_bom WHERE part_id = :id OR parent_item_id = :id",
                "DELETE FROM warehouse.part_supplier_prices WHERE part_id = :id",
                "DELETE FROM warehouse.part_suppliers WHERE part_id = :id",
                "UPDATE warehouse.production_runs SET target_part_id = NULL WHERE target_part_id = :id",
                "UPDATE warehouse.work_orders SET target_part_id = NULL WHERE target_part_id = :id",
                "DELETE FROM warehouse.parts WHERE id = :id"
            ]

            for pid in safe_ids:
                part_row = db.execute(text("""
                    SELECT item_code, brand, model, color, part_category, name
                    FROM warehouse.parts WHERE id = :id
                """), {"id": pid}).mappings().first()
                snapshot_name = _build_part_display_name(
                    part_row.get("brand") if part_row else None,
                    part_row.get("model") if part_row else None,
                    part_row.get("color") if part_row else None,
                    part_row.get("part_category") if part_row else None,
                    part_row.get("name") if part_row else None,
                    part_row.get("item_code") if part_row else None,
                )
                for q in queries:
                    try:
                        with db.begin_nested():
                            db.execute(text(q), {"id": pid, "snapshot_name": snapshot_name})
                    except Exception as ex:
                        logging.warning(f"delete_parts_bulk subquery bypass: {ex}")

            db.commit()
            clear_api_cache()
            
            msg = f"{len(safe_ids)} parça başarıyla silindi."
            if skipped_count > 0:
                msg += f" {skipped_count} adet parça stokta ürünü olduğu için silinemedi."
            return json.dumps({"success": True, "message": msg})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Silme hatası: {str(e)}"})
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

    @Slot(result=str)
    def get_product_families(self):
        """Aktif ürün ailesi (cihaz modeli) adlarını getirir. MioCreate.xlsx -> ProductFamily'den seed edilmiştir."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            rows = db.execute(text("""
                SELECT id, name
                FROM warehouse.product_families
                WHERE is_active IS TRUE
                ORDER BY name ASC
            """)).mappings().all()
            families = [{"id": r["id"], "name": r["name"]} for r in rows]
            return json.dumps({"success": True, "product_families": families})
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
                SELECT pc.id, pc.name, COALESCE(pc.part_type, '') AS part_type, COALESCE(pc.flow, '') AS flow,
                       pc.departments, pc.stock_tracking_type,
                       NULL AS default_location_id, '' AS default_location_name,
                       pc.is_active, pc.description
                FROM warehouse.part_categories pc
                ORDER BY pc.id DESC
            """)).mappings().all()
            categories = []
            for r in rows:
                categories.append({
                    "id": r["id"],
                    "name": r["name"],
                    "part_type": r["part_type"] or "",
                    "flow": r["flow"] or "",
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

    @Slot(str, str, str, str, str, str, str, result=str)
    def create_part_category(self, name, part_type, flow, departments, stock_tracking_type, default_location_id, description):
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
                part_type=part_type or None,
                flow=flow or None,
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

    @Slot(str, str, str, str, str, str, str, str, str, result=str)
    def update_part_category(self, id_str, name, part_type, flow, departments, stock_tracking_type, default_location_id, is_active, description):
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
            cat.part_type = part_type or None
            cat.flow = flow or None
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
                       brand, model, memory, product_code, imei_number, color, fault_category, fault_type,
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
                    "imei_number": row["imei_number"] or "",
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

    @Slot(str, str, str, str, str, str, str, str, str, str, str, str, str, str, str, str, result=str)
    def create_service_record(self, customer_name, customer_phone, customer_email, company,
                               brand, model, memory, product_code, imei_number, color, fault_category, fault_type,
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
                    brand, model, memory, product_code, imei_number, color, fault_category, fault_type,
                    customer_complaint, preliminary_diagnosis, status, technician_note
                ) VALUES (
                    :name, :phone, :email, :company,
                    :brand, :model, :memory, :code, :imei, :color, :fcat, :ftype,
                    :complaint, :diagnosis, :status, :note
                )
            """), {
                "name": name, "phone": customer_phone or None, "email": customer_email or None,
                "company": company or None, "brand": brand or None, "model": model or None,
                "memory": memory or None, "code": product_code or None, "imei": imei_number or None, "color": color or None,
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

    @Slot(str, str, str, str, str, str, str, str, str, str, str, str, str, str, str, str, str, result=str)
    def update_service_record(self, record_id_str, customer_name, customer_phone, customer_email, company,
                               brand, model, memory, product_code, imei_number, color, fault_category, fault_type,
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
                    brand = :brand, model = :model, memory = :memory, product_code = :code, imei_number = :imei, color = :color,
                    fault_category = :fcat, fault_type = :ftype,
                    customer_complaint = :complaint, preliminary_diagnosis = :diagnosis,
                    status = :status, technician_note = :note
                WHERE id = :id
            """), {
                "name": name, "phone": customer_phone or None, "email": customer_email or None,
                "company": company or None, "brand": brand or None, "model": model or None,
                "memory": memory or None, "code": product_code or None, "imei": imei_number or None, "color": color or None,
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

    @Slot(result=str)
    def generate_customer_bulk_template(self):
        """Müşteriler sayfası toplu (Excel) yükleme şablonunu üretir. Cihaz Modeli ve Flow
        (İş Akışı) sütunlarına Excel Data Validation ile açılır liste eklenir; zorunlu
        sütun başlıkları kırmızı ile işaretlenir. export_table_to_excel ile aynı
        konvansiyonu kullanır: Downloads klasörüne kaydeder ve dosyayı otomatik açar."""
        import os
        from pathlib import Path
        from sqlalchemy import text
        import openpyxl
        from openpyxl.worksheet.datavalidation import DataValidation
        from openpyxl.styles import Font, PatternFill, Alignment
        from core.excel_utils import style_excel_file

        db = SessionLocal()
        try:
            model_rows = db.execute(text("""
                SELECT DISTINCT brand, model FROM warehouse.products
                WHERE brand IS NOT NULL AND model IS NOT NULL AND brand <> '' AND model <> ''
                ORDER BY brand, model
            """)).mappings().all()
            device_models = [f"{r['brand']} {r['model']}".strip() for r in model_rows] or ["Tanımlı ürün bulunamadı"]

            wb = openpyxl.Workbook()
            sheet = wb.active
            sheet.title = "Toplu Cihaz Girişi"

            headers = [c[0] for c in CUSTOMER_BULK_REQUIRED_COLUMNS] + [
                "Müşteri Adı", "Müşteri Telefon", "Müşteri E-posta", "Firma"
            ]
            required_col_count = len(CUSTOMER_BULK_REQUIRED_COLUMNS)
            sheet.append(headers)

            # Örnek satır, kullanıcıya beklenen formatı gösterir.
            sheet.append([
                "353XXXXXXXXXXXX", "SN-000123", "INT-000123",
                device_models[0], CUSTOMER_FLOW_VALUES[0],
                "Ekran kırık, dokunmatik çalışmıyor", "2026-01-15",
                "Ahmet Yılmaz", "05XXXXXXXXX", "", ""
            ])

            max_data_row = 500

            # Gizli "Listeler" sayfası: dropdown kaynakları buradan referans alınır
            # (Cihaz Modeli listesi 255 karakter inline sınırını aşabileceği için).
            list_sheet = wb.create_sheet("Listeler")
            list_sheet["A1"] = "Cihaz Modelleri"
            for i, dm in enumerate(device_models, start=2):
                list_sheet.cell(row=i, column=1, value=dm)
            list_sheet.sheet_state = "hidden"

            model_range = f"Listeler!$A$2:$A${len(device_models) + 1}"
            model_dv = DataValidation(type="list", formula1=f"={model_range}", allow_blank=True, showErrorMessage=True)
            model_dv.error = "Lütfen listeden geçerli bir Cihaz Modeli seçin."
            model_dv.errorTitle = "Geçersiz Cihaz Modeli"
            sheet.add_data_validation(model_dv)

            flow_list = ",".join(CUSTOMER_FLOW_VALUES)
            flow_dv = DataValidation(type="list", formula1=f'"{flow_list}"', allow_blank=True, showErrorMessage=True)
            flow_dv.error = "Lütfen listeden geçerli bir Flow (İş Akışı) değeri seçin."
            flow_dv.errorTitle = "Geçersiz Flow"
            sheet.add_data_validation(flow_dv)

            model_col_letter = openpyxl.utils.get_column_letter(headers.index("Cihaz Modeli") + 1)
            flow_col_letter = openpyxl.utils.get_column_letter(headers.index("Flow (İş Akışı)") + 1)
            model_dv.add(f"{model_col_letter}2:{model_col_letter}{max_data_row}")
            flow_dv.add(f"{flow_col_letter}2:{flow_col_letter}{max_data_row}")

            # Giriş Tarihi sütununu metin olarak biçimlendir (kullanıcı YYYY-AA-GG girer);
            # Excel'in kendi tarih otomatik-biçimlendirmesiyle karışmasın diye.
            intake_col_letter = openpyxl.utils.get_column_letter(headers.index("Giriş Tarihi") + 1)
            for row_idx in range(2, max_data_row + 1):
                sheet[f"{intake_col_letter}{row_idx}"].number_format = "@"

            downloads_path = str(Path.home() / "Downloads")
            filename = "musteriler_toplu_yukleme_sablonu.xlsx"
            file_path = os.path.join(downloads_path, filename)
            counter = 1
            base_name, ext = os.path.splitext(filename)
            while os.path.exists(file_path):
                file_path = os.path.join(downloads_path, f"{base_name}_{counter}{ext}")
                counter += 1

            wb.save(file_path)

            try:
                style_excel_file(file_path)
            except Exception:
                pass

            # Zorunlu sütun başlıklarını kırmızıyla vurgula (style_excel_file'dan SONRA,
            # üzerine yazılmasın diye tekrar açıp kaydediyoruz).
            wb2 = openpyxl.load_workbook(file_path)
            sheet2 = wb2["Toplu Cihaz Girişi"]
            required_fill = PatternFill(start_color="B71C1C", end_color="B71C1C", fill_type="solid")
            for col_idx in range(1, required_col_count + 1):
                cell = sheet2.cell(row=1, column=col_idx)
                cell.value = f"{cell.value} *"
                cell.fill = required_fill
                cell.font = Font(name="Segoe UI", color="FFFFFF", bold=True, size=11)
                cell.alignment = Alignment(horizontal="center", vertical="center")
            sheet2["A3"] = "(*) işaretli sütunlar zorunludur. Örnek satırı (2. satır) silip kendi verilerinizi girin."
            wb2.save(file_path)

            os.startfile(file_path)
            return json.dumps({"success": True})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, result=str)
    def bulk_import_customers(self, rows_json):
        """Toplu (Excel) müşteri/cihaz kabul içe aktarma. Tüm satırları önce doğrular;
        herhangi bir satırda herhangi bir zorunlu alan eksikse veya geçersizse HİÇBİR
        satır kaydedilmez, tüm hatalar satır numarasıyla birlikte tek seferde döner."""
        from sqlalchemy import text
        from datetime import datetime
        db = SessionLocal()
        try:
            try:
                rows = json.loads(rows_json or "[]")
            except (ValueError, TypeError):
                return json.dumps({"success": False, "message": "Geçersiz dosya verisi.", "errors": []})

            if not rows:
                return json.dumps({"success": False, "message": "Dosyada içe aktarılacak satır bulunamadı.", "errors": []})

            # Cihaz Modeli -> (brand, model, product_code) eşlemesi için ürün listesini çek.
            product_rows = db.execute(text("""
                SELECT brand, model, item_code FROM warehouse.products
                WHERE brand IS NOT NULL AND model IS NOT NULL
            """)).mappings().all()
            model_lookup = {f"{r['brand']} {r['model']}".strip().lower(): r for r in product_rows}

            existing_imeis = {r[0] for r in db.execute(text(
                "SELECT imei_number FROM warehouse.customers WHERE imei_number IS NOT NULL"
            )).all()}
            existing_serials = {r[0] for r in db.execute(text(
                "SELECT serial_number FROM warehouse.customers WHERE serial_number IS NOT NULL"
            )).all()}

            errors = []
            seen_imeis_in_file = {}
            seen_serials_in_file = {}
            valid_rows = []

            for idx, row in enumerate(rows):
                row_num = idx + 2  # 1. satır başlık; ilk veri satırı Excel'de 2. satır
                row = row or {}

                def get_val(key):
                    v = row.get(key)
                    return str(v).strip() if v is not None else ""

                imei = get_val("imei_number")
                serial = get_val("serial_number")
                internal_id = get_val("internal_id")
                cihaz_modeli = get_val("cihaz_modeli")
                flow = get_val("flow")
                complaint = get_val("customer_reported_complaint")
                intake_date = get_val("intake_date")

                for label, value in [
                    ("IMEI Numarası", imei), ("Seri Numarası", serial), ("Internal ID", internal_id),
                    ("Cihaz Modeli", cihaz_modeli), ("Flow (İş Akışı)", flow),
                    ("Müşteri Şikayeti", complaint), ("Giriş Tarihi", intake_date)
                ]:
                    if not value:
                        errors.append({"row": row_num, "field": label, "message": f"{label} boş olamaz."})

                if flow and flow not in CUSTOMER_FLOW_VALUES:
                    errors.append({"row": row_num, "field": "Flow (İş Akışı)", "message": f"Geçersiz değer: \"{flow}\". Geçerli değerler: {', '.join(CUSTOMER_FLOW_VALUES)}"})

                product = None
                if cihaz_modeli:
                    product = model_lookup.get(cihaz_modeli.strip().lower())
                    if not product:
                        errors.append({"row": row_num, "field": "Cihaz Modeli", "message": f"\"{cihaz_modeli}\" sistemde tanımlı bir ürün değil."})

                if intake_date:
                    try:
                        datetime.strptime(intake_date[:10], "%Y-%m-%d")
                    except ValueError:
                        errors.append({"row": row_num, "field": "Giriş Tarihi", "message": f"\"{intake_date}\" geçerli bir tarih değil (YYYY-AA-GG bekleniyor)."})

                if imei:
                    if imei in existing_imeis:
                        errors.append({"row": row_num, "field": "IMEI Numarası", "message": f"\"{imei}\" zaten sistemde kayıtlı."})
                    elif imei in seen_imeis_in_file:
                        errors.append({"row": row_num, "field": "IMEI Numarası", "message": f"\"{imei}\" dosyada birden fazla satırda tekrarlanıyor (satır {seen_imeis_in_file[imei]})."})
                    else:
                        seen_imeis_in_file[imei] = row_num

                if serial:
                    if serial in existing_serials:
                        errors.append({"row": row_num, "field": "Seri Numarası", "message": f"\"{serial}\" zaten sistemde kayıtlı."})
                    elif serial in seen_serials_in_file:
                        errors.append({"row": row_num, "field": "Seri Numarası", "message": f"\"{serial}\" dosyada birden fazla satırda tekrarlanıyor (satır {seen_serials_in_file[serial]})."})
                    else:
                        seen_serials_in_file[serial] = row_num

                valid_rows.append({
                    "imei_number": imei or None, "serial_number": serial or None, "internal_id": internal_id or None,
                    "flow": flow or None, "customer_reported_complaint": complaint or None,
                    "intake_date": intake_date[:10] if intake_date else None,
                    "brand": product["brand"] if product else None,
                    "model": product["model"] if product else None,
                    "product_code": product["item_code"] if product else None,
                    "customer_name": get_val("customer_name") or None,
                    "customer_phone": get_val("customer_phone") or None,
                    "customer_email": get_val("customer_email") or None,
                    "company": get_val("company") or None,
                })

            if errors:
                return json.dumps({"success": False, "message": f"{len(errors)} hata bulundu, hiçbir satır içe aktarılmadı.", "errors": errors})

            for r in valid_rows:
                db.execute(text("""
                    INSERT INTO warehouse.customers (
                        imei_number, serial_number, internal_id, flow, customer_reported_complaint,
                        intake_date, brand, model, product_code,
                        customer_name, customer_phone, customer_email, company
                    ) VALUES (
                        :imei_number, :serial_number, :internal_id, :flow, :customer_reported_complaint,
                        :intake_date, :brand, :model, :product_code,
                        :customer_name, :customer_phone, :customer_email, :company
                    )
                """), r)

            db.commit()
            return json.dumps({"success": True, "message": f"{len(valid_rows)} müşteri kaydı başarıyla içe aktarıldı.", "imported": len(valid_rows)})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"İçe aktarma hatası: {str(e)}", "errors": []})
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
                       w.started_at, w.completed_at, w.produced_quantity, w.scrap_quantity, w.production_notes, w.department,
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
                    "department": row["department"] or "",
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
                        target_id = _get_system_location_id(db, "out_stock")
                        movement_kind = "Outbound"
                        mov_type = "Servis Tamamlandı: Out Stock'a Alındı"
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

    @Slot(str, str, str, str, str, str, result=str)
    def create_production_work_order(self, target_part_id, description, priority, planned_quantity, assigned_technician, department):
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

            if not planned_quantity or not planned_quantity.strip():
                return json.dumps({"success": False, "message": "Planlanan Üretim Adedi zorunludur."})
            try:
                qty = int(planned_quantity)
            except (ValueError, TypeError):
                return json.dumps({"success": False, "message": "Planlanan Üretim Adedi geçerli bir sayı olmalıdır."})
            if qty <= 0:
                return json.dumps({"success": False, "message": "Planlanan Üretim Adedi sıfırdan büyük olmalıdır."})
            multiplier = qty

            new_id = db.execute(text("""
                INSERT INTO warehouse.work_orders (
                    work_order_type, target_part_id, description, priority, planned_quantity,
                    assigned_technician, department, status
                ) VALUES (
                    :wtype, :target, :desc, :priority, :qty, :tech, :dept, :status
                ) RETURNING id
            """), {
                "wtype": WORK_ORDER_TYPE_PRODUCTION,
                "target": part_id,
                "desc": description or None,
                "priority": priority or "Orta",
                "qty": qty,
                "tech": assigned_technician or None,
                "dept": department or None,
                "status": PRODUCTION_WO_STATUS_IN_PRODUCTION
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
    # PRODUCTION WORK ORDER YAŞAM DÖNGÜSÜ (URETIMDE -> TAMAMLANDI)
    # Sadece PRODUCTION tipi work order'lar için çalışır; Service Work Order'ın kendi
    # status akışını (create_work_order/update_work_order) hiç etkilemez. Bir iş emri
    # oluşturulduğu anda doğrudan URETIMDE durumunda başlar (ayrı bir "Başlat" adımı
    # yoktur -- malzeme teslimi zaten Malzeme Talepleri panelindeki limit/durum
    # kontrolüyle yönetiliyor, ek bir manuel adım gereksiz görüldü).
    # ==========================

    @Slot(str, str, result=str)
    def start_production_work_order(self, work_order_id_str, username):
        """PRODUCTION tipi bir iş emrini BEKLIYOR durumundan URETIMDE durumuna geçirir.
        (Geçmişten kalan BEKLIYOR durumundaki iş emirlerinin başlatılabilmesi için eklendi)."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            work_order_id = int(work_order_id_str)
            
            row = db.execute(
                text("SELECT status, work_order_type FROM warehouse.work_orders WHERE id = :id FOR UPDATE"),
                {"id": work_order_id}
            ).mappings().first()
            
            if not row:
                return json.dumps({"success": False, "message": "İş emri bulunamadı."})
                
            if row["work_order_type"] != WORK_ORDER_TYPE_PRODUCTION:
                return json.dumps({"success": False, "message": "Sadece üretim iş emirleri başlatılabilir."})
                
            if row["status"] != PRODUCTION_WO_STATUS_WAITING:
                return json.dumps({"success": False, "message": f"Bu iş emri {PRODUCTION_WO_STATUS_WAITING} durumunda değil (şu an: {row['status']})."})
                
            db.execute(text("""
                UPDATE warehouse.work_orders 
                SET status = :status, started_at = CURRENT_TIMESTAMP
                WHERE id = :id
            """), {"status": PRODUCTION_WO_STATUS_IN_PRODUCTION, "id": work_order_id})
            
            db.commit()
            return json.dumps({"success": True, "message": "İş emri üretime alındı."})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Başlatma hatası: {str(e)}"})
        finally:
            db.close()


    @Slot(str, str, str, str, str, result=str)
    def complete_production_work_order(self, work_order_id_str, produced_quantity_str, scrap_quantity_str, production_notes, username):
        """PRODUCTION tipi bir iş emrini URETIMDE durumundan TAMAMLANDI durumuna geçirir.
        Üretilen Adet + Fire Adedi, Planlanan Üretim'e eşit olmak zorundadır; değilse
        işlem reddedilir ve hiçbir kayıt değişmez. Üretilen Adet kadar hedef parça Good
        Stock'a eklenir; Fire Adedi kadar hedef parça Scrap Stock'a eklenir (bu, hammadde
        fire'ından farklıdır -- burada bahsedilen, sonuçta kullanılamaz çıkan bitmiş
        ürün miktarıdır). Üretilen Adet > 0 ise, "Hızlı Üretim" (create_production_run)
        ile aynı production_runs/produced_units/production_materials kayıtları açılır ki
        Üretim Raporu'nda görünsün ve aynı iade/değişim akışıyla (delete_production_run)
        yönetilebilsin. Tüketilen hammadde miktarı, her Material Request'in
        (issued_quantity - fire_quantity) değerinden hesaplanır."""
        from sqlalchemy import text
        from models.stock import Stock
        from models.stock_movement import StockMovement
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
                text("""SELECT id, work_order_type, status, planned_quantity, target_part_id
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
            target_part_id = row["target_part_id"]
            if produced_quantity + scrap_quantity != planned_quantity:
                return json.dumps({
                    "success": False,
                    "message": f"Üretilen Adet ({produced_quantity}) + Fire Adedi ({scrap_quantity}) = {produced_quantity + scrap_quantity}, "
                                f"Planlanan Üretim'e ({planned_quantity}) eşit olmalıdır."
                })

            good_stock_id = _get_system_location_id(db, "good_stock")
            scrap_stock_id = _get_system_location_id(db, "scrap_stock")
            wip_stock_id = _get_system_location_id(db, "repair_stock")  # Redirect WIP to repair_stock
            if not good_stock_id:
                return json.dumps({"success": False, "message": "Good Stock deposu bulunamadı."})
            if scrap_quantity > 0 and not scrap_stock_id:
                return json.dumps({"success": False, "message": "Scrap Stock deposu bulunamadı."})
            if not wip_stock_id:
                return json.dumps({"success": False, "message": "Repair Stock deposu bulunamadı."})

            # Tüketilen hammaddeler: her malzeme talebinin fiilen üretime giden kısmı
            # (issued - fire). Fire olarak DOA'ya iade edilenler zaten oradan çıkarılmıştı.
            material_rows = db.execute(text("""
                SELECT part_id, issued_quantity, fire_quantity, required_quantity
                FROM warehouse.material_requests
                WHERE work_order_id = :wid
            """), {"wid": work_order_id}).mappings().all()

            # KONTROL: Teknisyene verilen net malzeme (issued - fire), üretimi tamamlamak için yeterli mi?
            for mr in material_rows:
                net_issued = mr["issued_quantity"] - mr["fire_quantity"]
                required = mr["required_quantity"]
                if net_issued < required:
                    part_name = db.execute(text("SELECT name FROM warehouse.parts WHERE id = :pid"), {"pid": mr["part_id"]}).scalar()
                    return json.dumps({
                        "success": False, 
                        "message": f"Teknisyene verilen malzeme yetersiz! {part_name} için en az {required} adet teslim edilmeli (Şu anki net teslim: {net_issued})."
                    })

            net_materials = [(m["part_id"], m["issued_quantity"] - m["fire_quantity"]) for m in material_rows if (m["issued_quantity"] - m["fire_quantity"]) > 0]

            if produced_quantity > 0:
                existing = db.execute(text("""
                    SELECT id FROM warehouse.stock WHERE part_id = :pid AND location_id = :lid
                """), {"pid": target_part_id, "lid": good_stock_id}).first()
                if existing:
                    db.execute(text("UPDATE warehouse.stock SET quantity = quantity + :qty WHERE id = :id"),
                               {"qty": produced_quantity, "id": existing[0]})
                else:
                    db.execute(text("""
                        INSERT INTO warehouse.stock (part_id, location_id, quantity) VALUES (:pid, :lid, :qty)
                    """), {"pid": target_part_id, "lid": good_stock_id, "qty": produced_quantity})

                run_id = db.execute(text("""
                    INSERT INTO warehouse.production_runs (target_part_id, quantity_produced, source_location_id, location_id, produced_by, notes)
                    VALUES (:tgt, :qty, :slid, :tlid, :by, :notes) RETURNING id
                """), {
                    "tgt": target_part_id, "qty": produced_quantity, "slid": good_stock_id, "tlid": good_stock_id,
                    "by": username or None, "notes": f"Üretim İş Emri #{work_order_id} tamamlandı (Fire: {scrap_quantity} adet)" + (f" - {production_notes}" if production_notes else "")
                }).scalar()

                next_id = db.execute(text("SELECT nextval(pg_get_serial_sequence('warehouse.produced_units', 'id'))")).scalar()
                serial_num = f"{next_id:015d}"
                db.execute(text("""
                    INSERT INTO warehouse.produced_units (id, production_run_id, serial_number)
                    VALUES (:id, :run_id, :serial)
                """), {"id": next_id, "run_id": run_id, "serial": serial_num})

                for part_id, qty_consumed in net_materials:
                    db.execute(text("""
                        INSERT INTO warehouse.production_materials (production_run_id, part_id, quantity_consumed)
                        VALUES (:run_id, :pid, :qty)
                    """), {"run_id": run_id, "pid": part_id, "qty": qty_consumed})
                    
                    # Deduct from Repair Stock
                    wip_stock_entry = db.query(Stock).filter(Stock.part_id == part_id, Stock.location_id == wip_stock_id).first()
                    if wip_stock_entry:
                        wip_stock_entry.quantity -= qty_consumed
                        
                    db.add(StockMovement(
                        type="Üretim İçin Malzeme Tüketimi",
                        movement_kind="Outbound",
                        quantity=qty_consumed,
                        part_id=part_id,
                        source_location_id=wip_stock_id,
                        created_by=username or None,
                        description=f"İş Emri {work_order_id:015d} tamamlandı, malzemeler tüketildi"
                    ))

                db.add(StockMovement(
                    type="Üretim",
                    movement_kind="Inbound",
                    quantity=produced_quantity,
                    part_id=target_part_id,
                    target_location_id=good_stock_id,
                    created_by=username or None,
                    description=f"Üretim İş Emri #{work_order_id} ({serial_num}) tamamlandı"
                ))

            if scrap_quantity > 0:
                existing_scrap = db.execute(text("""
                    SELECT id FROM warehouse.stock WHERE part_id = :pid AND location_id = :lid
                """), {"pid": target_part_id, "lid": scrap_stock_id}).first()
                if existing_scrap:
                    db.execute(text("UPDATE warehouse.stock SET quantity = quantity + :qty WHERE id = :id"),
                               {"qty": scrap_quantity, "id": existing_scrap[0]})
                else:
                    db.execute(text("""
                        INSERT INTO warehouse.stock (part_id, location_id, quantity) VALUES (:pid, :lid, :qty)
                    """), {"pid": target_part_id, "lid": scrap_stock_id, "qty": scrap_quantity})

                db.add(StockMovement(
                    type="Üretim Fire (Hurda)",
                    movement_kind="Inbound",
                    quantity=scrap_quantity,
                    part_id=target_part_id,
                    target_location_id=scrap_stock_id,
                    created_by=username or None,
                    description=f"Üretim İş Emri #{work_order_id} tamamlanırken fire çıkan {scrap_quantity} adet hurdaya ayrıldı"
                ))

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
        aşamada yapılmaz. remaining_quantity, (required_quantity + fire_quantity -
        issued_quantity) olarak canlı hesaplanır -- fire_quantity, bildirilmiş fire
        kadar ek teslim hakkı açar (bkz. report_material_fire). unit_quantity (reçetedeki
        birim başına miktar), required_quantity // planned_quantity olarak hesaplanır --
        bu, iş emri oluşturulduğu andaki değeri yansıtır; reçete sonradan değişmiş olsa
        bile bu iş emri için kullanılan orijinal değeri gösterir."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            work_order_id = int(work_order_id_str)
            rows = db.execute(text("""
                SELECT mr.id, mr.work_order_id, mr.part_id,
                       mr.required_quantity, mr.issued_quantity, mr.fire_quantity,
                       (mr.required_quantity + mr.fire_quantity - mr.issued_quantity) AS remaining_quantity,
                       mr.status, mr.created_at,
                       p.item_code, p.name AS part_name_raw, p.brand, p.model, p.color, p.part_category,
                       wo.planned_quantity
                FROM warehouse.material_requests mr
                LEFT JOIN warehouse.parts p ON p.id = mr.part_id
                LEFT JOIN warehouse.work_orders wo ON wo.id = mr.work_order_id
                WHERE mr.work_order_id = :wid
                ORDER BY mr.id ASC
            """), {"wid": work_order_id}).mappings().all()

            requests = []
            for row in rows:
                part_name = " ".join(filter(None, [row["brand"], row["model"], row["color"], row["part_category"]])) or (row["part_name_raw"] or "")
                planned_qty = row["planned_quantity"]
                unit_quantity = (row["required_quantity"] // planned_qty) if planned_qty else None
                requests.append({
                    "id": str(row["id"]),
                    "work_order_id": str(row["work_order_id"]),
                    "part_id": str(row["part_id"]),
                    "part_name": part_name,
                    "item_code": row["item_code"] or "",
                    "unit_quantity": unit_quantity,
                    "required_quantity": row["required_quantity"],
                    "issued_quantity": row["issued_quantity"],
                    "fire_quantity": row["fire_quantity"],
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
        PARTIAL -> ISSUED, issued_quantity/(required_quantity + fire_quantity) oranına
        göre otomatik hesaplanır. fire_quantity, bildirilmiş fire kadar ek teslim hakkı
        açar (bkz. report_material_fire) -- fire bildirilmeden limit büyümez. Stok
        yetersizse işlem iptal edilir, hiçbir kayıt değişmez. Başarılı teslimde bir
        StockMovement kaydı açılır. Sadece PRODUCTION tipi Work Order'lara aittir;
        Service Work Order akışını hiçbir şekilde etkilemez. Üretim tamamlama, yarı
        mamul oluşturma bu aşamada yapılmaz."""
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
                text("""SELECT id, work_order_id, part_id, required_quantity, issued_quantity, fire_quantity, status
                        FROM warehouse.material_requests WHERE id = :id FOR UPDATE"""),
                {"id": mr_id}
            ).mappings().first()
            if not row:
                return json.dumps({"success": False, "message": "Malzeme talebi bulunamadı."})

            wo_row = db.execute(
                text("SELECT work_order_type, status FROM warehouse.work_orders WHERE id = :id"),
                {"id": row["work_order_id"]}
            ).mappings().first()
            wo_type = wo_row["work_order_type"] if wo_row else None
            if wo_type != WORK_ORDER_TYPE_PRODUCTION:
                return json.dumps({"success": False, "message": "Malzeme teslimi sadece Production Work Order'lar için yapılabilir."})
            if wo_row["status"] != PRODUCTION_WO_STATUS_IN_PRODUCTION:
                return json.dumps({"success": False, "message": f"Malzeme teslimi sadece {PRODUCTION_WO_STATUS_IN_PRODUCTION} durumundaki iş emirleri için yapılabilir (şu an: {wo_row['status']})."})

            effective_limit = row["required_quantity"] + row["fire_quantity"]
            remaining = effective_limit - row["issued_quantity"]
            if quantity > remaining:
                return json.dumps({"success": False, "message": f"Kalan miktardan ({remaining}) fazla teslim edilemez."})

            good_stock_id = _get_system_location_id(db, "good_stock")
            wip_stock_id = _get_system_location_id(db, "repair_stock")  # Redirect WIP to repair_stock
            if not good_stock_id:
                return json.dumps({"success": False, "message": "Good Stock deposu bulunamadı."})
            if not wip_stock_id:
                return json.dumps({"success": False, "message": "Repair Stock deposu bulunamadı."})

            stock = db.query(Stock).filter(Stock.part_id == row["part_id"], Stock.location_id == good_stock_id).first()
            available = stock.quantity if stock else 0
            if available < quantity:
                return json.dumps({"success": False, "message": f"Good Stock'ta yeterli stok yok. Mevcut: {available}, İstenen: {quantity}."})

            stock.quantity -= quantity
            
            wip_stock_entry = db.query(Stock).filter(Stock.part_id == row["part_id"], Stock.location_id == wip_stock_id).first()
            if wip_stock_entry:
                wip_stock_entry.quantity += quantity
            else:
                db.add(Stock(part_id=row["part_id"], location_id=wip_stock_id, quantity=quantity))

            db.add(StockMovement(
                type="Üretim İçin Malzeme Teslimi",
                movement_kind="Transfer",
                quantity=quantity,
                part_id=row["part_id"],
                source_location_id=good_stock_id,
                target_location_id=wip_stock_id,
                created_by=username or None,
                technician=username or None,
                description=f"Hedef: İş Emri {row['work_order_id']:015d} - Material Request #{mr_id} teslimi"
            ))

            new_issued = row["issued_quantity"] + quantity
            new_status = _compute_material_request_status(new_issued, effective_limit)

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
                "remaining_quantity": effective_limit - new_issued,
                "status": new_status
            })
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Teslim hatası: {str(e)}"})
        finally:
            db.close()

    @Slot(str, str, str, result=str)
    def report_material_fire(self, mr_id_str, fire_qty_str, username):
        """Bir Material Request'e ait, teknisyenden fire (kullanılamayan/bozuk) olarak
        geri gelen malzemeyi DOA Stock'a iade eder ve fire_quantity'yi artırır."""
        from sqlalchemy import text
        from models.stock import Stock
        from models.stock_movement import StockMovement
        db = SessionLocal()
        try:
            mr_id = int(mr_id_str)
            try:
                fire_qty = int(fire_qty_str)
            except (ValueError, TypeError):
                fire_qty = 0
            if fire_qty <= 0:
                return json.dumps({"success": False, "message": "Fire miktarı 0'dan büyük olmalıdır."})

            row = db.execute(
                text("""SELECT id, work_order_id, part_id, issued_quantity, fire_quantity
                        FROM warehouse.material_requests WHERE id = :id FOR UPDATE"""),
                {"id": mr_id}
            ).mappings().first()
            if not row:
                return json.dumps({"success": False, "message": "Malzeme talebi bulunamadı."})

            unaccounted = row["issued_quantity"] - row["fire_quantity"]
            if fire_qty > unaccounted:
                return json.dumps({"success": False, "message": f"En fazla {unaccounted} adet fire bildirebilirsiniz (teslim edilmiş, henüz fire işlenmemiş miktarı aşamaz)."})

            doa_stock_id = _get_system_location_id(db, "doa_stock")
            repair_stock_id = _get_system_location_id(db, "repair_stock")
            if not doa_stock_id:
                return json.dumps({"success": False, "message": "DOA Stock deposu bulunamadı."})
            if not repair_stock_id:
                return json.dumps({"success": False, "message": "Repair Stock deposu bulunamadı."})

            repair_stock_entry = db.query(Stock).filter(Stock.part_id == row["part_id"], Stock.location_id == repair_stock_id).first()
            if repair_stock_entry:
                repair_stock_entry.quantity -= fire_qty

            doa_stock = db.query(Stock).filter(Stock.part_id == row["part_id"], Stock.location_id == doa_stock_id).first()
            if doa_stock:
                doa_stock.quantity += fire_qty
            else:
                db.add(Stock(part_id=row["part_id"], location_id=doa_stock_id, quantity=fire_qty))

            db.add(StockMovement(
                type="Fire İadesi",
                movement_kind="Transfer",
                quantity=fire_qty,
                part_id=row["part_id"],
                source_location_id=repair_stock_id,
                target_location_id=doa_stock_id,
                created_by=username or None,
                technician=username or None,
                description=f"Kaynak: İş Emri {row['work_order_id']:015d} - Material Request #{mr_id} fire iadesi"
            ))

            new_fire_total = row["fire_quantity"] + fire_qty
            db.execute(text("""
                UPDATE warehouse.material_requests
                SET fire_quantity = :fire
                WHERE id = :id
            """), {"fire": new_fire_total, "id": mr_id})

            db.commit()
            return json.dumps({
                "success": True,
                "message": "Fire bildirildi ve DOA stoğa iade edildi",
                "fire_quantity": new_fire_total
            })
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Fire bildirme hatası: {str(e)}"})
        finally:
            db.close()

    @Slot(str, str, str, str, result=str)
    def return_bom_part_to_doa(self, part_id_str, return_qty_str, source_location_id_str, username):
        """Hızlı Tekrar Üretim (BOM) reçetesindeki bir parçayı seçili lokasyondan DOA Stock'a iade eder."""
        from sqlalchemy import text
        from models.stock import Stock
        from models.stock_movement import StockMovement
        db = SessionLocal()
        try:
            part_id = int(part_id_str)
            try:
                return_qty = int(return_qty_str)
            except (ValueError, TypeError):
                return_qty = 0
            if return_qty <= 0:
                return json.dumps({"success": False, "message": "İade miktarı 0'dan büyük olmalıdır."})
            
            source_location_id = int(source_location_id_str) if source_location_id_str else None
            if not source_location_id:
                return json.dumps({"success": False, "message": "Geçerli bir kaynak lokasyon seçmelisiniz."})

            doa_stock_id = _get_system_location_id(db, "doa_stock")
            if not doa_stock_id:
                return json.dumps({"success": False, "message": "DOA Stock deposu bulunamadı."})

            source_stock = db.query(Stock).filter(Stock.part_id == part_id, Stock.location_id == source_location_id).first()
            if source_stock and source_stock.quantity >= return_qty:
                source_stock.quantity -= return_qty
            else:
                return json.dumps({"success": False, "message": "Kaynak depoda yeterli stok yok."})

            doa_stock = db.query(Stock).filter(Stock.part_id == part_id, Stock.location_id == doa_stock_id).first()
            if doa_stock:
                doa_stock.quantity += return_qty
            else:
                db.add(Stock(part_id=part_id, location_id=doa_stock_id, quantity=return_qty))

            db.add(StockMovement(
                type="DOA İade",
                movement_kind="Transfer",
                quantity=return_qty,
                part_id=part_id,
                source_location_id=source_location_id,
                target_location_id=doa_stock_id,
                created_by=username or None,
                technician=username or None,
                description=f"Hızlı Tekrar Üretim reçetesi parçası ({return_qty} adet) DOA stoğa geri alındı"
            ))

            db.commit()
            return json.dumps({"success": True, "message": "Parça DOA depoya iade edildi"})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"DOA İade hatası: {str(e)}"})
        finally:
            db.close()

    @Slot(str, str, str, str, result=str)
    def issue_extra_bom_materials(self, part_id_str, extra_qty_str, source_location_id_str, username):
        """Reçete/İş Emri için seçilen depodan ekstra malzeme/parça çıkışı yapar."""
        from sqlalchemy import text
        from models.stock import Stock
        from models.stock_movement import StockMovement
        from models.location import Location
        db = SessionLocal()
        try:
            part_id = int(part_id_str)
            try:
                extra_qty = int(extra_qty_str)
            except (ValueError, TypeError):
                extra_qty = 0
            if extra_qty <= 0:
                return json.dumps({"success": False, "message": "Ekstra miktar 0'dan büyük olmalıdır."})

            source_loc_id = int(source_location_id_str) if (source_location_id_str and str(source_location_id_str).isdigit()) else 0
            source_loc = db.query(Location).filter(Location.id == source_loc_id).first()
            if not source_loc:
                source_loc = db.query(Location).filter(Location.kind == "good_stock").first()
                if source_loc:
                    source_loc_id = source_loc.id

            if not source_loc_id:
                return json.dumps({"success": False, "message": "Kaynak depo bulunamadı."})

            stock = db.query(Stock).filter(Stock.part_id == part_id, Stock.location_id == source_loc_id).first()
            if not stock or stock.quantity < extra_qty:
                available = stock.quantity if stock else 0
                loc_name = source_loc.name if source_loc else "Seçilen depo"
                return json.dumps({"success": False, "message": f"{loc_name}'da yeterli stok yok. Mevcut: {available}, İstenen: {extra_qty}."})

            stock.quantity -= extra_qty
            db.add(StockMovement(
                type="Ekstra Malzeme Çıkışı",
                movement_kind="Outbound",
                quantity=extra_qty,
                part_id=part_id,
                source_location_id=source_loc_id,
                created_by=username or None,
                technician=username or None,
                description=f"İş Emri / Reçete için ekstra parça çıkışı ({extra_qty} adet) - Depo: {source_loc.name}"
            ))

            db.commit()
            clear_api_cache()
            return json.dumps({"success": True, "message": "Ekstra parça çıkışı yapıldı"})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Ekstra parça çıkışı hatası: {str(e)}"})
        finally:
            db.close()

    @Slot(str, str, str, str, result=str)
    def receive_extra_bom_materials(self, part_id_str, extra_qty_str, target_location_id_str, technician):
        """Hızlı Tekrar Üretim reçetesi için seçilen depoya ekstra malzeme/parça girişi yapar."""
        from models.stock import Stock
        from models.stock_movement import StockMovement
        db = SessionLocal()
        try:
            part_id = int(part_id_str)
            target_location_id = int(target_location_id_str) if target_location_id_str else None
            try:
                extra_qty = int(extra_qty_str)
            except (ValueError, TypeError):
                extra_qty = 0
            if extra_qty <= 0:
                return json.dumps({"success": False, "message": "Ekstra miktar 0'dan büyük olmalıdır."})
            
            if not target_location_id:
                return json.dumps({"success": False, "message": "Geçerli bir lokasyon seçmelisiniz."})

            target_stock = db.query(Stock).filter(Stock.part_id == part_id, Stock.location_id == target_location_id).first()
            if target_stock:
                target_stock.quantity += extra_qty
            else:
                target_stock = Stock(part_id=part_id, location_id=target_location_id, quantity=extra_qty)
                db.add(target_stock)

            db.add(StockMovement(
                type="Ekstra Malzeme Girişi",
                movement_kind="Inbound",
                quantity=extra_qty,
                part_id=part_id,
                target_location_id=target_location_id,
                created_by=technician or None,
                technician=technician or None,
                description=f"Hızlı Tekrar Üretim için ekstra parça girişi ({extra_qty} adet)"
            ))

            db.commit()
            return json.dumps({"success": True, "message": "Ekstra parça girişi yapıldı"})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Ekstra parça girişi hatası: {str(e)}"})
        finally:
            db.close()

    # ==========================
    # PARÇA TEDARİK DURUMU (İş Emri Parça Satırları / Stok Teslim-Bekleme-Geri Alma)
    # ==========================

    @Slot(str, result=str)
    def get_work_order_parts_by_imei(self, imei_number):
        """Bir IMEI numarasına ait parça satırlarını (ve teknisyen bilgilerini) getirir."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            if not imei_number or not imei_number.strip():
                return json.dumps({"success": False, "message": "IMEI numarası boş olamaz"})
            
            imei_clean = imei_number.strip()
            
            wo_id = None
            pu_run_id = None
            pu_row = db.execute(text("""
                SELECT pr.id AS run_id, pr.work_order_id, pr.target_part_id, pr.produced_by AS assigned_technician
                FROM warehouse.produced_units pu
                JOIN warehouse.production_runs pr ON pr.id = pu.production_run_id
                WHERE pu.serial_number = :serial
            """), {"serial": imei_clean}).mappings().first()
            
            if pu_row:
                pu_run_id = pu_row['run_id']
                wo_id = pu_row['work_order_id']

            if not wo_id and not pu_run_id and imei_clean.isdigit():
                possible_wo_id = None
                if len(imei_clean) == 15 and imei_clean.startswith('1'):
                    possible_wo_id = int(imei_clean[1:])
                else:
                    possible_wo_id = int(imei_clean)
                    
                wo_check = db.execute(text("SELECT id FROM warehouse.work_orders WHERE id = :id AND work_order_type = 'PRODUCTION'"), {"id": possible_wo_id}).scalar()
                if wo_check:
                    wo_id = wo_check

            rows = []
            
            if pu_run_id:
                rows = db.execute(text("""
                    SELECT 'pm_' || pm.id::text AS id, pm.production_run_id AS work_order_id, pm.part_id, pm.quantity_consumed AS quantity, 
                           'Üretimde Kullanıldı' AS status,
                           NULL AS delivered_location_id, NULL AS delivery_movement_id, NULL AS delivered_by, NULL AS delivered_at,
                           '' AS waiting_notes, NULL AS marked_waiting_by, NULL AS marked_waiting_at,
                           NULL AS reversal_movement_id, NULL AS reverted_by, NULL AS reverted_at,
                           NULL AS requested_by, NULL AS created_at,
                           p.brand, p.model, p.color, COALESCE(p.part_category, p.item_category) AS part_category, p.item_code, p.name AS part_name_raw,
                           '' AS delivered_location_name,
                           :tech AS assigned_technician,
                           tp.brand AS sr_brand, tp.model AS sr_model, '' AS sr_memory, 'Üretim (Tamamlanmış)' AS customer_name
                    FROM warehouse.production_materials pm
                    LEFT JOIN warehouse.parts p ON p.id = pm.part_id
                    LEFT JOIN warehouse.parts tp ON tp.id = :target_part_id
                    WHERE pm.production_run_id = :run_id
                    ORDER BY pm.id DESC
                """), {
                    "run_id": pu_run_id, 
                    "tech": pu_row["assigned_technician"], 
                    "target_part_id": pu_row["target_part_id"]
                }).mappings().all()

            elif wo_id:
                rows = db.execute(text("""
                    SELECT 'mr_' || mr.id::text AS id, mr.work_order_id, mr.part_id, 
                           mr.required_quantity AS required_qty,
                           mr.issued_quantity AS issued_qty,
                           (mr.required_quantity - mr.issued_quantity) AS remaining_qty,
                           CASE 
                               WHEN mr.status = 'CANCELLED' THEN mr.required_quantity
                               WHEN mr.issued_quantity >= mr.required_quantity THEN mr.issued_quantity
                               ELSE (mr.required_quantity - mr.issued_quantity)
                           END AS quantity, 
                           CASE 
                               WHEN mr.status = 'CANCELLED' THEN 'İptal Edildi'
                               WHEN mr.issued_quantity >= mr.required_quantity THEN 'Teslim Edildi' 
                               WHEN mr.issued_quantity > 0 THEN 'Kısmi Teslim'
                               ELSE 'Tedarik Bekleniyor' 
                           END AS status,
                           NULL AS delivered_location_id, '' AS delivered_location_name,
                           NULL AS delivery_movement_id, NULL AS delivered_by, NULL AS delivered_at,
                           '' AS waiting_notes, NULL AS marked_waiting_by, NULL AS marked_waiting_at,
                           NULL AS reversal_movement_id, NULL AS reverted_by, NULL AS reverted_at,
                           NULL AS requested_by, NULL AS created_at,
                           p.brand, p.model, p.color, COALESCE(p.part_category, p.item_category) AS part_category, p.item_code, p.name AS part_name_raw,
                           wo.assigned_technician,
                           tp.brand AS sr_brand, tp.model AS sr_model, '' AS sr_memory, 'Üretim İş Emri' AS customer_name
                    FROM warehouse.material_requests mr
                    JOIN warehouse.work_orders wo ON wo.id = mr.work_order_id
                    LEFT JOIN warehouse.parts p ON p.id = mr.part_id
                    LEFT JOIN warehouse.parts tp ON tp.id = wo.target_part_id
                    WHERE wo.id = :id
                    ORDER BY mr.id DESC
                """), {"id": wo_id}).mappings().all()

                if not rows:
                    pm_rows = db.execute(text("""
                        SELECT 'pm_' || pm.id::text AS id, pr.work_order_id, pm.part_id, pm.quantity_consumed AS quantity, 
                               'Üretimde Kullanıldı' AS status,
                               NULL AS delivered_location_id, '' AS delivered_location_name,
                               NULL AS delivery_movement_id, NULL AS delivered_by, NULL AS delivered_at,
                               '' AS waiting_notes, NULL AS marked_waiting_by, NULL AS marked_waiting_at,
                               NULL AS reversal_movement_id, NULL AS reverted_by, NULL AS reverted_at,
                               NULL AS requested_by, NULL AS created_at,
                               p.brand, p.model, p.color, COALESCE(p.part_category, p.item_category) AS part_category, p.item_code, p.name AS part_name_raw,
                               pr.produced_by AS assigned_technician,
                               tp.brand AS sr_brand, tp.model AS sr_model, '' AS sr_memory, 'Üretim (Tamamlanmış)' AS customer_name
                        FROM warehouse.production_materials pm
                        JOIN warehouse.production_runs pr ON pr.id = pm.production_run_id
                        LEFT JOIN warehouse.parts p ON p.id = pm.part_id
                        LEFT JOIN warehouse.parts tp ON tp.id = pr.target_part_id
                        WHERE pr.work_order_id = :id
                        ORDER BY pm.id DESC
                    """), {"id": wo_id}).mappings().all()
                    
                    if pm_rows:
                        rows = pm_rows


            if not rows:
                rows = db.execute(text("""
                    SELECT wop.id, wop.work_order_id, wop.part_id, wop.quantity, wop.status,
                           wop.quantity AS required_qty,
                           CASE WHEN wop.status = 'Teslim Edildi' THEN wop.quantity ELSE 0 END AS issued_qty,
                           CASE WHEN wop.status = 'Teslim Edildi' THEN 0 ELSE wop.quantity END AS remaining_qty,
                           wop.delivered_location_id, wop.delivery_movement_id, wop.delivered_by, wop.delivered_at,
                           wop.waiting_notes, wop.marked_waiting_by, wop.marked_waiting_at,
                           wop.reversal_movement_id, wop.reverted_by, wop.reverted_at,
                           wop.requested_by, wop.created_at,
                           p.brand, p.model, p.color, COALESCE(p.part_category, p.item_category) AS part_category, p.item_code, p.name AS part_name_raw,
                           dl.name AS delivered_location_name,
                           wo.assigned_technician,
                           sr.brand AS sr_brand, sr.model AS sr_model, sr.memory AS sr_memory, sr.customer_name
                    FROM warehouse.work_order_parts wop
                    JOIN warehouse.work_orders wo ON wo.id = wop.work_order_id
                    JOIN warehouse.service_records sr ON sr.id = wo.service_record_id
                    LEFT JOIN warehouse.parts p ON p.id = wop.part_id
                    LEFT JOIN warehouse.locations dl ON dl.id = wop.delivered_location_id
                    WHERE sr.imei_number = :imei
                    ORDER BY wop.id DESC
                """), {"imei": imei_clean}).mappings().all()

            parts = []
            for row in rows:
                part_name = " ".join(filter(None, [row["brand"], row["model"], row["color"], row["part_category"]])) or (row["part_name_raw"] or "")
                parts.append({
                    "id": str(row["id"]),
                    "work_order_id": str(row["work_order_id"]),
                    "part_id": str(row["part_id"]),
                    "part_name": part_name,
                    "part_category": row["part_category"] or "",
                    "item_code": row["item_code"] or "",
                    "assigned_technician": row["assigned_technician"] or "",
                    "quantity": row["quantity"],
                    "required_qty": int(row["required_qty"]) if row.get("required_qty") is not None else row["quantity"],
                    "issued_qty": int(row["issued_qty"]) if row.get("issued_qty") is not None else (row["quantity"] if row["status"] == "Teslim Edildi" else 0),
                    "remaining_qty": int(row["remaining_qty"]) if row.get("remaining_qty") is not None else (0 if row["status"] == "Teslim Edildi" else row["quantity"]),
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
            if rows:
                first_row = rows[0]
                device_info = f"{first_row['sr_brand'] or ''} {first_row['sr_model'] or ''} {first_row['sr_memory'] or ''}".strip()
                batch_info = first_row["customer_name"] or ""
            else:
                device_info = ""
                batch_info = ""

            # Identify work_order_type
            wo_type = None
            recipe_materials = []
            if wo_id:
                wo_row = db.execute(text("SELECT work_order_type, target_part_id FROM warehouse.work_orders WHERE id = :id"), {"id": wo_id}).mappings().first()
                if wo_row:
                    wo_type = wo_row["work_order_type"]
                    if wo_type == 'PRODUCTION' and wo_row["target_part_id"]:
                        target_part = db.execute(text("SELECT item_code FROM warehouse.parts WHERE id = :id"), {"id": wo_row["target_part_id"]}).mappings().first()
                        if target_part and target_part["item_code"]:
                            materials = db.execute(text("""
                                SELECT p_child.id AS child_part_id, p_child.name AS child_name, p_child.item_code AS child_item_code
                                FROM warehouse.item_bom b
                                JOIN warehouse.parts p_child ON p_child.item_code = b.child_item_id
                                WHERE b.parent_item_id = :parent_code
                            """), {"parent_code": target_part["item_code"]}).mappings().all()
                            recipe_materials = [{"id": str(m["child_part_id"]), "name": m["child_name"], "item_code": m["child_item_code"]} for m in materials]

            # Query stock movements related to this work order
            movements = []
            if wo_id:
                from models.stock_movement import StockMovement
                from models.part import Part
                from models.location import Location
                from sqlalchemy.orm import aliased
                
                MovSourceLoc = aliased(Location)
                MovTargetLoc = aliased(Location)
                
                wo_id_str_std = f"#{wo_id}"
                wo_id_str_pad = f"{wo_id:015d}"
                
                mov_rows = db.query(StockMovement, Part, MovSourceLoc, MovTargetLoc)                     .outerjoin(Part, StockMovement.part_id == Part.id)                     .outerjoin(MovSourceLoc, StockMovement.source_location_id == MovSourceLoc.id)                     .outerjoin(MovTargetLoc, StockMovement.target_location_id == MovTargetLoc.id)                     .filter(
                        (StockMovement.description.like(f"%{wo_id_str_std}%")) | 
                        (StockMovement.description.like(f"%{wo_id_str_pad}%"))
                    ).order_by(StockMovement.created_at.desc()).all()
                
                for mov, p, sloc, tloc in mov_rows:
                    source_name = sloc.name if sloc else "-"
                    target_name = tloc.name if tloc else "-"
                    
                    # Fix fallback names for cleaner UI
                    if not sloc:
                        if "İade" in mov.type and "İptal" not in mov.type:
                            source_name = "Good Stock"
                        elif "İptali" in mov.type:
                            source_name = "Good Stock"
                        elif mov.type == "Giriş":
                            source_name = "Dış Kaynak"
                            
                    if not tloc:
                        if "Çıkış" in mov.type or "Tüketimi" in mov.type or ("İptal" in mov.type and "İptali" not in mov.type) or mov.type == "Servis Kullanımı":
                            target_name = "Kullanım/Tüketim"
                        elif mov.type == "Çıkış":
                            target_name = "Dış Kaynak"
                            
                    movements.append({
                        "id": mov.id,
                        "type": mov.type,
                        "quantity": mov.quantity,
                        "part_name": p.name if p else (mov.part_name_snapshot or "Bilinmeyen Parça"),
                        "source_location": source_name,
                        "target_location": target_name,
                        "created_by": mov.created_by or "-",
                        "created_at": mov.created_at.strftime("%Y-%m-%d %H:%M") if mov.created_at else "",
                        "description": mov.description or ""
                    })

            return json.dumps({
                "success": True, 
                "parts": parts, 
                "movements": movements,
                "device_info": device_info, 
                "batch_info": batch_info,
                "work_order_id": str(wo_id) if wo_id else None,
                "work_order_type": wo_type,
                "recipe_materials": recipe_materials
            })
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

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
                       p.brand, p.model, p.color, COALESCE(p.part_category, p.item_category) AS part_category, p.item_code, p.name AS part_name_raw,
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
                    "required_qty": int(row["required_qty"]) if row.get("required_qty") is not None else row["quantity"],
                    "issued_qty": int(row["issued_qty"]) if row.get("issued_qty") is not None else (row["quantity"] if row["status"] == "Teslim Edildi" else 0),
                    "remaining_qty": int(row["remaining_qty"]) if row.get("remaining_qty") is not None else (0 if row["status"] == "Teslim Edildi" else row["quantity"]),
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
    def add_material_request(self, work_order_id_str, part_id_str, quantity_str, username):
        """Uretim is emrine manuel olarak ekstra malzeme talebi ekler."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            wo_id = int(work_order_id_str)
            part_id = int(part_id_str)
            qty = int(quantity_str)
            
            db.execute(text("""
                INSERT INTO warehouse.material_requests (work_order_id, part_id, required_quantity, issued_quantity, fire_quantity)
                VALUES (:wid, :pid, :qty, 0, 0)
            """), {"wid": wo_id, "pid": part_id, "qty": qty})
            
            row = db.execute(text("""
                SELECT 'mr_' || mr.id::text AS id, mr.work_order_id, mr.part_id, mr.required_quantity AS quantity, 
                       'Tedarik Bekleniyor' AS status, p.brand, p.model, p.color, 
                       COALESCE(p.part_category, p.item_category) AS part_category, p.item_code, p.name AS part_name_raw
                FROM warehouse.material_requests mr
                LEFT JOIN warehouse.parts p ON p.id = mr.part_id
                WHERE mr.work_order_id = :wid AND mr.part_id = :pid
                ORDER BY mr.id DESC LIMIT 1
            """), {"wid": wo_id, "pid": part_id}).mappings().first()
            
            db.commit()
            
            part_name = " ".join(filter(None, [row['brand'], row['model'], row['color'], row['part_category']])) or (row['part_name_raw'] or "")
            part_obj = {
                "id": str(row["id"]),
                "work_order_id": str(row["work_order_id"]),
                "part_id": str(row["part_id"]),
                "quantity": row["quantity"],
                "status": row["status"],
                "part_name": part_name,
                "part_category": row["part_category"] or "",
                "item_code": row["item_code"] or ""
            }
            return json.dumps({"success": True, "part": part_obj})
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

            # Check available Good Stock quantity
            good_stock_loc = _get_system_location_id(db, "good_stock")
            if not good_stock_loc:
                return json.dumps({"success": False, "message": "Good Stock deposu bulunamadı."})
            
            from models.stock import Stock
            stock = db.query(Stock).filter(Stock.part_id == part_id, Stock.location_id == good_stock_loc).first()
            available_qty = stock.quantity if stock else 0
            if qty > available_qty:
                return json.dumps({"success": False, "message": f"Yetersiz stok! Bu parçadan Good Stock deposunda en fazla {available_qty} adet mevcuttur."})

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

            from models.location import Location
            repair_stock_loc = db.query(Location).filter(Location.kind == "repair_stock").first()
            if not repair_stock_loc:
                return json.dumps({"success": False, "message": "Repair Stock deposu bulunamadı."})

            # Transfer: decrease from Good Stock, increase in Repair Stock
            stock.quantity -= qty
            
            repair_stock_entry = db.query(Stock).filter(Stock.part_id == row["part_id"], Stock.location_id == repair_stock_loc.id).first()
            if repair_stock_entry:
                repair_stock_entry.quantity += qty
            else:
                db.add(Stock(part_id=row["part_id"], location_id=repair_stock_loc.id, quantity=qty))

            movement = StockMovement(
                type="Stok Çıkışı (Teknisyene)",
                movement_kind="Transfer",
                quantity=qty,
                part_id=row["part_id"],
                source_location_id=location_id,
                target_location_id=repair_stock_loc.id,
                created_by=username or None,
                technician=username or None,
                description=f"İş Emri #{row['work_order_id']} için teknisyene teslim edildi (Good -> Repair)"
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
                SET status = 'Stokta Var', waiting_notes = :notes,
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
    def revert_work_order_part_status(self, wop_id_str, username, return_qty_str=None):
        """Durumu geri alır: Tedarik Bekleniyor -> Stokta Var, veya Teslim Edildi -> Stokta Var (stok iadeli)."""
        from sqlalchemy import text
        from models.stock import Stock
        from models.stock_movement import StockMovement
        db = SessionLocal()
        try:
            if str(wop_id_str).startswith('pm_'):
                return json.dumps({"success": False, "message": "Üretimi tamamlanmış cihazların parçaları tekil olarak iade edilemez. Lütfen cihazın tamamını iade edin."})

            if str(wop_id_str).startswith('mr_'):
                # Production Work Order material request
                mr_id = int(str(wop_id_str).replace('mr_', ''))
                mr = db.execute(text("SELECT id, part_id, issued_quantity FROM warehouse.material_requests WHERE id = :id FOR UPDATE"), {"id": mr_id}).mappings().first()
                if not mr:
                    return json.dumps({"success": False, "message": "Material Request bulunamadı."})
                qty_to_return = int(return_qty_str) if return_qty_str and int(return_qty_str) > 0 else mr["issued_quantity"]
                if qty_to_return <= 0:
                    return json.dumps({"success": False, "message": "İade edilecek teslim edilmiş miktar yok."})
                if qty_to_return > mr["issued_quantity"]:
                    return json.dumps({"success": False, "message": f"En fazla {mr['issued_quantity']} adet iade edebilirsiniz."})

                good_stock_loc = _get_system_location_id(db, "good_stock")
                if not good_stock_loc:
                    return json.dumps({"success": False, "message": "Good Stock lokasyonu bulunamadı."})

                # Add to Good Stock
                existing_stock = db.query(Stock).filter(Stock.location_id == good_stock_loc, Stock.part_id == mr["part_id"]).first()
                if existing_stock:
                    existing_stock.quantity += qty_to_return
                else:
                    db.add(Stock(location_id=good_stock_loc, part_id=mr["part_id"], quantity=qty_to_return))

                db.add(StockMovement(
                    type="Stock Return",
                    movement_kind="Inbound",
                    part_id=mr["part_id"],
                    quantity=qty_to_return,
                    target_location_id=good_stock_loc,
                    created_by=username,
                    description=f"Üretim siparişinden Stoğa Geri Alındı (MR #{mr['id']})"
                ))

                db.execute(text("UPDATE warehouse.material_requests SET issued_quantity = issued_quantity - :qty WHERE id = :id"), {"qty": qty_to_return, "id": mr_id})
                db.commit()
                return json.dumps({"success": True, "message": "Parçalar stoğa geri alındı."})
            
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
            qty = int(return_qty_str) if return_qty_str and int(return_qty_str) > 0 else row["quantity"]
            if qty > row["quantity"]:
                return json.dumps({"success": False, "message": f"En fazla {row['quantity']} adet iade edebilirsiniz."})
                
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

            if qty == row["quantity"]:
                db.execute(text("""
                    UPDATE warehouse.work_order_parts
                    SET status = 'Stoğa Geri Alındı', delivered_location_id = NULL, delivery_movement_id = NULL,
                        delivered_by = NULL, delivered_at = NULL,
                        reversal_movement_id = :rev, reverted_by = :user, reverted_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = :id
                """), {"rev": reversal.id, "user": username or None, "id": wop_id})
            else:
                # Partial return to good stock: split row
                db.execute(text("""
                    UPDATE warehouse.work_order_parts
                    SET quantity = quantity - :rqty, updated_at = CURRENT_TIMESTAMP
                    WHERE id = :id
                """), {"rqty": qty, "id": wop_id})
                
                db.execute(text("""
                    INSERT INTO warehouse.work_order_parts (work_order_id, part_id, quantity, status, delivered_location_id, created_at, updated_at, reverted_by, reverted_at, reversal_movement_id)
                    VALUES (:wo_id, :part_id, :qty, 'Stoğa Geri Alındı', :delivered_loc, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, :user, CURRENT_TIMESTAMP, :rev)
                """), {
                    "wo_id": row["work_order_id"],
                    "part_id": row["part_id"],
                    "qty": qty,
                    "delivered_loc": row["delivered_location_id"],
                    "user": username or None,
                    "rev": reversal.id
                })
            db.commit()
            return json.dumps({"success": True})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, result=str)
    def return_part_to_doa(self, wop_id_str, return_qty_str, username):
        """'DOA Stoğa Geri Al': Teslim edilmiş bir parçanın belirtilen miktarını DOA Stock'a taşır."""
        from sqlalchemy import text
        from models.stock import Stock
        from models.stock_movement import StockMovement
        from models.location import Location
        
        if str(wop_id_str).startswith('pm_'):
            return json.dumps({"success": False, "message": "Üretimi tamamlanmış cihazların parçaları tekil olarak DOA'ya alınamaz. Lütfen 'Üretim İş Emirleri' kısmından fire/iade işlemi yapın."})

        if str(wop_id_str).startswith('mr_'):
            # Production Work Order material request
            mr_id = str(wop_id_str).replace('mr_', '')
            # DOA Stoğa al demek fire bildirmekle aynı mantık (DOA stoğa atar, issued_quantity'den eksiltip fire_quantity'ye ekler)
            return self.report_material_fire(mr_id, return_qty_str, username)

        db = SessionLocal()
        try:
            wop_id = int(wop_id_str)
            return_qty = int(return_qty_str) if return_qty_str and int(return_qty_str) > 0 else 0
            if return_qty <= 0:
                return json.dumps({"success": False, "message": "Geçerli bir miktar giriniz."})

            row = db.execute(
                text("SELECT id, work_order_id, part_id, quantity, status, delivered_location_id FROM warehouse.work_order_parts WHERE id = :id FOR UPDATE"),
                {"id": wop_id}
            ).mappings().first()
            if not row:
                return json.dumps({"success": False, "message": "Parça satırı bulunamadı."})
            if row["status"] != "Teslim Edildi":
                return json.dumps({"success": False, "message": "Sadece teslim edilmiş parçalar DOA stoğa geri alınabilir."})

            if return_qty > row["quantity"]:
                return json.dumps({"success": False, "message": f"En fazla {row['quantity']} adet geri alabilirsiniz."})

            doa_loc = db.query(Location).filter(Location.kind == "doa_stock").first()
            if not doa_loc:
                return json.dumps({"success": False, "message": "DOA Stock lokasyonu bulunamadı."})

            src_loc_id = row["delivered_location_id"]
            if not src_loc_id:
                repair_loc = db.query(Location).filter(Location.kind == "repair_stock").first()
                src_loc_id = repair_loc.id if repair_loc else None

            target_stock = db.query(Stock).filter(Stock.part_id == row["part_id"], Stock.location_id == doa_loc.id).first()
            if target_stock:
                target_stock.quantity += return_qty
            else:
                db.add(Stock(part_id=row["part_id"], location_id=doa_loc.id, quantity=return_qty))

            movement = StockMovement(
                type="DOA İade",
                movement_kind="Transfer",
                quantity=return_qty,
                part_id=row["part_id"],
                source_location_id=src_loc_id,
                target_location_id=doa_loc.id,
                created_by=username or None,
                technician=username or None,
                description=f"İş Emri #{row['work_order_id']} parçası ({return_qty} adet) DOA stoğa geri alındı"
            )
            db.add(movement)

            if return_qty == row["quantity"]:
                db.execute(text("""
                    UPDATE warehouse.work_order_parts
                    SET status = 'DOA İade', updated_at = CURRENT_TIMESTAMP
                    WHERE id = :id
                """), {"id": wop_id})
            else:
                # Partial return: split the row
                # 1. Deduct quantity from original "Teslim Edildi" row
                db.execute(text("""
                    UPDATE warehouse.work_order_parts
                    SET quantity = quantity - :rqty, updated_at = CURRENT_TIMESTAMP
                    WHERE id = :id
                """), {"rqty": return_qty, "id": wop_id})
                
                # 2. Insert new row representing the returned quantity with status "Kısmi İade Edildi"
                db.execute(text("""
                    INSERT INTO warehouse.work_order_parts (work_order_id, part_id, quantity, status, delivered_location_id, created_at, updated_at)
                    VALUES (:wo_id, :part_id, :qty, 'Kısmi İade Edildi', :delivered_loc, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """), {
                    "wo_id": row["work_order_id"],
                    "part_id": row["part_id"],
                    "qty": return_qty,
                    "delivered_loc": row["delivered_location_id"]
                })

            db.commit()
            return json.dumps({"success": True})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, result=str)
    def remove_work_order_part(self, payload_str):
        """Bir parça satırını iptal edildi olarak günceller ve sebebini not düşer. (Payload JSON formatında)"""
        from sqlalchemy import text
        import json
        db = SessionLocal()
        try:
            try:
                payload = json.loads(payload_str)
                wop_id_str = str(payload.get('id', ''))
                reason_str = str(payload.get('reason', ''))
            except Exception:
                # Geriye dönük uyumluluk (sadece ID gelirse)
                wop_id_str = str(payload_str)
                reason_str = ''

            if wop_id_str.startswith('pm_'):
                return json.dumps({"success": False, "message": "Üretimi tamamlanmış cihazların parçaları silinemez/iptal edilemez."})

            if wop_id_str.startswith('mr_'):
                mr_id = int(wop_id_str.replace('mr_', ''))
                mr = db.execute(text("SELECT id, part_id, issued_quantity FROM warehouse.material_requests WHERE id = :id FOR UPDATE"), {"id": mr_id}).mappings().first()
                if not mr:
                    return json.dumps({"success": False, "message": "Material Request bulunamadı."})
                
                qty_to_return = mr["issued_quantity"]
                if qty_to_return > 0:
                    # Auto return to Good Stock
                    from models.stock import Stock
                    from models.stock_movement import StockMovement
                    good_stock_loc = _get_system_location_id(db, "good_stock")
                    repair_stock_id = _get_system_location_id(db, "repair_stock")
                    
                    # 1. Decrement from Repair Stock (technician stock)
                    if repair_stock_id:
                        rep_stock = db.query(Stock).filter(Stock.location_id == repair_stock_id, Stock.part_id == mr["part_id"]).first()
                        if rep_stock:
                            rep_stock.quantity = max(0, rep_stock.quantity - qty_to_return)
                            
                    # 2. Increment in Good Stock (warehouse stock)
                    if good_stock_loc:
                        existing_stock = db.query(Stock).filter(Stock.location_id == good_stock_loc, Stock.part_id == mr["part_id"]).first()
                        if existing_stock:
                            existing_stock.quantity += qty_to_return
                        else:
                            db.add(Stock(location_id=good_stock_loc, part_id=mr["part_id"], quantity=qty_to_return))

                        db.add(StockMovement(
                            type="Stock Return",
                            movement_kind="Inbound",
                            part_id=mr["part_id"],
                            quantity=qty_to_return,
                            target_location_id=good_stock_loc,
                            created_by=username or "System",
                            description=f"İptal nedeniyle Stoğa Geri Alındı (MR #{mr['id']})"
                        ))
                
                # Material Request tablosunda durumu CANCELLED yapıyoruz
                db.execute(text("UPDATE warehouse.material_requests SET status = 'CANCELLED', issued_quantity = 0 WHERE id = :id"), {"id": mr_id})
                db.commit()
                return json.dumps({"success": True})

            wop_id = int(wop_id_str)
            # Service parçaları için
            row = db.execute(
                text("SELECT id, work_order_id, part_id, quantity, status, delivered_location_id, delivery_movement_id FROM warehouse.work_order_parts WHERE id = :id FOR UPDATE"),
                {"id": wop_id}
            ).mappings().first()
            
            if not row:
                return json.dumps({"success": False, "message": "İptal edilecek satır bulunamadı."})

            if row["status"] in ("Teslim Edildi", "Kısmi İade Edildi"):
                # Auto return to source location (Good Stock)
                from models.stock import Stock
                from models.stock_movement import StockMovement
                qty = row["quantity"]
                location_id = row["delivered_location_id"]
                repair_stock_id = _get_system_location_id(db, "repair_stock")
                
                # 1. Decrement from Repair Stock (technician stock)
                if repair_stock_id:
                    rep_stock = db.query(Stock).filter(Stock.location_id == repair_stock_id, Stock.part_id == row["part_id"]).first()
                    if rep_stock:
                        rep_stock.quantity = max(0, rep_stock.quantity - qty)
                
                # 2. Increment in Good Stock
                if location_id:
                    stock = db.query(Stock).filter(Stock.part_id == row["part_id"], Stock.location_id == location_id).first()
                    if stock:
                        stock.quantity += qty
                    else:
                        db.add(Stock(part_id=row["part_id"], location_id=location_id, quantity=qty))

                    reversal = StockMovement(
                        type="Teslimat İptali",
                        quantity=qty,
                        part_id=row["part_id"],
                        target_location_id=location_id,
                        created_by=username or "System",
                        description=f"İptal nedeniyle teslimat geri alındı (İş Emri #{row['work_order_id']}, orijinal hareket #{row['delivery_movement_id']})"
                    )
                    db.add(reversal)

            db.execute(text("""
                UPDATE warehouse.work_order_parts 
                SET status = 'İptal Edildi', waiting_notes = :reason, delivered_location_id = NULL, delivery_movement_id = NULL
                WHERE id = :id
            """), {"id": wop_id, "reason": reason_str})
            
            db.commit()
            return json.dumps({"success": True})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, result=str)
    def get_service_repair_details(self, work_order_id_str):
        """Servis iş emrine ait arıza tespit, tanı kartları, onarım aşamaları bilgilerini getirir."""
        from sqlalchemy import text
        import json
        db = SessionLocal()
        try:
            wo_id = int(work_order_id_str)
            wo = db.execute(text("""
                SELECT id, service_record_id, assigned_technician
                FROM warehouse.work_orders WHERE id = :id
            """), {"id": wo_id}).mappings().first()
            if not wo:
                return json.dumps({"success": False, "message": "İş emri bulunamadı."})
            
            sr_id = wo["service_record_id"]
            if not sr_id:
                return json.dumps({"success": False, "message": "Bu iş emri bir servis kaydına bağlı değil."})
                
            sr = db.execute(text("""
                SELECT id, customer_name, brand, model, color, memory, imei_number, imei_serial,
                       customer_complaint, preliminary_diagnosis, technician_note
                FROM warehouse.service_records WHERE id = :id
            """), {"id": sr_id}).mappings().first()
            
            if not sr:
                return json.dumps({"success": False, "message": "Servis kaydı bulunamadı."})

            diag_data = None
            raw_note = sr["technician_note"] or ""
            if raw_note.strip().startswith('{') and raw_note.strip().endswith('}'):
                try:
                    diag_data = json.loads(raw_note)
                except Exception:
                    pass
            
            if not diag_data or not isinstance(diag_data, dict):
                diag_data = {
                    "diagnostics": {
                        "lcd": "OK",
                        "mp_camera": "OK",
                        "b_camera": "OK",
                        "battery_cycle": "0",
                        "battery_health": "100"
                    },
                    "stages": [
                        {"group_name": "Kasa Onarımı", "staff_name": wo["assigned_technician"] or "", "count": 1, "status": "Beklemede", "start_time": "", "finish_time": ""},
                        {"group_name": "Kamera Onarımı", "staff_name": "", "count": 1, "status": "Beklemede", "start_time": "", "finish_time": ""},
                        {"group_name": "Ekran Onarımı", "staff_name": "", "count": 1, "status": "Beklemede", "start_time": "", "finish_time": ""},
                        {"group_name": "L1 Onarımı", "staff_name": "", "count": 1, "status": "Beklemede", "start_time": "", "finish_time": ""}
                    ],
                    "price": "0.00"
                }

            res = {
                "success": True,
                "service_record_id": sr["id"],
                "customer_name": sr["customer_name"] or "",
                "brand": sr["brand"] or "",
                "model": sr["model"] or "",
                "color": sr["color"] or "",
                "memory": sr["memory"] or "",
                "imei_number": sr["imei_number"] or sr["imei_serial"] or "",
                "customer_complaint": sr["customer_complaint"] or "",
                "preliminary_diagnosis": sr["preliminary_diagnosis"] or "",
                "diagnostics": diag_data.get("diagnostics", {}),
                "stages": diag_data.get("stages", []),
                "price": diag_data.get("price", "0.00")
            }
            return json.dumps(res)
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, result=str)
    def save_service_repair_details(self, work_order_id_str, details_json):
        """Servis iş emrine ait arıza tespit, tanı kartları, onarım aşamaları bilgilerini kaydeder."""
        from sqlalchemy import text
        import json
        db = SessionLocal()
        try:
            wo_id = int(work_order_id_str)
            wo = db.execute(text("SELECT service_record_id FROM warehouse.work_orders WHERE id = :id"), {"id": wo_id}).mappings().first()
            if not wo or not wo["service_record_id"]:
                return json.dumps({"success": False, "message": "İş emri veya bağlı servis kaydı bulunamadı."})
                
            db.execute(text("""
                UPDATE warehouse.service_records
                SET technician_note = :note
                WHERE id = :id
            """), {"note": details_json, "id": wo["service_record_id"]})
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
                    (:wid, :pid, :qty, 'Stokta Var', :notes, :user, CURRENT_TIMESTAMP, :user)
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
                       p.id AS part_id, p.brand, p.model, p.color, COALESCE(p.part_category, p.item_category) AS part_category, p.item_code, p.name AS part_name_raw,
                       w.assigned_technician, w.priority, w.status AS work_order_status,
                       s.customer_name, s.brand AS device_brand, s.model AS device_model
                FROM warehouse.work_order_parts wop
                JOIN warehouse.work_orders w ON w.id = wop.work_order_id
                LEFT JOIN warehouse.service_records s ON s.id = w.service_record_id
                LEFT JOIN warehouse.parts p ON p.id = wop.part_id
                WHERE wop.status IN ('Tedarik Bekleniyor', 'Stokta Var')
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
                       p.id AS part_id, p.brand, p.model, p.color, COALESCE(p.part_category, p.item_category) AS part_category, p.item_code, p.name AS part_name_raw,
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
                SELECT pu.id AS unit_id, pu.serial_number, pu.is_returned, pu.return_reason, pu.returned_at, pu.return_location_id, pu.returned_materials, pu.replacement_requested_qty,
                       pr.id AS run_id, pr.target_part_id, pr.quantity_produced, pr.location_id, pr.source_location_id,
                       pr.produced_by, pr.notes, pr.created_at, pr.department, pr.scrap_quantity, pr.work_order_id,
                       p.brand AS target_brand, p.model AS target_model,
                       p.item_code AS target_code, p.name AS target_name,
                       l.name AS location_name,
                       sl.name AS source_location_name,
                       rl.name AS return_location_name
                FROM warehouse.produced_units pu
                JOIN warehouse.production_runs pr ON pr.id = pu.production_run_id
                LEFT JOIN warehouse.parts p ON p.id = pr.target_part_id
                LEFT JOIN warehouse.locations l ON l.id = pr.location_id
                LEFT JOIN warehouse.locations sl ON sl.id = pr.source_location_id
                LEFT JOIN warehouse.locations rl ON rl.id = pu.return_location_id
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
                
                # Tüm parti için toplam malzeme tüketimini ekle
                unit_materials = []
                for m in materials_by_run.get(u["run_id"], []):
                    qty = float(m["quantity_consumed"])
                    if qty.is_integer():
                        qty = int(qty)
                    else:
                        qty = round(qty, 2)
                        
                    unit_materials.append({
                        "part_id": m["part_id"],
                        "part_name": m["part_name"],
                        "item_code": m["item_code"],
                        "quantity_consumed": qty
                    })

                result.append({
                    "id": str(u["run_id"]),  # Geri alma işlemleri için run_id
                    "unit_id": str(u["unit_id"]),
                    "serial_number": u["serial_number"],
                    "is_returned": bool(u["is_returned"]),
                    "return_reason": u["return_reason"] or "",
                    "returned_at": u["returned_at"].strftime("%Y-%m-%d %H:%M") if u["returned_at"] else "",
                    "return_location_id": str(u["return_location_id"]) if u["return_location_id"] else "",
                    "return_location_name": u["return_location_name"] or "",
                    "returned_materials": json.loads(u["returned_materials"]) if u["returned_materials"] else [],
                    "replacement_requested_qty": int(u["replacement_requested_qty"]) if u["replacement_requested_qty"] else 0,
                    "target_part_id": str(u["target_part_id"]) if u["target_part_id"] else "",
                    "target_part_name": target_label,
                    "target_item_code": u["target_code"] or "",
                    "quantity_produced": u["quantity_produced"],
                    "location_id": str(u["location_id"]) if u["location_id"] else "",
                    "location_name": u["location_name"] or "",
                    "source_location_id": str(u["source_location_id"]) if u["source_location_id"] else "",
                    "source_location_name": u["source_location_name"] or "",
                    "produced_by": u["produced_by"] or "",
                    "department": u["department"] or "",
                    "scrap_quantity": u["scrap_quantity"] or 0,
                    "work_order_id": str(u["work_order_id"]) if u["work_order_id"] else "",
                    "notes": u["notes"] or "",
                    "created_at": u["created_at"].strftime("%Y-%m-%d %H:%M") if u["created_at"] else "",
                    "materials": unit_materials
                })
            return json.dumps({"success": True, "production_runs": result})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, str, str, str, str, str, str, result=str)
    def create_production_run(self, target_part_id, quantity_produced, source_location_id, target_location_id, produced_by, notes, materials_json, department, scrap_quantity_str):
        """Hammadde tüketip yarı mamul/ürün stoku oluşturan bir üretim kaydı ekler."""
        from sqlalchemy import text
        from models.stock_movement import StockMovement
        import json as json_module
        db = SessionLocal()
        try:
            qty = int(quantity_produced)
            src_loc_id = int(source_location_id)
            tgt_loc_id = int(target_location_id)
            tgt_id = int(target_part_id)
            materials = json_module.loads(materials_json or "[]")
            scrap_qty = int(scrap_quantity_str) if scrap_quantity_str else 0
            dept = department or None

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

            # Hammaddeleri, stoğu nerede varsa oradan düş (birden fazla lokasyona/satıra yayılmış olabilir).
            # Her düşülen (parça, lokasyon, miktar) üçlüsünü, hareket geçmişine daha sonra
            # StockMovement kaydı açabilmek için ayrıca not ediyoruz.
            consumption_records = []
            for m in materials:
                part_id = int(m["part_id"])
                remaining = int(m["quantity_consumed"])
                rows = db.execute(text("""
                    SELECT id, location_id, quantity FROM warehouse.stock
                    WHERE part_id = :pid AND quantity > 0
                    ORDER BY id
                    FOR UPDATE
                """), {"pid": part_id}).all()
                for stock_id, stock_location_id, stock_qty in rows:
                    if remaining <= 0:
                        break
                    take = min(stock_qty, remaining)
                    db.execute(text("""
                        UPDATE warehouse.stock SET quantity = quantity - :take WHERE id = :id
                    """), {"take": take, "id": stock_id})
                    remaining -= take
                    consumption_records.append((part_id, stock_location_id, take))

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

            # Hızlı Üretim için de bir İş Emri (Work Order) oluştur ve tamamlandı işaretle
            wo_id = db.execute(text("""
                INSERT INTO warehouse.work_orders (
                    work_order_type, target_part_id, description, priority, planned_quantity,
                    assigned_technician, department, status, completed_at, produced_quantity, scrap_quantity, production_notes
                ) VALUES (
                    :wtype, :tgt, :desc, 'Orta', :qty, :tech, :dept, :status, CURRENT_TIMESTAMP, :qty, :scrap, :notes
                ) RETURNING id
            """), {
                "wtype": WORK_ORDER_TYPE_PRODUCTION,
                "tgt": tgt_id, "desc": "Hızlı Üretim (Otomatik İş Emri)",
                "qty": qty, "tech": produced_by or None, "dept": dept,
                "status": PRODUCTION_WO_STATUS_COMPLETED,
                "scrap": scrap_qty, "notes": notes or None
            }).scalar()

            # Üretim kaydını oluştur
            run_id = db.execute(text("""
                INSERT INTO warehouse.production_runs (target_part_id, quantity_produced, source_location_id, location_id, produced_by, notes, department, scrap_quantity, work_order_id)
                VALUES (:tgt, :qty, :slid, :tlid, :by, :notes, :dept, :scrap, :wo_id) RETURNING id
            """), {
                "tgt": tgt_id, "qty": qty, "slid": src_loc_id, "tlid": tgt_loc_id,
                "by": produced_by or None, "notes": notes or None, "dept": dept, "scrap": scrap_qty, "wo_id": wo_id
            }).scalar()

            # Tek bir ortak serial number (Cihaz Kimlik ID) oluştur ve tek satır olarak ekle
            next_id = db.execute(text("SELECT nextval(pg_get_serial_sequence('warehouse.produced_units', 'id'))")).scalar()
            serial_num = f"{next_id:015d}"

            db.execute(text("""
                INSERT INTO warehouse.produced_units (id, production_run_id, serial_number)
                VALUES (:id, :run_id, :serial)
            """), {"id": next_id, "run_id": run_id, "serial": serial_num})

            for m in materials:
                db.execute(text("""
                    INSERT INTO warehouse.production_materials (production_run_id, part_id, quantity_consumed)
                    VALUES (:run_id, :pid, :qty)
                """), {"run_id": run_id, "pid": int(m["part_id"]), "qty": int(m["quantity_consumed"])})

            # Hareket geçmişi (audit trail): tüketilen her hammadde için bir çıkış hareketi,
            # üretilen yarı mamul için bir giriş hareketi. Böylece Depo sayfasındaki "Son
            # Hareket Tarihi" ve Stok Hareketleri raporu üretim faaliyetini de yansıtır.
            for part_id, stock_location_id, take in consumption_records:
                db.add(StockMovement(
                    type="Üretim İçin Malzeme Tüketimi",
                    movement_kind="Outbound",
                    quantity=take,
                    part_id=part_id,
                    source_location_id=stock_location_id,
                    created_by=produced_by or None,
                    description=f"Üretim Kaydı #{run_id} ({serial_num}) için tüketildi"
                ))
            db.add(StockMovement(
                type="Üretim",
                movement_kind="Inbound",
                quantity=qty,
                part_id=tgt_id,
                target_location_id=tgt_loc_id,
                created_by=produced_by or None,
                description=f"Üretim Kaydı #{run_id} ({serial_num}) ile üretildi"
            ))

            db.commit()
            return json.dumps({"success": True, "message": "Üretim kaydı oluşturuldu", "serial_number": serial_num, "run_id": run_id})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Üretim kaydı hatası: {str(e)}"})
        finally:
            db.close()

    @Slot(str, result=str)
    def delete_production_run(self, params_json):
        """Belirtilen üretilmiş cihaz birimini (produced_unit) iade eder.
        Sorunlu parçalar seçilen iade deposuna, sorunsuzlar Good Stock'a (id=26) aktarılır.
        params_json: JSON string {unit_id, return_location_id, return_reason, defective_parts: [{part_id, defective}]}
        """
        # Dış try: PySide6'nın slot'tan "" döndürmesini engeller
        try:
            return self._do_delete_production_run(params_json)
        except Exception as e:
            return json.dumps({"success": False, "message": f"Slot hatası: {str(e)}"})

    def _do_delete_production_run(self, params_json):
        from sqlalchemy import text
        from datetime import datetime
        from models.stock_movement import StockMovement
        db = SessionLocal()
        result_str = json.dumps({"success": False, "message": "Bilinmeyen hata"})
        try:
            params = json.loads(params_json)
            unit_id = int(params["unit_id"])
            return_location_id = int(params["return_location_id"])
            return_reason = params.get("return_reason") or "Belirtilmedi"
            # Sorunlu parça miktarlarını çöz: {part_id: defective_qty}
            defective_qtys = {}
            for entry in (params.get("defective_parts") or []):
                try:
                    p_id = int(entry.get("part_id"))
                    def_qty = int(entry.get("defective_qty", 0))
                    if def_qty > 0:
                        defective_qtys[p_id] = def_qty
                except (ValueError, TypeError):
                    pass

            # Değişim istenecek parça miktarlarını çöz: {part_id: replacement_qty}
            replacement_qtys = {}
            for entry in (params.get("replacement_parts") or []):
                try:
                    p_id = int(entry.get("part_id"))
                    rep_qty = int(entry.get("replacement_qty", 0))
                    if rep_qty > 0:
                        replacement_qtys[p_id] = rep_qty
                except (ValueError, TypeError):
                    pass

            replacement_qty = max(replacement_qtys.values()) if replacement_qtys else 0
            GOOD_STOCK_ID = _get_system_location_id(db, "good_stock")
            if not GOOD_STOCK_ID:
                result_str = json.dumps({"success": False, "message": "Good Stock deposu bulunamadı."})
                return result_str
            
            # 1. Üretilmiş cihaz kaydını ve bağlı olduğu üretim koşusunu çek
            unit = db.execute(text("""
                SELECT pu.id, pu.serial_number, pu.is_returned,
                       pr.id AS run_id, pr.target_part_id, pr.quantity_produced, pr.location_id, pr.source_location_id
                FROM warehouse.produced_units pu
                JOIN warehouse.production_runs pr ON pr.id = pu.production_run_id
                WHERE pu.id = :uid
            """), {"uid": unit_id}).mappings().first()
            
            if not unit:
                result_str = json.dumps({"success": False, "message": "Üretilen cihaz kaydı bulunamadı."})
                return result_str
                
            if unit["is_returned"]:
                result_str = json.dumps({"success": False, "message": "Bu cihaz zaten iade edilmiş."})
                return result_str
                
            run_id = unit["run_id"]
            target_part_id = unit["target_part_id"]
            quantity_produced = unit["quantity_produced"]
            location_id = unit["location_id"]
            
            # 2. Üretilen parçanın stoğunu kontrol et
            target_stock = db.execute(text("""
                SELECT id, quantity FROM warehouse.stock
                WHERE part_id = :pid AND location_id = :lid
                FOR UPDATE
            """), {"pid": target_part_id, "lid": location_id}).first()
            
            if not target_stock or target_stock[1] < quantity_produced:
                current_qty = target_stock[1] if target_stock else 0
                result_str = json.dumps({
                    "success": False, 
                    "message": f"Üretilen parçanın stoğu yetersiz ({current_qty} adet var, {quantity_produced} adet gerekli). İade gerçekleştirilemez."
                })
                return result_str
                
            # 2.5. Değişim (replacement) talep edildiyse, iadeyi mutasyona başlamadan önce
            # fizibilite kontrolü yap: reçete var mı, gereken hammadde stokta yeterli mi?
            # Yetersizse tüm iade işlemi iptal edilir (hiçbir şey değişmez) — kısmi başarı
            # istenmiyor, ya iade+değişim birlikte gerçekleşir ya da hiçbiri.


            # 2.5. Değişim (replacement) talep edildiyse, hammadde stok kontrolü yap
            replacement_materials = []
            if replacement_qty > 0:
                for part_id, rep_qty in replacement_qtys.items():
                    replacement_materials.append((part_id, rep_qty))

                for part_id, needed in replacement_materials:
                    total_available = db.execute(text("""
                        SELECT COALESCE(SUM(quantity), 0) FROM warehouse.stock WHERE part_id = :pid
                    """), {"pid": part_id}).scalar()
                    if total_available < needed:
                        raise Exception(
                            f"Değişim üretimi için yetersiz stok (parça id {part_id}): mevcut {total_available}, "
                            f"gerekli {needed}. İade işlemi iptal edildi."
                        )

            # 3. Tüketilen malzemeleri çek
            materials = db.execute(text("""
                SELECT part_id, quantity_consumed
                FROM warehouse.production_materials
                WHERE production_run_id = :run_id
            """), {"run_id": run_id}).all()
            
            # 4. Üretilen parçanın stoğunu batch miktarı kadar düş
            db.execute(text("""
                UPDATE warehouse.stock
                SET quantity = quantity - :qty
                WHERE id = :id
            """), {"qty": quantity_produced, "id": target_stock[0]})

            db.add(StockMovement(
                type="Üretim İadesi/İptal",
                movement_kind="Outbound",
                quantity=quantity_produced,
                part_id=target_part_id,
                source_location_id=location_id,
                created_by=None,
                description=f"Üretilen cihaz {unit['serial_number']} iade edildi ({return_reason})"
            ))

            # 5. Her malzemeyi sorunlu/sorunsuz durumuna göre farklı depoya ekle
            returned_mats = []
            for m in materials:
                m_part_id = m[0]
                total_qty = m[1] # Tüm batch için tüketilen miktar
                
                # Sorunlu miktarını al ve sınırla (en fazla total_qty kadar olabilir)
                def_qty = min(total_qty, defective_qtys.get(m_part_id, 0))
                good_qty = total_qty - def_qty
                
                part_row = db.execute(text("SELECT brand, model, name, item_code FROM warehouse.parts WHERE id = :pid"), {"pid": m_part_id}).first()
                part_label = ""
                item_code = ""
                if part_row:
                    part_label = f"{part_row[0] or ''} {part_row[1] or ''}".strip() or (part_row[2] or "")
                    item_code = part_row[3] or ""

                returned_mats.append({
                    "part_id": str(m_part_id),
                    "part_name": part_label,
                    "item_code": item_code,
                    "defective_qty": def_qty,
                    "good_qty": good_qty,
                    "total_qty": total_qty
                })
                
                # 5a. Sorunlu olanları seçilen iade lokasyonuna aktar
                if def_qty > 0:
                    existing_m = db.execute(text("""
                        SELECT id FROM warehouse.stock
                        WHERE part_id = :pid AND location_id = :lid
                        FOR UPDATE
                    """), {"pid": m_part_id, "lid": return_location_id}).first()
                    
                    if existing_m:
                        db.execute(text("""
                            UPDATE warehouse.stock
                            SET quantity = quantity + :qty
                            WHERE id = :id
                        """), {"qty": def_qty, "id": existing_m[0]})
                    else:
                        db.execute(text("""
                            INSERT INTO warehouse.stock (part_id, location_id, quantity)
                            VALUES (:pid, :lid, :qty)
                        """), {"pid": m_part_id, "lid": return_location_id, "qty": def_qty})

                    db.add(StockMovement(
                        type="Üretim İadesi - Sorunlu Malzeme",
                        movement_kind="Inbound",
                        quantity=def_qty,
                        part_id=m_part_id,
                        target_location_id=return_location_id,
                        created_by=None,
                        description=f"Üretilen cihaz {unit['serial_number']} iadesinden sorunlu malzeme"
                    ))

                # 5b. Sorunsuz olanları doğrudan Good Stock'a aktar
                if good_qty > 0:
                    existing_m = db.execute(text("""
                        SELECT id FROM warehouse.stock
                        WHERE part_id = :pid AND location_id = :lid
                        FOR UPDATE
                    """), {"pid": m_part_id, "lid": GOOD_STOCK_ID}).first()
                    
                    if existing_m:
                        db.execute(text("""
                            UPDATE warehouse.stock
                            SET quantity = quantity + :qty
                            WHERE id = :id
                        """), {"qty": good_qty, "id": existing_m[0]})
                    else:
                        db.execute(text("""
                            INSERT INTO warehouse.stock (part_id, location_id, quantity)
                            VALUES (:pid, :lid, :qty)
                        """), {"pid": m_part_id, "lid": GOOD_STOCK_ID, "qty": good_qty})

                    db.add(StockMovement(
                        type="Üretim İadesi - Sorunsuz Malzeme",
                        movement_kind="Inbound",
                        quantity=good_qty,
                        part_id=m_part_id,
                        target_location_id=GOOD_STOCK_ID,
                        created_by=None,
                        description=f"Üretilen cihaz {unit['serial_number']} iadesinden sorunsuz malzeme"
                    ))

            # 5.5. Değişim üretimi: fizibilitesi 2.5'te doğrulanmış replacement_materials'ı
            # tüket, replacement_qty kadar yeni bir üretim partisi (yeni seri no) oluştur.
            # Bu, orijinal iade edilen partiden bağımsız yeni bir production_runs kaydıdır;
            # notes alanı üzerinden hangi iadenin karşılığı olduğu izlenebilir.
            if replacement_qty > 0:
                replacement_consumption_records = []
                for part_id, needed in replacement_materials:
                    remaining = needed
                    rows = db.execute(text("""
                        SELECT id, location_id, quantity FROM warehouse.stock
                        WHERE part_id = :pid AND quantity > 0
                        ORDER BY id
                        FOR UPDATE
                    """), {"pid": part_id}).all()
                    for stock_id, stock_location_id, stock_qty in rows:
                        if remaining <= 0:
                            break
                        take = min(stock_qty, remaining)
                        db.execute(text("UPDATE warehouse.stock SET quantity = quantity - :take WHERE id = :id"),
                                   {"take": take, "id": stock_id})
                        remaining -= take
                        replacement_consumption_records.append((part_id, stock_location_id, take))

                existing_repl = db.execute(text("""
                    SELECT id FROM warehouse.stock WHERE part_id = :pid AND location_id = :lid
                """), {"pid": target_part_id, "lid": GOOD_STOCK_ID}).first()
                if existing_repl:
                    db.execute(text("UPDATE warehouse.stock SET quantity = quantity + :qty WHERE id = :id"),
                               {"qty": replacement_qty, "id": existing_repl[0]})
                else:
                    db.execute(text("""
                        INSERT INTO warehouse.stock (part_id, location_id, quantity) VALUES (:pid, :lid, :qty)
                    """), {"pid": target_part_id, "lid": GOOD_STOCK_ID, "qty": replacement_qty})

                replacement_run_id = db.execute(text("""
                    INSERT INTO warehouse.production_runs (target_part_id, quantity_produced, source_location_id, location_id, produced_by, notes)
                    VALUES (:tgt, :qty, :slid, :tlid, :by, :notes) RETURNING id
                """), {
                    "tgt": target_part_id, "qty": replacement_qty, "slid": GOOD_STOCK_ID, "tlid": GOOD_STOCK_ID,
                    "by": None, "notes": f"'{unit['serial_number']}' iadesi icin otomatik degisim uretimi (neden: {return_reason})"
                }).scalar()

                replacement_next_id = db.execute(text("SELECT nextval(pg_get_serial_sequence('warehouse.produced_units', 'id'))")).scalar()
                replacement_serial = f"{replacement_next_id:015d}"
                db.execute(text("""
                    INSERT INTO warehouse.produced_units (id, production_run_id, serial_number)
                    VALUES (:id, :run_id, :serial)
                """), {"id": replacement_next_id, "run_id": replacement_run_id, "serial": replacement_serial})

                for part_id, needed in replacement_materials:
                    db.execute(text("""
                        INSERT INTO warehouse.production_materials (production_run_id, part_id, quantity_consumed)
                        VALUES (:run_id, :pid, :qty)
                    """), {"run_id": replacement_run_id, "pid": part_id, "qty": needed})

                for part_id, stock_location_id, take in replacement_consumption_records:
                    db.add(StockMovement(
                        type="Değişim Üretimi İçin Malzeme Tüketimi",
                        movement_kind="Outbound",
                        quantity=take,
                        part_id=part_id,
                        source_location_id=stock_location_id,
                        created_by=None,
                        description=f"Değişim Üretimi #{replacement_run_id} ({replacement_serial}) için tüketildi — iade edilen {unit['serial_number']} yerine"
                    ))
                db.add(StockMovement(
                    type="Değişim Üretimi",
                    movement_kind="Inbound",
                    quantity=replacement_qty,
                    part_id=target_part_id,
                    target_location_id=GOOD_STOCK_ID,
                    created_by=None,
                    description=f"Değişim Üretimi #{replacement_run_id} ({replacement_serial}) — iade edilen {unit['serial_number']} yerine üretildi"
                ))

            # 6. Cihaz kaydını iade edildi olarak işaretle ve nedenini kaydet
            db.execute(text("""
                UPDATE warehouse.produced_units
                SET is_returned = TRUE,
                    return_reason = :reason,
                    returned_at = :now,
                    return_location_id = :ret_loc_id,
                    returned_materials = :returned_mats,
                    replacement_requested_qty = :replacement_qty
                WHERE id = :uid
            """), {
                "reason": return_reason,
                "now": datetime.utcnow(),
                "ret_loc_id": return_location_id,
                "uid": unit_id,
                "returned_mats": json.dumps(returned_mats),
                "replacement_qty": replacement_qty
            })
            
            db.commit()
            result_str = json.dumps({"success": True, "message": "Üretim iade/değişim işlemi başarıyla tamamlandı."})
            return result_str
        except Exception as e:
            try:
                db.rollback()
            except Exception:
                pass
            result_str = json.dumps({"success": False, "message": f"İade hatası: {str(e)}"})
            return result_str
        finally:
            try:
                db.close()
            except Exception:
                pass

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
    def get_customers(self):
        """Müşteriler sayfası için: warehouse.customers tablosundaki tüm kayıtlar
        (parts tablosundan tamamen bağımsız, gerçek bir müşteri/cihaz kabul tablosu)."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            rows = db.execute(text("""
                SELECT id, customer_name, customer_phone, customer_email, company,
                       imei_number, serial_number, internal_id, brand, model, product_code,
                       flow, customer_reported_complaint, intake_date, created_at,
                       code, short_name, currency, customer_language, use_mio
                FROM warehouse.customers
                ORDER BY id DESC
                LIMIT 500
            """)).mappings().all()
            customers = []
            for r in rows:
                customers.append({
                    "id": str(r["id"]),
                    "customer_name": r["customer_name"] or "",
                    "customer_phone": r["customer_phone"] or "",
                    "customer_email": r["customer_email"] or "",
                    "company": r["company"] or "",
                    "imei_number": r["imei_number"] or "",
                    "serial_number": r["serial_number"] or "",
                    "internal_id": r["internal_id"] or "",
                    "brand": r["brand"] or "",
                    "model": r["model"] or "",
                    "product_code": r["product_code"] or "",
                    "flow": r["flow"] or "",
                    "customer_reported_complaint": r["customer_reported_complaint"] or "",
                    "intake_date": r["intake_date"].strftime("%Y-%m-%d") if r["intake_date"] else "",
                    "created_at": r["created_at"].strftime("%Y-%m-%d %H:%M") if r["created_at"] else "",
                    "code": r["code"] or "",
                    "short_name": r["short_name"] or "",
                    "currency": r["currency"] or "",
                    "customer_language": r["customer_language"] or "",
                    "use_mio": bool(r["use_mio"])
                })
            return json.dumps({"success": True, "customers": customers})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, str, str, str, str, str, str, str, str, str, str, str, str, str, result=str)
    def create_customer(self, customer_name, customer_phone, customer_email, company,
                         imei_number, serial_number, internal_id, cihaz_modeli, flow,
                         customer_reported_complaint, intake_date,
                         code, short_name, currency, customer_language, use_mio):
        """Yeni bir müşteri/cihaz kabul kaydı ekler (manuel tek-kayıt formu)."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            name = (customer_name or "").strip()
            if not name:
                return json.dumps({"success": False, "message": "Müşteri adı zorunludur."})

            product = None
            if cihaz_modeli and cihaz_modeli.strip():
                product = db.execute(text("""
                    SELECT brand, model, item_code FROM warehouse.products
                    WHERE LOWER(TRIM(brand || ' ' || model)) = LOWER(:cm) LIMIT 1
                """), {"cm": cihaz_modeli.strip()}).mappings().first()

            db.execute(text("""
                INSERT INTO warehouse.customers (
                    customer_name, customer_phone, customer_email, company,
                    imei_number, serial_number, internal_id, brand, model, product_code,
                    flow, customer_reported_complaint, intake_date,
                    code, short_name, currency, customer_language, use_mio
                ) VALUES (
                    :name, :phone, :email, :company,
                    :imei, :serial, :internal_id, :brand, :model, :product_code,
                    :flow, :complaint, :intake_date,
                    :code, :short_name, :currency, :customer_language, :use_mio
                )
            """), {
                "name": name, "phone": customer_phone or None, "email": customer_email or None,
                "company": company or None,
                "imei": imei_number or None, "serial": serial_number or None,
                "internal_id": internal_id or None,
                "brand": product["brand"] if product else None,
                "model": product["model"] if product else None,
                "product_code": product["item_code"] if product else None,
                "flow": flow or None, "complaint": customer_reported_complaint or None,
                "intake_date": intake_date or None,
                "code": code or None, "short_name": short_name or None,
                "currency": currency or None, "customer_language": customer_language or None,
                "use_mio": use_mio == "true"
            })
            db.commit()
            return json.dumps({"success": True, "message": "Müşteri kaydı eklendi."})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, str, str, str, str, str, str, str, str, str, str, str, str, str, str, result=str)
    def update_customer(self, customer_id_str, customer_name, customer_phone, customer_email, company,
                         imei_number, serial_number, internal_id, cihaz_modeli, flow,
                         customer_reported_complaint, intake_date,
                         code, short_name, currency, customer_language, use_mio):
        """Var olan bir müşteri/cihaz kabul kaydını günceller."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            customer_id = int(customer_id_str)
            name = (customer_name or "").strip()
            if not name:
                return json.dumps({"success": False, "message": "Müşteri adı zorunludur."})

            product = None
            if cihaz_modeli and cihaz_modeli.strip():
                product = db.execute(text("""
                    SELECT brand, model, item_code FROM warehouse.products
                    WHERE LOWER(TRIM(brand || ' ' || model)) = LOWER(:cm) LIMIT 1
                """), {"cm": cihaz_modeli.strip()}).mappings().first()

            db.execute(text("""
                UPDATE warehouse.customers
                SET customer_name = :name, customer_phone = :phone, customer_email = :email, company = :company,
                    imei_number = :imei, serial_number = :serial, internal_id = :internal_id,
                    brand = :brand, model = :model, product_code = :product_code,
                    flow = :flow, customer_reported_complaint = :complaint, intake_date = :intake_date,
                    code = :code, short_name = :short_name, currency = :currency,
                    customer_language = :customer_language, use_mio = :use_mio
                WHERE id = :id
            """), {
                "name": name, "phone": customer_phone or None, "email": customer_email or None,
                "company": company or None,
                "imei": imei_number or None, "serial": serial_number or None,
                "internal_id": internal_id or None,
                "brand": product["brand"] if product else None,
                "model": product["model"] if product else None,
                "product_code": product["item_code"] if product else None,
                "flow": flow or None, "complaint": customer_reported_complaint or None,
                "intake_date": intake_date or None,
                "code": code or None, "short_name": short_name or None,
                "currency": currency or None, "customer_language": customer_language or None,
                "use_mio": use_mio == "true",
                "id": customer_id
            })
            db.commit()
            return json.dumps({"success": True, "message": "Müşteri kaydı güncellendi."})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, result=str)
    def delete_customer(self, customer_id_str):
        """Belirtilen id'ye sahip müşteri kaydını siler."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            customer_id = int(customer_id_str)
            db.execute(text("DELETE FROM warehouse.customers WHERE id = :id"), {"id": customer_id})
            db.commit()
            return json.dumps({"success": True, "message": "Müşteri kaydı silindi."})
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
        fetch_url = f"/api_cache/{filename}"
        if os.path.exists(path):
            return json.dumps({"success": True, "fetch_url": fetch_url})

        from sqlalchemy import text
        db = SessionLocal()
        try:
            stocks = db.execute(text("""
                SELECT s.id, p.id as part_id, p.brand, p.model, p.color, p.part_category, p.name as pname, p.item_code,
                       l.id as location_id, l.name as location_name, l.kind as location_kind, 
                       s.quantity, p.critical_limit,
                       (
                         SELECT MAX(sm.created_at)
                         FROM warehouse.stock_movements sm
                         WHERE sm.part_id = s.part_id AND (sm.source_location_id = s.location_id OR sm.target_location_id = s.location_id)
                       ) as last_movement_at
                FROM warehouse.stock s 
                JOIN warehouse.parts p ON s.part_id = p.id 
                JOIN warehouse.locations l ON s.location_id = l.id
                ORDER BY s.id DESC
            """)).mappings().all()
            res = []
            for row in stocks:
                lm_at = row.get("last_movement_at")
                date_str = lm_at.strftime("%d.%m.%Y %H:%M") if lm_at else "-"
                part_name = " ".join(filter(None, [row.get("brand"), row.get("model"), row.get("color"), row.get("part_category")]))
                if not part_name:
                    part_name = (row.get("pname") or "").strip()
                if not part_name:
                    part_name = row.get("item_code") or "İsimsiz Parça"
                    
                res.append({
                    "id": row["id"],
                    "part_id": row["part_id"],
                    "item_code": row["item_code"] or "-",
                    "brand": row.get("brand") or "",
                    "model": row.get("model") or "",
                    "part_name": part_name,
                    "location_id": row["location_id"],
                    "location_name": row["location_name"],
                    "location_kind": row["location_kind"],
                    "quantity": row["quantity"],
                    "critical_limit": row["critical_limit"] or 50,
                    "updated_at": date_str,
                    "date": date_str
                })
            json_data = json.dumps({"success": True, "stock": res})
            write_to_cache("stock.json", json_data)
            return json.dumps({"success": True, "fetch_url": fetch_url})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, result=str)
    def get_stock_status_paged(self, search, page, page_size):
        """Depo sayfası için sunucu taraflı arama + sayfalama. Sadece Good Stock
        deposundaki kayıtları döndürür; büyük stok tablosunun tamamını istemciye
        indirmeden sadece görünen sayfayı çeker."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            page = max(1, int(page) if str(page).isdigit() else 1)
            page_size = min(200, max(1, int(page_size) if str(page_size).isdigit() else 30))
            offset = (page - 1) * page_size
            search = (search or "").strip()

            params = {"limit": page_size, "offset": offset}
            search_clause = ""
            if search:
                search_clause = """
                    AND (
                        p.item_code ILIKE :q OR p.name ILIKE :q OR p.brand ILIKE :q OR
                        p.model ILIKE :q OR p.color ILIKE :q OR p.part_category ILIKE :q OR
                        l.name ILIKE :q OR CAST(s.id AS TEXT) ILIKE :q
                    )
                """
                params["q"] = f"%{search}%"

            rows = db.execute(text(f"""
                SELECT s.id, p.id as part_id, p.brand, p.model, p.color, p.part_category, p.name as pname, p.item_code,
                       l.name as location_name, s.quantity, p.critical_limit,
                       (
                         SELECT MAX(sm.created_at)
                         FROM warehouse.stock_movements sm
                         WHERE sm.part_id = s.part_id AND (sm.source_location_id = s.location_id OR sm.target_location_id = s.location_id)
                       ) as last_movement_at,
                       COUNT(*) OVER() as total_count,
                       COALESCE(SUM(s.quantity) OVER(), 0) as total_qty
                FROM warehouse.stock s
                JOIN warehouse.parts p ON s.part_id = p.id
                JOIN warehouse.locations l ON s.location_id = l.id
                WHERE l.kind = 'good_stock'
                {search_clause}
                ORDER BY s.id DESC
                LIMIT :limit OFFSET :offset
            """), params).mappings().all()

            res = []
            total_count = 0
            total_qty = 0
            for row in rows:
                total_count = row["total_count"]
                total_qty = row["total_qty"]
                lm_at = row.get("last_movement_at")
                date_str = lm_at.strftime("%d.%m.%Y %H:%M") if lm_at else "-"
                part_name = " ".join(filter(None, [row.get("brand"), row.get("model"), row.get("color"), row.get("part_category")]))
                if not part_name:
                    part_name = (row.get("pname") or "").strip()
                if not part_name:
                    part_name = row.get("item_code") or "İsimsiz Parça"

                res.append({
                    "id": row["id"],
                    "part_id": row["part_id"],
                    "item_code": row["item_code"] or "-",
                    "part_name": part_name,
                    "location_name": row["location_name"],
                    "quantity": row["quantity"],
                    "critical_limit": row["critical_limit"] or 50,
                    "updated_at": date_str
                })

            return json.dumps({
                "success": True,
                "stock": res,
                "total": total_count,
                "total_quantity": int(total_qty or 0),
                "page": page,
                "page_size": page_size
            })
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
            loc_by_id = {l.id: l for l in locs}
            from_kind = loc_by_id.get(int(from_loc_id)).kind if loc_by_id.get(int(from_loc_id)) else None
            to_kind = loc_by_id.get(int(to_loc_id)).kind if loc_by_id.get(int(to_loc_id)) else None

            if from_kind in SYSTEM_TRANSFER_RULES:
                allowed_targets = SYSTEM_TRANSFER_RULES[from_kind]
                if to_kind not in allowed_targets:
                    from_label = SYSTEM_LOCATION_KINDS.get(from_kind, from_kind)
                    if allowed_targets:
                        allowed_labels = " veya ".join(SYSTEM_LOCATION_KINDS.get(k, k) for k in allowed_targets)
                        message = f"{from_label}'tan sadece {allowed_labels} deposuna transfer yapılabilir."
                    else:
                        message = f"{from_label} sadece çıkış deposudur, buradan başka bir depoya transfer yapılamaz."
                    return json.dumps({"success": False, "message": message})

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
                
            from_name = loc_by_id.get(int(from_loc_id)).name if loc_by_id.get(int(from_loc_id)) else ""
            to_name = loc_by_id.get(int(to_loc_id)).name if loc_by_id.get(int(to_loc_id)) else ""

            movement = StockMovement(
                type="İç Transfer",
                movement_kind="Transfer",
                quantity=qty,
                part_id=part_id,
                source_location_id=from_loc_id,
                target_location_id=to_loc_id,
                created_by=username,
                description=f"Stok Transferi: {from_name} -> {to_name}"
            )
            db.add(movement)
            db.commit()
            clear_api_cache()
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
                source_name = sloc.name if sloc else None
                target_name = tloc.name if tloc else None
                
                if not source_name:
                    if "İade" in mov.type and "İptal" not in mov.type:
                        source_name = "Good Stock"
                    elif "İptali" in mov.type:
                        source_name = "Good Stock"
                    elif mov.type == "Giriş":
                        source_name = "Dış Kaynak"
                    else:
                        source_name = "Bilinmiyor"
                        
                if not target_name:
                    if "Çıkış" in mov.type or "Tüketimi" in mov.type or ("İptal" in mov.type and "İptali" not in mov.type):
                        target_name = "Kullanım/Tüketim"
                    elif mov.type == "Çıkış":
                        target_name = "Dış Kaynak"
                    else:
                        target_name = "Bilinmiyor"
                res.append({
                    "id": mov.id,
                    "type": mov.type,
                    "quantity": mov.quantity,
                    "part_id": mov.part_id,
                    "part_name": p.name if p else (f"{mov.part_name_snapshot} (silindi)" if mov.part_name_snapshot else "Silinmiş Parça"),
                    "source_location_id": mov.source_location_id,
                    "source_location": source_name,
                    "target_location_id": mov.target_location_id,
                    "target_location": target_name,
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
            part_id = int(part_id)
            qty = int(qty)
            price = float(unit_price) if unit_price else 0.0

            # Stok Girişleri HER ZAMAN Good Stock deposuna yapılır
            target_loc = db.query(Location).filter(Location.kind == "good_stock").first()
            if not target_loc:
                return json.dumps({"success": False, "message": "Good Stock deposu bulunamadı."})
            
            location_id = target_loc.id

            stock = db.query(Stock).filter(Stock.part_id == part_id, Stock.location_id == location_id).first()
            if stock:
                stock.quantity += qty
            else:
                stock = Stock(part_id=part_id, location_id=location_id, quantity=qty)
                db.add(stock)

            mov = StockMovement(
                type=type_str or "Giriş",
                movement_kind="Inbound",
                quantity=qty,
                part_id=part_id,
                target_location_id=location_id,
                unit_price=price,
                total_cost=qty * price,
                created_by=username
            )
            db.add(mov)
            db.commit()
            clear_api_cache()
            return json.dumps({"success": True})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, str, str, str, str, result=str)
    def add_outbound_entry(self, part_id, location_id, qty, type_str, username, technician, description):
        """İrsaliye Çıkış: bir depodan dışarı (Out Stock/Scrap Stock) çıkış kaydı açar.
        source_loc.kind sistem depolarından biriyse (good_stock, doa_stock, repair_stock,
        vb.), hedef SYSTEM_TRANSFER_RULES'a göre doğrulanır -- örn. Good Stock sadece
        Repair Stock'a çıkabilir, doğrudan Out/Scrap Stock'a çıkamaz (bkz. transfer_stock,
        aynı kural kontrolü). Kural izin vermiyorsa işlem reddedilir, stok değişmez."""
        from models.stock import Stock
        from models.stock_movement import StockMovement
        from models.location import Location
        db = SessionLocal()
        try:
            part_id = int(part_id)
            location_id = int(location_id)
            qty = int(qty)

            source_loc = db.query(Location).filter(Location.id == int(location_id)).first()
            target_location_id = None
            movement_kind = None
            if source_loc and source_loc.kind in ("good_stock", "doa_stock"):
                target_kind = "scrap_stock" if type_str == "Fire" else "out_stock"

                if source_loc.kind in SYSTEM_TRANSFER_RULES and target_kind not in SYSTEM_TRANSFER_RULES[source_loc.kind]:
                    from_label = SYSTEM_LOCATION_KINDS.get(source_loc.kind, source_loc.kind)
                    allowed_targets = SYSTEM_TRANSFER_RULES[source_loc.kind]
                    if allowed_targets:
                        allowed_labels = " veya ".join(SYSTEM_LOCATION_KINDS.get(k, k) for k in allowed_targets)
                        message = f"{from_label}'tan doğrudan çıkış yapılamaz; sadece {allowed_labels} deposuna transfer yapılabilir."
                    else:
                        message = f"{from_label} sadece çıkış deposudur, buradan başka bir depoya transfer yapılamaz."
                    return json.dumps({"success": False, "message": message})

                target_location_id = _get_system_location_id(db, target_kind)
                movement_kind = "Scrap" if target_kind == "scrap_stock" else "Outbound"

            stock = db.query(Stock).with_for_update().filter(Stock.part_id == part_id, Stock.location_id == location_id).first()
            if not stock or stock.quantity < qty:
                return json.dumps({"success": False, "message": "Yetersiz stok."})

            stock.quantity -= qty

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
            clear_api_cache()
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
                    
                source_name = sloc.name if sloc else None
                target_name = tloc.name if tloc else None
                
                if not source_name:
                    if "İade" in mov.type and "İptal" not in mov.type:
                        source_name = "Good Stock"
                    elif "İptali" in mov.type:
                        source_name = "Good Stock"
                    elif mov.type == "Giriş":
                        source_name = "Dış Kaynak"
                    else:
                        source_name = "Bilinmiyor"
                        
                if not target_name:
                    if "Çıkış" in mov.type or "Tüketimi" in mov.type or ("İptal" in mov.type and "İptali" not in mov.type):
                        target_name = "Kullanım/Tüketim"
                    elif mov.type == "Çıkış":
                        target_name = "Dış Kaynak"
                    else:
                        target_name = "Bilinmiyor"
                res.append({
                    "id": mov.id,
                    "date": mov.created_at.strftime("%Y-%m-%d %H:%M") if mov.created_at else "",
                    "type": mov.type,
                    "part_name": p.name if p else (f"{mov.part_name_snapshot} (silindi)" if mov.part_name_snapshot else "-"),
                    "item_code": p.item_code if p else "-",
                    "location": loc_name,
                    "source_location": source_name,
                    "target_location": target_name,
                    "quantity": mov.quantity,
                    "user": mov.created_by,
                    "description": mov.description if mov.description else ""
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
            from sqlalchemy import or_
            today = date.today()
            today_start = datetime.combine(today, time.min)
            
            inbound_types = ["Giriş", "İç Transfer", "Yeni Alım", "Inbound", "Transfer", "Yeni Alım (Tedarikçiden)", "İade Girişi", "Diğer"]
            outbound_types = ["Çıkış", "İç Transfer", "Müşteri Satışı", "Tedarikçiye İade", "Outbound", "Transfer", "Teknik Servis", "Fire", "Fire / Bozuk", "Servis Kullanımı"]

            todays_inbound = db.query(func.sum(StockMovement.quantity)).filter(
                or_(
                    StockMovement.movement_kind == "Inbound",
                    StockMovement.type.in_(inbound_types)
                ),
                StockMovement.created_at >= today_start
            ).scalar() or 0
            
            todays_outbound = db.query(func.sum(StockMovement.quantity)).filter(
                or_(
                    StockMovement.movement_kind.in_(["Outbound", "Scrap"]),
                    StockMovement.type.in_(outbound_types)
                ),
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
        fetch_url = f"/api_cache/{filename}"
        if os.path.exists(path):
            return json.dumps({"success": True, "fetch_url": fetch_url})

        from models.stock import Stock
        from models.part import Part
        from models.location import Location
        db = SessionLocal()
        try:
            from sqlalchemy import func
            stocks = db.query(Stock, Part, Location).join(Part, Stock.part_id == Part.id).join(Location, Stock.location_id == Location.id).filter(
                Location.kind == "good_stock",
                Stock.quantity < func.coalesce(Part.critical_limit, 50)
            ).all()

            res = []
            for s, p, l in stocks:
                limit = p.critical_limit or 50
                res.append({
                    "id": s.id,
                    "part_name": p.name or "-",
                    "item_code": p.item_code or "-",
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
                
            with get_db() as db:
                # Apply SYSTEM_TRANSFER_RULES if inserting into stock_movements (e.g. via Excel)
                if table_name == 'stock_movements':
                    type_ = data.get('type')
                    movement_kind = data.get('movement_kind')
                    if type_ == "İç Transfer" or movement_kind == "Transfer":
                        from_loc_id = data.get('source_location_id')
                        to_loc_id = data.get('target_location_id')
                        if from_loc_id and to_loc_id:
                            sloc = db.execute(text("SELECT kind, name FROM warehouse.locations WHERE id = :id"), {'id': from_loc_id}).fetchone()
                            tloc = db.execute(text("SELECT kind, name FROM warehouse.locations WHERE id = :id"), {'id': to_loc_id}).fetchone()
                            if sloc and tloc:
                                from_kind = sloc[0]
                                to_kind = tloc[0]
                                if from_kind in SYSTEM_TRANSFER_RULES:
                                    allowed_targets = SYSTEM_TRANSFER_RULES[from_kind]
                                    if to_kind not in allowed_targets:
                                        allowed_labels = ", ".join(allowed_targets)
                                        if not allowed_targets:
                                            msg = f"Excel Hata: {from_kind} sadece çıkış deposudur, buradan başka depoya transfer yapılamaz."
                                        else:
                                            msg = f"Excel Hata: {from_kind}'tan sadece {allowed_labels} deposuna transfer yapılabilir."
                                        return json.dumps({"success": False, "message": msg})

                columns = list(data.keys())
                values = list(data.values())
                placeholders = ', '.join([f':{col}' for col in columns])
                col_names = ', '.join([f'"{col}"' for col in columns])
            
                query = text(f'INSERT INTO "{schema}"."{table_name}" ({col_names}) VALUES ({placeholders})')
                db.execute(query, data)
                db.commit()
                return json.dumps({"success": True})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})

    def _ensure_batch_entries_table(self):
        from sqlalchemy import text
        db = SessionLocal()
        try:
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS warehouse.batch_entries (
                    id SERIAL PRIMARY KEY,
                    customer_no VARCHAR(100),
                    customer_name VARCHAR(255),
                    imei_number VARCHAR(100),
                    serial_number VARCHAR(100),
                    internal_id VARCHAR(100),
                    batch_no VARCHAR(100),
                    model VARCHAR(255),
                    gb VARCHAR(50),
                    color VARCHAR(50),
                    unit_price NUMERIC(12, 2) DEFAULT 0.00,
                    currency VARCHAR(10) DEFAULT 'EUR',
                    defects TEXT,
                    screen_test VARCHAR(100),
                    power_test VARCHAR(100),
                    flow VARCHAR(100) DEFAULT 'Refurbish',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            """))
            # Mevcut tabloya currency, is_success, created_by kolonları yoksa ekle
            db.execute(text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'warehouse' AND table_name = 'batch_entries' AND column_name = 'currency'
                    ) THEN
                        ALTER TABLE warehouse.batch_entries ADD COLUMN currency VARCHAR(10) DEFAULT 'EUR';
                    END IF;
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'warehouse' AND table_name = 'batch_entries' AND column_name = 'is_success'
                    ) THEN
                        ALTER TABLE warehouse.batch_entries ADD COLUMN is_success BOOLEAN DEFAULT false;
                    END IF;
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'warehouse' AND table_name = 'batch_entries' AND column_name = 'created_by'
                    ) THEN
                        ALTER TABLE warehouse.batch_entries ADD COLUMN created_by VARCHAR(100) DEFAULT 'io';
                    END IF;
                END $$;
            """))
            # Müşteri para birimlerini batch_entries tablosuna senkronize et
            db.execute(text("""
                UPDATE warehouse.batch_entries b
                SET currency = c.currency
                FROM warehouse.customers c
                WHERE (LOWER(b.customer_name) = LOWER(c.customer_name) OR b.customer_no = c.code)
                  AND c.currency IS NOT NULL AND c.currency != '';
            """))
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] _ensure_batch_entries_table hatası: {e}")
        finally:
            db.close()

    @Slot(str, str, str, str, result=str)
    def get_batch_entries(self, page="1", page_size="50", search_term="", flow_filter=""):
        from sqlalchemy import text
        db = SessionLocal()
        try:
            page = max(1, int(page or 1))
            page_size = min(1000, max(1, int(page_size or 50)))
            offset = (page - 1) * page_size

            where_clauses = []
            params = {"limit": page_size, "offset": offset}

            if search_term and str(search_term).strip():
                term_raw = str(search_term).strip()
                term_like = f"%{term_raw}%"

                # Önce tam eşleşen Batch No, Internal ID, Seri No veya IMEI var mı kontrol et
                exact_count = db.execute(text("""
                    SELECT COUNT(*) FROM warehouse.batch_entries
                    WHERE LOWER(TRIM(COALESCE(batch_no, ''))) = LOWER(:t)
                       OR LOWER(TRIM(COALESCE(internal_id, ''))) = LOWER(:t)
                       OR LOWER(TRIM(COALESCE(serial_number, ''))) = LOWER(:t)
                       OR LOWER(TRIM(COALESCE(imei_number, ''))) = LOWER(:t)
                       OR LOWER(TRIM(COALESCE(customer_no, ''))) = LOWER(:t)
                """), {"t": term_raw}).scalar()

                if exact_count > 0:
                    where_clauses.append("""(
                        LOWER(TRIM(COALESCE(batch_no, ''))) = LOWER(:exact_term) OR 
                        LOWER(TRIM(COALESCE(internal_id, ''))) = LOWER(:exact_term) OR 
                        LOWER(TRIM(COALESCE(serial_number, ''))) = LOWER(:exact_term) OR 
                        LOWER(TRIM(COALESCE(imei_number, ''))) = LOWER(:exact_term) OR 
                        LOWER(TRIM(COALESCE(customer_no, ''))) = LOWER(:exact_term)
                    )""")
                    params["exact_term"] = term_raw
                else:
                    where_clauses.append("""(
                        customer_no ILIKE :search OR 
                        customer_name ILIKE :search OR 
                        imei_number ILIKE :search OR 
                        serial_number ILIKE :search OR 
                        internal_id ILIKE :search OR 
                        batch_no ILIKE :search OR 
                        model ILIKE :search OR 
                        defects ILIKE :search
                    )""")
                    params["search"] = term_like

            if flow_filter and str(flow_filter).strip() and str(flow_filter).strip().lower() != "tümü":
                where_clauses.append("flow = :flow_filter")
                params["flow_filter"] = str(flow_filter).strip()

            where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

            count_sql = f"SELECT COUNT(*) FROM warehouse.batch_entries {where_sql};"
            total = db.execute(text(count_sql), params).scalar()

            data_sql = f"""
                SELECT id, customer_no, customer_name, imei_number, serial_number, internal_id, batch_no,
                       model, gb, color, unit_price, currency, defects, screen_test, power_test, flow, created_at, updated_at
                FROM warehouse.batch_entries
                {where_sql}
                ORDER BY id DESC
                LIMIT :limit OFFSET :offset;
            """
            rows = db.execute(text(data_sql), params).mappings().all()

            records = [{
                "id": r["id"],
                "document_date": r["created_at"].strftime("%d.%m.%Y") if r["created_at"] else "-",
                "document_number": r["batch_no"] or r["internal_id"] or r["serial_number"] or r["imei_number"] or "-",
                "customer_no": r["customer_no"] or "",
                "customer_name": r["customer_name"] or "",
                "imei_number": r["imei_number"] or "",
                "serial_number": r["serial_number"] or "",
                "internal_id": r["internal_id"] or "",
                "batch_no": r["batch_no"] or "",
                "model": r["model"] or "",
                "gb": r["gb"] or "",
                "color": r["color"] or "",
                "unit_price": float(r["unit_price"]) if r["unit_price"] is not None else 0.0,
                "currency": r.get("currency", None) or "EUR",
                "defects": r["defects"] or "",
                "screen_test": r["screen_test"] or "",
                "power_test": r["power_test"] or "",
                "flow": r["flow"] or "Refurbish",
                "created_at": r["created_at"].strftime("%d.%m.%Y %H:%M") if r["created_at"] else "-",
                "updated_at": r["updated_at"].strftime("%d.%m.%Y %H:%M") if r["updated_at"] else "-"
            } for r in rows]

            return json.dumps({
                "success": True,
                "records": records,
                "total": total,
                "page": page,
                "page_size": page_size
            }, ensure_ascii=False)
        except Exception as e:
            print(f"[WebBridge] get_batch_entries hatası: {e}")
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, result=str)
    def create_batch_entry(self, data_json):
        from models.batch_entry import BatchEntry
        db = SessionLocal()
        try:
            d = json.loads(data_json or "{}")
            new_entry = BatchEntry(
                customer_no=d.get("customer_no", "").strip(),
                customer_name=d.get("customer_name", "").strip(),
                imei_number=d.get("imei_number", "").strip(),
                serial_number=d.get("serial_number", "").strip(),
                internal_id=d.get("internal_id", "").strip(),
                batch_no=d.get("batch_no", "").strip(),
                model=d.get("model", "").strip(),
                gb=d.get("gb", "").strip(),
                color=d.get("color", "").strip(),
                unit_price=float(d.get("unit_price") or 0.0),
                currency=d.get("currency", "EUR").strip() or "EUR",
                defects=d.get("defects", "").strip(),
                screen_test=d.get("screen_test", "").strip(),
                power_test=d.get("power_test", "").strip(),
                flow=d.get("flow", "Refurbish").strip() or "Refurbish"
            )
            db.add(new_entry)
            db.commit()
            return json.dumps({"success": True, "id": new_entry.id})
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] create_batch_entry hatası: {e}")
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, result=str)
    def update_batch_entry(self, entry_id, data_json):
        from models.batch_entry import BatchEntry
        from datetime import datetime
        db = SessionLocal()
        try:
            entry = db.query(BatchEntry).filter(BatchEntry.id == int(entry_id)).first()
            if not entry:
                return json.dumps({"success": False, "message": "Kayıt bulunamadı."})

            d = json.loads(data_json or "{}")
            entry.customer_no = d.get("customer_no", entry.customer_no).strip()
            entry.customer_name = d.get("customer_name", entry.customer_name).strip()
            entry.imei_number = d.get("imei_number", entry.imei_number).strip()
            entry.serial_number = d.get("serial_number", entry.serial_number).strip()
            entry.internal_id = d.get("internal_id", entry.internal_id).strip()
            entry.batch_no = d.get("batch_no", entry.batch_no).strip()
            entry.model = d.get("model", entry.model).strip()
            entry.gb = d.get("gb", entry.gb).strip()
            entry.color = d.get("color", entry.color).strip()
            if "unit_price" in d:
                entry.unit_price = float(d.get("unit_price") or 0.0)
            if "currency" in d:
                entry.currency = d.get("currency", entry.currency).strip() or "EUR"
            entry.defects = d.get("defects", entry.defects).strip()
            entry.screen_test = d.get("screen_test", entry.screen_test).strip()
            entry.power_test = d.get("power_test", entry.power_test).strip()
            if "flow" in d:
                entry.flow = d.get("flow", entry.flow).strip()
            entry.updated_at = datetime.now()

            db.commit()
            return json.dumps({"success": True})
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] update_batch_entry hatası: {e}")
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, result=str)
    def delete_batch_entry(self, entry_id):
        from models.batch_entry import BatchEntry
        db = SessionLocal()
        try:
            entry = db.query(BatchEntry).filter(BatchEntry.id == int(entry_id)).first()
            if not entry:
                return json.dumps({"success": False, "message": "Kayıt bulunamadı."})
            db.delete(entry)
            db.commit()
            return json.dumps({"success": True})
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] delete_batch_entry hatası: {e}")
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(result=str)
    def get_batch_summary(self):
        from sqlalchemy import text
        db = SessionLocal()
        try:
            self._ensure_batch_entries_table()
            try:
                self.sync_customers_to_batch_entries()
            except Exception as sync_err:
                print(f"[WebBridge] sync_customers_to_batch_entries hatası: {sync_err}")

            sql = """
                SELECT
                    COALESCE(MAX(NULLIF(b.customer_no, '')), MAX(NULLIF(c.code, '')), 'Tanımsız Müşteri') AS document_number,
                    STRING_AGG(DISTINCT NULLIF(b.batch_no, ''), ', ') AS batch_no,
                    COALESCE(MAX(NULLIF(b.customer_name, '')), MAX(NULLIF(c.customer_name, '')), 'Tanımsız Müşteri') AS account_name,
                    COALESCE(MAX(NULLIF(b.customer_name, '')), MAX(NULLIF(c.customer_name, '')), 'Tanımsız Müşteri') AS customer_name,
                    COALESCE(MAX(NULLIF(b.customer_no, '')), MAX(NULLIF(c.code, '')), '-') AS customer_no,
                    COUNT(*) AS item_quantity,
                    COUNT(*) AS total_devices,
                    SUM(COALESCE(b.unit_price, 0)) AS total_price,
                    COALESCE(MAX(NULLIF(c.currency, '')), MAX(NULLIF(b.currency, '')), 'EUR') AS currency,
                    COALESCE(BOOL_AND(COALESCE(b.is_success, false)), false) AS is_success,
                    COALESCE(MAX(NULLIF(b.created_by, '')), 'io') AS create_by,
                    MAX(b.created_at) AS last_created
                FROM warehouse.batch_entries b
                LEFT JOIN warehouse.customers c ON (LOWER(b.customer_name) = LOWER(c.customer_name) OR b.customer_no = c.code)
                GROUP BY COALESCE(NULLIF(b.customer_no, ''), NULLIF(b.customer_name, ''), 'Tanımsız Müşteri')
                ORDER BY MAX(b.created_at) DESC;
            """
            rows = db.execute(text(sql)).mappings().all()

            batches = [{
                "document_date": r["last_created"].strftime("%d.%m.%Y") if r["last_created"] else "-",
                "document_number": r["document_number"],
                "account_name": r["account_name"] or "-",
                "is_success": bool(r["is_success"]),
                "item_quantity": int(r["item_quantity"]),
                "currency": r["currency"] or "EUR",
                "create_by": r["create_by"] or "io",

                # Legacy/compatibility fields
                "batch_no": r["batch_no"],
                "customer_name": r["customer_name"] or "-",
                "customer_no": r["customer_no"] or "-",
                "total_devices": int(r["total_devices"]),
                "total_price": float(r["total_price"] or 0.0),
                "last_created": r["last_created"].strftime("%d.%m.%Y %H:%M") if r["last_created"] else "-"
            } for r in rows]

            return json.dumps({"success": True, "batches": batches}, ensure_ascii=False)
        except Exception as e:
            print(f"[WebBridge] get_batch_summary hatası: {e}")
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(result=str)
    def clear_all_batch_entries(self):
        from sqlalchemy import text
        db = SessionLocal()
        try:
            db.execute(text("TRUNCATE TABLE warehouse.batch_entries RESTART IDENTITY;"))
            db.commit()
            return json.dumps({"success": True, "message": "Tüm Batch kayıtları başarıyla temizlendi."})
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] clear_all_batch_entries hatası: {e}")
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, result=str)
    def bulk_delete_batch_entries(self, ids_json):
        from models.batch_entry import BatchEntry
        db = SessionLocal()
        try:
            ids = json.loads(ids_json or "[]")
            if not ids:
                return json.dumps({"success": False, "message": "Silinecek kayıt seçilmedi."})
            int_ids = [int(i) for i in ids]
            db.query(BatchEntry).filter(BatchEntry.id.in_(int_ids)).delete(synchronize_session=False)
            db.commit()
            return json.dumps({"success": True, "count": len(int_ids)})
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] bulk_delete_batch_entries hatası: {e}")
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, result=str)
    def bulk_update_batch_flow(self, ids_json, new_flow):
        from models.batch_entry import BatchEntry
        from datetime import datetime
        db = SessionLocal()
        try:
            ids = json.loads(ids_json or "[]")
            if not ids or not new_flow:
                return json.dumps({"success": False, "message": "Kayıt veya durum seçilmedi."})
            int_ids = [int(i) for i in ids]
            db.query(BatchEntry).filter(BatchEntry.id.in_(int_ids)).update(
                {BatchEntry.flow: str(new_flow).strip(), BatchEntry.updated_at: datetime.now()},
                synchronize_session=False
            )
            db.commit()
            return json.dumps({"success": True, "count": len(int_ids)})
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] bulk_update_batch_flow hatası: {e}")
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, result=str)
    def lookup_batch_entry(self, search_term):
        from models.batch_entry import BatchEntry
        from sqlalchemy import func, text
        db = SessionLocal()
        try:
            term = (search_term or "").strip()
            if not term or len(term) < 2:
                return json.dumps({"success": False, "message": "Arama terimi çok kısa."})
            
            term_lower = term.lower()
            
            # 1. Search in warehouse.batch_entries (Exact Match)
            entry = db.query(BatchEntry).filter(
                (func.lower(func.trim(BatchEntry.imei_number)) == term_lower) |
                (func.lower(func.trim(BatchEntry.serial_number)) == term_lower) |
                (func.lower(func.trim(BatchEntry.internal_id)) == term_lower) |
                (func.lower(func.trim(BatchEntry.batch_no)) == term_lower) |
                (func.lower(func.trim(BatchEntry.customer_no)) == term_lower)
            ).order_by(BatchEntry.id.desc()).first()

            # 2. Search in warehouse.batch_entries (ILIKE Partial Match)
            if not entry and len(term) >= 3:
                entry = db.query(BatchEntry).filter(
                    (BatchEntry.imei_number.ilike(f"%{term}%")) |
                    (BatchEntry.serial_number.ilike(f"%{term}%")) |
                    (BatchEntry.internal_id.ilike(f"%{term}%")) |
                    (BatchEntry.batch_no.ilike(f"%{term}%")) |
                    (BatchEntry.customer_no.ilike(f"%{term}%"))
                ).order_by(BatchEntry.id.desc()).first()

            if entry:
                data = {
                    "customer_no": entry.customer_no or '',
                    "customer_name": entry.customer_name or '',
                    "imei_number": entry.imei_number or '',
                    "serial_number": entry.serial_number or '',
                    "internal_id": entry.internal_id or '',
                    "batch_no": entry.batch_no or '',
                    "model": entry.model or '',
                    "gb": entry.gb or '',
                    "color": entry.color or '',
                    "unit_price": float(entry.unit_price or 0.0),
                    "currency": entry.currency or 'EUR',
                    "defects": entry.defects or '',
                    "screen_test": entry.screen_test or '',
                    "power_test": entry.power_test or '',
                    "flow": entry.flow or 'Refurbish'
                }
                return json.dumps({"success": True, "found": True, "data": data}, ensure_ascii=False)

            # 3. Search in warehouse.customers (MIO Create)
            c_row = db.execute(text("""
                SELECT id, customer_name, code, short_name, imei_number, serial_number, internal_id,
                       brand, model, flow, customer_reported_complaint, currency
                FROM warehouse.customers
                WHERE LOWER(TRIM(COALESCE(imei_number, ''))) = LOWER(:t)
                   OR LOWER(TRIM(COALESCE(serial_number, ''))) = LOWER(:t)
                   OR LOWER(TRIM(COALESCE(internal_id, ''))) = LOWER(:t)
                   OR LOWER(TRIM(COALESCE(code, ''))) = LOWER(:t)
                   OR LOWER(TRIM(CONCAT('BATCH-MIO-', id))) = LOWER(:t)
                   OR (LENGTH(:t) >= 3 AND (
                       COALESCE(imei_number, '') ILIKE :t_like OR
                       COALESCE(serial_number, '') ILIKE :t_like OR
                       COALESCE(internal_id, '') ILIKE :t_like OR
                       COALESCE(code, '') ILIKE :t_like
                   ))
                ORDER BY id DESC LIMIT 1
            """), {"t": term, "t_like": f"%{term}%"}).mappings().first()

            if c_row:
                data = {
                    "customer_no": c_row["code"] or '',
                    "customer_name": c_row["short_name"] or c_row["customer_name"] or '',
                    "imei_number": c_row["imei_number"] or '',
                    "serial_number": c_row["serial_number"] or '',
                    "internal_id": c_row["internal_id"] or '',
                    "batch_no": f"BATCH-MIO-{c_row['id']}",
                    "model": f"{c_row['brand'] or ''} {c_row['model'] or ''}".strip(),
                    "gb": '',
                    "color": '',
                    "unit_price": 0.0,
                    "currency": c_row["currency"] or 'EUR',
                    "defects": c_row["customer_reported_complaint"] or '',
                    "screen_test": '',
                    "power_test": '',
                    "flow": c_row["flow"] if c_row["flow"] in ['Refurbish', 'Repair', 'RMA', 'Battery Replacement'] else 'Refurbish'
                }
                return json.dumps({"success": True, "found": True, "data": data}, ensure_ascii=False)

            return json.dumps({"success": True, "found": False})
        except Exception as e:
            print(f"[WebBridge] lookup_batch_entry hatası: {e}")
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(result=str)
    def sync_customers_to_batch_entries(self):
        """Müşteriler/MIO tablosundaki cihaz ve müşteri kayıtlarını Batch Girişi tablosuna aktarır."""
        from models.batch_entry import BatchEntry
        from sqlalchemy import text, or_
        from datetime import datetime
        db = SessionLocal()
        try:
            rows = db.execute(text("""
                SELECT id, customer_name, code, short_name, imei_number, serial_number, internal_id,
                       brand, model, flow, customer_reported_complaint, currency, created_at
                FROM warehouse.customers
            """)).mappings().all()

            added_count = 0
            for r in rows:
                imei = (r["imei_number"] or "").strip()
                serial = (r["serial_number"] or "").strip()
                internal = (r["internal_id"] or "").strip()
                c_no = (r["code"] or "").strip()
                c_name = (r["short_name"] or r["customer_name"] or "").strip()
                mio_batch_no = f"BATCH-MIO-{r['id']}"

                filters = [BatchEntry.batch_no == mio_batch_no]
                if imei: filters.append(BatchEntry.imei_number == imei)
                if serial: filters.append(BatchEntry.serial_number == serial)
                if internal: filters.append(BatchEntry.internal_id == internal)
                
                existing = db.query(BatchEntry).filter(or_(*filters)).first()

                if existing:
                    changed = False
                    if c_name and existing.customer_name != c_name:
                        existing.customer_name = c_name
                        changed = True
                    if c_no and existing.customer_no != c_no:
                        existing.customer_no = c_no
                        changed = True
                    if r["currency"] and existing.currency != r["currency"].upper():
                        existing.currency = r["currency"].upper()
                        changed = True
                    if changed:
                        existing.updated_at = datetime.now()
                else:
                    full_model = " ".join(filter(None, [r["brand"], r["model"]])).strip()
                    flow_val = (r["flow"] or "").strip()
                    if flow_val not in ['Refurbish', 'Repair', 'RMA', 'Battery Replacement']:
                        flow_val = 'Refurbish'

                    new_entry = BatchEntry(
                        customer_no=c_no or 'MIO-001',
                        customer_name=c_name or 'MIO Müşterisi',
                        imei_number=imei,
                        serial_number=serial,
                        internal_id=internal,
                        batch_no=mio_batch_no,
                        model=full_model,
                        gb='',
                        color='',
                        unit_price=0.0,
                        currency=(r["currency"] or 'TRY').upper(),
                        defects=r["customer_reported_complaint"] or '',
                        screen_test='',
                        power_test='',
                        flow=flow_val,
                        created_at=r["created_at"] or datetime.now(),
                        updated_at=datetime.now()
                    )
                    db.add(new_entry)
                    added_count += 1

            db.commit()
            return json.dumps({"success": True, "added_count": added_count})
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] sync_customers_to_batch_entries hatası: {e}")
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()





