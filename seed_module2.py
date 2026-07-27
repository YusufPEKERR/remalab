"""
RemaLab WMS - Modül 2 Seed Data Betiği
MioCreate.xlsx'ten 15 sekmeyi okur ve veritabanına aktarır.
"""
import os
import sys
import math
import uuid
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.database import get_engine, get_session_factory, Base

# Import models
from models.item_type import ItemType
from models.item_category import ItemCategory
from models.item_category_mission import ItemCategoryMission
from models.item_labour import ItemLabour
from models.item_fault import ItemFault
from models.symptom import Symptom
from models.item_supply_status import ItemSupplyStatus
from models.item import Item
from models.product_family import ProductFamily
from models.product_category import ProductCategory
from models.brand import Brand
from models.product_model import ProductModel
from models.product_node import ProductNode
from models.item_bom_node import ItemBomNode
from models.product_bom_node import ProductBomNode

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

from sqlalchemy.exc import IntegrityError

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
            # Skip this row if there's a constraint violation we can't easily resolve
            pass
            
    return added, updated

def seed_item_type(s, df):
    recs = [{"id": to_uuid(r.get("id")), "order_number": to_int(r.get("orderNumber")), "code": to_str(r.get("code")), "language": to_str(r.get("language")), "short_name": to_str(r.get("shortName")), "update": to_bool(r.get("update"))} for _, r in df.iterrows()]
    return upsert(s, ItemType, recs)

def seed_item_category(s, df):
    recs = [{"id": to_uuid(r.get("id")), "code": to_str(r.get("code")), "order_number": to_float(r.get("orderNumber")), "short_name": to_str(r.get("shortName")), "enabled": to_bool(r.get("enabled")), "is_pre_approved": to_bool(r.get("isPreApproved")), "is_plus_item_price": to_bool(r.get("isPlusItemPrice")), "item_labour": to_str(r.get("itemLabour")), "update": to_bool(r.get("update"))} for _, r in df.iterrows()]
    return upsert(s, ItemCategory, recs)

def seed_item_category_mission(s, df):
    recs = [{"id": to_uuid(r.get("id")), "order_number": to_float(r.get("orderNumber")), "code": to_str(r.get("code")), "item_category": to_str(r.get("itemCategory")), "mission": to_str(r.get("mission")), "enabled": to_bool(r.get("enabled")), "update": to_bool(r.get("update"))} for _, r in df.iterrows()]
    return upsert(s, ItemCategoryMission, recs)

def seed_item_labour(s, df):
    recs = [{"id": to_uuid(r.get("id")), "code": to_str(r.get("code")), "order_number": to_int(r.get("orderNumber")), "language": to_str(r.get("language")), "short_name": to_str(r.get("shortName")), "full_name": to_float(r.get("fullName")), "description": to_float(r.get("description")), "cost_center": to_float(r.get("costCenter")), "item_type": to_str(r.get("itemType")), "update": to_bool(r.get("update"))} for _, r in df.iterrows()]
    return upsert(s, ItemLabour, recs)

def seed_item_fault(s, df):
    recs = [{"id": to_uuid(r.get("id")), "order_number": to_float(r.get("orderNumber")), "code": to_str(r.get("code")), "language": to_str(r.get("language")), "short_name": to_str(r.get("shortName")), "item_category": to_str(r.get("itemCategory")), "validation": to_str(r.get("validation")), "update": to_bool(r.get("update"))} for _, r in df.iterrows()]
    return upsert(s, ItemFault, recs)

def seed_symptom(s, df):
    recs = [{"id": to_uuid(r.get("id")), "order_number": to_float(r.get("orderNumber")), "code": to_str(r.get("code")), "short_name": to_str(r.get("shortName")), "group_name": to_str(r.get("groupName")), "mission_group": to_str(r.get("missionGroup")), "item_category": to_str(r.get("itemCategory")), "update": to_bool(r.get("update"))} for _, r in df.iterrows()]
    return upsert(s, Symptom, recs)

def seed_item_supply(s, df):
    recs = [{"id": to_uuid(r.get("id")), "order_number": to_int(r.get("orderNumber")), "code": to_str(r.get("code")), "language": to_str(r.get("language")), "short_name": to_str(r.get("shortName")), "full_name": to_float(r.get("fullName")), "description": to_float(r.get("description")), "cost_center": to_float(r.get("costCenter")), "is_success": to_bool(r.get("isSuccess")), "is_cancelled": to_bool(r.get("isCancelled")), "update": to_bool(r.get("update"))} for _, r in df.iterrows()]
    return upsert(s, ItemSupplyStatus, recs)

def seed_item(s, df):
    recs = [{"id": to_uuid(r.get("id")), "code": to_str(r.get("code")), "short_name": to_str(r.get("shortName")), "color": to_str(r.get("color")), "item_type": to_str(r.get("itemType")), "item_category": to_str(r.get("itemCategory")), "enabled": to_bool(r.get("enabled")), "update": to_bool(r.get("update")), "alis": to_float(r.get("alis")), "satis": to_float(r.get("satis"))} for _, r in df.iterrows()]
    return upsert(s, Item, recs)

