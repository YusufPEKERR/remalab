"""
RemaLab WMS - Modül 3 Seed Data Betiği
MioCreate.xlsx'ten State Machine sekmelerini okur ve veritabanına aktarır.
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
from models.service_statu import ServiceStatu
from models.service_statu_map import ServiceStatuMap
from models.service_request_type import ServiceRequestType
from models.service_test_type import ServiceTestType
from models.service_test_result_type import ServiceTestResultType
from models.service_result_type import ServiceResultType
from models.service_request_item_category import ServiceRequestItemCategory

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

def seed_service_statu(s, df):
    recs = [{"id": to_uuid(r.get("id")), "code": to_int(r.get("code")), "order_number": to_float(r.get("orderNumber")), "language": to_str(r.get("language")), "short_name": to_str(r.get("shortName")), "full_name": to_str(r.get("fullName")), "description": to_str(r.get("description")), "cost_center": to_str(r.get("costCenter")), "mission": to_str(r.get("mission")), "is_closed": to_bool(r.get("isClosed")), "is_repair_continue": to_bool(r.get("IsRepairContinue")), "enabled": to_bool(r.get("enabled")), "update": to_bool(r.get("update"))} for _, r in df.iterrows()]
    return upsert(s, ServiceStatu, recs)

def seed_service_statu_map(s, df):
    recs = [{"id": to_uuid(r.get("id")), "order_number": to_int(r.get("orderNumber")), "code": to_str(r.get("code")), "parent_statu": to_int(r.get("parentStatu")), "child_statu": to_int(r.get("childStatu")), "is_positive": to_bool(r.get("isPositive")), "is_user_change_statu": to_bool(r.get("isUserChangeStatu")), "kontrol_1": to_str(r.get("Kontrol1")), "kontrol_2": to_str(r.get("Kontrol2")), "kontrol_3": to_str(r.get("Kontrol3")), "to_dest": to_str(r.get("to")), "short_name": to_str(r.get("shortName")), "full_name": to_str(r.get("fullName")), "description": to_str(r.get("description")), "enabled": to_bool(r.get("enabled")), "mio_control": to_str(r.get("mioControl")), "update": to_bool(r.get("update"))} for _, r in df.iterrows()]
    return upsert(s, ServiceStatuMap, recs)

def seed_service_request_type(s, df):
    recs = [{"id": to_uuid(r.get("id")), "code": to_str(r.get("code")), "order_number": to_int(r.get("orderNumber")), "language": to_str(r.get("language")), "short_name": to_str(r.get("shortName")), "update": to_bool(r.get("update"))} for _, r in df.iterrows()]
    return upsert(s, ServiceRequestType, recs)

def seed_service_test_type(s, df):
    recs = [{"id": to_uuid(r.get("id")), "order_number": to_float(r.get("orderNumber")), "code": to_str(r.get("code")), "language": to_str(r.get("language")), "short_name": to_str(r.get("shortName")), "is_success": to_bool(r.get("isSuccess")), "update": to_bool(r.get("update"))} for _, r in df.iterrows()]
    return upsert(s, ServiceTestType, recs)

def seed_service_test_result_type(s, df):
    recs = [{"id": to_uuid(r.get("id")), "order_number": to_int(r.get("orderNumber")), "code": to_str(r.get("code")), "language": to_str(r.get("language")), "short_name": to_str(r.get("shortName")), "is_success": to_bool(r.get("isSuccess")), "enabled": to_bool(r.get("enabled")), "update": to_bool(r.get("update"))} for _, r in df.iterrows()]
    return upsert(s, ServiceTestResultType, recs)

def seed_service_result_type(s, df):
    recs = [{"id": to_uuid(r.get("id")), "code": to_str(r.get("code")), "order_number": to_int(r.get("orderNumber")), "short_name": to_str(r.get("shortName")), "full_name": to_str(r.get("fullName")), "description": to_str(r.get("description")), "cost_center": to_str(r.get("costCenter")), "language": to_str(r.get("language")), "is_success": to_bool(r.get("isSuccess")), "is_enabled": to_float(r.get("isEnabled")), "update": to_bool(r.get("update"))} for _, r in df.iterrows()]
    return upsert(s, ServiceResultType, recs)

def seed_service_request_item_category(s, df):
    recs = [{"id": to_uuid(r.get("id")), "code": to_str(r.get("code")), "service_request_type": to_str(r.get("serviceRequestType")), "item_category": to_str(r.get("itemCategory")), "is_customer_approved": to_bool(r.get("isCustomerApproved")), "update": to_bool(r.get("update"))} for _, r in df.iterrows()]
    return upsert(s, ServiceRequestItemCategory, recs)

def main():
    print("Modül 3 Seed Başlıyor...", flush=True)
    Base.metadata.create_all(bind=get_engine())
    session = get_session_factory()()
    
    tasks = [
        ("ServiceStatu", seed_service_statu),
        ("ServiceStatuMap", seed_service_statu_map),
        ("ServiceRequestType", seed_service_request_type),
        ("ServiceTestType", seed_service_test_type),
        ("ServiceTestResultType", seed_service_test_result_type),
        ("ServiceResultType", seed_service_result_type),
        ("ServiceRequestItemCategory", seed_service_request_item_category)
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
