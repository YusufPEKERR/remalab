"""
RemaLab WMS - Modül 4 Seed Data Betiği
MioCreate.xlsx'ten Repair & Warranty sekmelerini okur ve veritabanına aktarır.
"""
import os
import sys
import uuid
import pandas as pd
from sqlalchemy.exc import IntegrityError
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.database import get_engine, get_session_factory, Base

# Import models
from models.repair_result_type import RepairResultType
from models.repair_item_operation_type import RepairItemOperationType
from models.repair_item_warranty import RepairItemWarranty
from models.product_family_mission import ProductFamilyMission

EXCEL_FILE = os.path.join(os.path.dirname(__file__), "MioCreate.xlsx")

def read_sheet(fp, name):
    df = pd.read_excel(fp, sheet_name=name, header=2)
    df = df.where(pd.notnull(df), None)
    return df

def to_uuid(val):
    if not val or pd.isna(val): return uuid.uuid4()
    if isinstance(val, uuid.UUID): return val
    try: return uuid.UUID(str(val))
    except: return uuid.uuid4()

def to_bool(val):
    if val is None or pd.isna(val): return False
    if isinstance(val, bool): return val
    if isinstance(val, str): return val.upper() in ("TRUE", "1", "YES", "EVET")
    return bool(val)

def to_float(val):
    if val is None or pd.isna(val): return None
    try: return float(val)
    except: return None

def to_int(val):
    if val is None or pd.isna(val): return None
    try: return int(float(val))
    except: return None

def to_str(val):
    if val is None or pd.isna(val): return None
    return str(val)

def upsert(session, model, records, id_col="id"):
    added, updated = 0, 0
    for rec in records:
        try:
            with session.begin_nested():
                rec_id = rec.get(id_col)
                rec_code = rec.get("code")
                
                existing = None
                if rec_id and not pd.isna(rec_id):
                    existing = session.query(model).filter_by(**{id_col: rec_id}).first()
                if not existing and rec_code and not pd.isna(rec_code):
                    existing = session.query(model).filter_by(code=rec_code).first()
                    
                if existing:
                    for k, v in rec.items():
                        if k != id_col: setattr(existing, k, v)
                    updated += 1
                else:
                    if not rec_id or pd.isna(rec_id):
                        rec[id_col] = uuid.uuid4()
                    session.add(model(**rec))
                    added += 1
        except IntegrityError as e:
            pass
    return added, updated

def seed_repair_result_type(s, df):
    recs = [{"id": to_uuid(r.get("id")), "code": to_int(r.get("code")), "order_number": to_int(r.get("orderNumber")), "short_name": to_str(r.get("shortName")), "language": to_str(r.get("language")), "is_success": to_bool(r.get("isSuccess")), "is_cancelled": to_bool(r.get("isCancelled")), "update": to_bool(r.get("update"))} for _, r in df.iterrows()]
    return upsert(s, RepairResultType, recs)

def seed_repair_item_operation_type(s, df):
    recs = [{"id": to_uuid(r.get("id")), "order_number": to_int(r.get("orderNumber")), "code": to_str(r.get("code")), "language": to_str(r.get("language")), "short_name": to_str(r.get("shortName")), "full_name": to_str(r.get("fullName")), "description": to_str(r.get("description")), "cost_center": to_str(r.get("costCenter")), "update": to_bool(r.get("update"))} for _, r in df.iterrows()]
    return upsert(s, RepairItemOperationType, recs)

def seed_repair_item_warranty(s, df):
    recs = [{"id": to_uuid(r.get("id")), "order_number": to_int(r.get("orderNumber")), "code": to_str(r.get("code")), "language": to_str(r.get("language")), "short_name": to_str(r.get("shortName")), "full_name": to_str(r.get("fullName")), "description": to_str(r.get("description")), "cost_center": to_str(r.get("costCenter")), "is_paid_for": to_bool(r.get("isPaidFor")), "update": to_bool(r.get("update"))} for _, r in df.iterrows()]
    return upsert(s, RepairItemWarranty, recs)

def seed_product_family_mission(s, df):
    recs = [{"id": to_uuid(r.get("id")), "order_number": to_float(r.get("orderNumber")), "code": to_str(r.get("code")), "mission": to_str(r.get("mission")), "product_family": to_str(r.get("productFamily")), "validation": to_str(r.get("validation")), "update": to_bool(r.get("update"))} for _, r in df.iterrows()]
    return upsert(s, ProductFamilyMission, recs)

def main():
    print("Modül 4 Seed Başlıyor...", flush=True)
    Base.metadata.create_all(bind=get_engine())
    session = get_session_factory()()
    
    tasks = [
        ("RepairResultType", seed_repair_result_type),
        ("RepairItemOperationType", seed_repair_item_operation_type),
        ("RepairItemWarranty", seed_repair_item_warranty),
        ("ProductFamilyMission", seed_product_family_mission)
    ]
    
    try:
        xls = pd.ExcelFile(EXCEL_FILE)
        for name, func in tasks:
            if name in xls.sheet_names:
                df = read_sheet(EXCEL_FILE, name)
                a, u = func(session, df)
                session.commit()
                print(f"[OK] {name:25s} -> {len(df):5d} read, {a:4d} added, {u:4d} updated", flush=True)
        print("TUM SEED ISLEMI BASARILI!", flush=True)
    except Exception as e:
        session.rollback()
        import traceback
        traceback.print_exc()
        print("HATA:", str(e), flush=True)
    finally:
        session.close()

if __name__ == "__main__":
    main()