def seed_pf(s, df):
    recs = [{"id": to_uuid(r.get("id")), "order_number": to_int(r.get("orderNumber")), "code": to_str(r.get("code")), "language": to_str(r.get("language")), "short_name": to_str(r.get("shortName")), "brand": to_str(r.get("brand")), "update": to_bool(r.get("update"))} for _, r in df.iterrows()]
    return upsert(s, ProductFamily, recs)

def seed_pc(s, df):
    recs = [{"id": to_uuid(r.get("id")), "order_number": to_int(r.get("orderNumber")), "code": to_str(r.get("code")), "language": to_str(r.get("language")), "short_name": to_str(r.get("shortName")), "full_name": to_float(r.get("fullName")), "description": to_float(r.get("description")), "update": to_bool(r.get("update"))} for _, r in df.iterrows()]
    return upsert(s, ProductCategory, recs)

def seed_brand(s, df):
    recs = [{"id": to_uuid(r.get("id")), "order_number": to_int(r.get("orderNumber")), "code": to_str(r.get("code")), "language": to_str(r.get("language")), "short_name": to_str(r.get("shortName")), "full_name": to_float(r.get("fullName")), "description": to_float(r.get("description")), "update": to_bool(r.get("update"))} for _, r in df.iterrows()]
    return upsert(s, Brand, recs)

def seed_pm(s, df):
    recs = [{"id": to_uuid(r.get("id")), "order_number": to_int(r.get("orderNumber")), "code": to_str(r.get("code")), "language": to_str(r.get("language")), "short_name": to_str(r.get("shortName")), "brand": to_str(r.get("brand")), "product_family": to_str(r.get("productFamily")), "repair_time": to_int(r.get("repairTime")), "is_vip": to_bool(r.get("isVip")), "has_water_resistance": to_bool(r.get("hasWaterResistance")), "is_pre_approved_price": to_bool(r.get("isPreApprovedPrice")), "is_auto_repair": to_bool(r.get("isAutoRepair")), "service_brand": to_str(r.get("serviceBrand")), "enabled": to_bool(r.get("enabled")), "update": to_bool(r.get("update"))} for _, r in df.iterrows()]
    return upsert(s, ProductModel, recs)

def seed_product(s, df):
    recs = [{"id": to_uuid(r.get("id")), "code": to_str(r.get("code")), "product_model": to_str(r.get("productModel")), "short_name": to_str(r.get("shortName")), "color": to_str(r.get("color")), "brand": to_str(r.get("brand")), "update": to_bool(r.get("update")), "enabled": to_bool(r.get("enabled"))} for _, r in df.iterrows()]
    return upsert(s, ProductNode, recs)

def seed_item_bom(s, df):
    # s.query(ItemBomNode).delete()
    added = 0
    seen = set()
    for _, row in df.iterrows():
        parent_code = to_str(row.get("UretilenParcaKodu"))
        if not parent_code: continue
        for i in range(1, 11):
            child_col = f"Tuketilen Parca_{i}"
            qty_col = f"Tuketilen Parca_{i}_Miktar"
            child = to_str(row.get(child_col))
            qty = to_int(row.get(qty_col))
            if child:
                key = (parent_code, child)
                if key in seen: continue
                seen.add(key)
                
                # Check exist
                ex = s.query(ItemBomNode).filter_by(parent_item_code=parent_code, child_item_code=child).first()
                if not ex:
                    s.add(ItemBomNode(parent_item_code=parent_code, child_item_code=child, quantity=qty or 1))
                    added += 1
    return added, 0

def seed_product_bom(s, df):
    # s.query(ProductBomNode).delete()
    added = 0
    seen = set()
    for _, row in df.iterrows():
        parent_code = to_str(row.get("UretilenUrunKodu"))
        if not parent_code: continue
        for i in range(1, 11):
            child_col = f"Tuketilen Parca_{i}"
            qty_col = f"Tuketilen Parca_{i}_Miktar"
            child = to_str(row.get(child_col))
            qty = to_int(row.get(qty_col))
            if child:
                key = (parent_code, child)
                if key in seen: continue
                seen.add(key)
                
                # Check exist
                ex = s.query(ProductBomNode).filter_by(parent_product_code=parent_code, child_item_code=child).first()
                if not ex:
                    s.add(ProductBomNode(parent_product_code=parent_code, child_item_code=child, quantity=qty or 1))
                    added += 1
    return added, 0


def main():
    print("Modül 2 Seed Başlıyor...")
    Base.metadata.create_all(bind=get_engine())
    session = get_session_factory()()
    
    tasks = [
        ("ItemType", seed_item_type),
        ("ItemCategory", seed_item_category),
        ("ItemCategoryMission", seed_item_category_mission),
        ("ItemLabour", seed_item_labour),
        ("ItemFault", seed_item_fault),
        ("Symptom", seed_symptom),
        ("ItemSupplyStatu", seed_item_supply),
        ("Item", seed_item),
        ("ProductFamily", seed_pf),
        ("ProductCategory", seed_pc),
        ("Brand", seed_brand),
        ("ProductModel", seed_pm),
        ("Product", seed_product),
        ("ItemBom", seed_item_bom),
        ("ProductBom", seed_product_bom)
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
        print("HATA:", str(e))
    finally:
        session.close()

if __name__ == "__main__":
    main()
