"""
RemaLab WMS – Organization Seed Data Betiği
MioCreate.xlsx'ten 11 organizasyon sekmesini okur ve veritabanına aktarır.

Kullanım:
    python seed_organization.py

Kritik:
  - Tablo başlıkları (sütun adları) 3. satırda (index 2).
  - İlk 2 satır iş mantığı açıklamalarıdır.
  - Veriler 4. satırdan itibaren başlar.
  - UPSERT mantığı: id bazlı ON CONFLICT UPDATE.
"""

import os
import sys
import math
from datetime import datetime

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import text

load_dotenv()

# Proje kökünü sys.path'e ekle
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.database import get_engine, get_session_factory, Base

# --- Model importları ---
from models.cost_center import CostCenter
from models.branch import Branch
from models.warehouse import Warehouse
from models.stock_place import StockPlace
from models.contact_type import ContactType
from models.customer import Customer
from models.customer_target_service_price import CustomerTargetServicePrice
from models.mission_group import MissionGroup
from models.mission_workgroup import MissionWorkgroup
from models.mission import Mission
from models.staff import Staff

EXCEL_FILE = os.path.join(os.path.dirname(__file__), "MioCreate.xlsx")


# ─────────────────────────────────────────────────────────────────────────────
# Yardımcı fonksiyonlar
# ─────────────────────────────────────────────────────────────────────────────

def read_sheet(file_path: str, sheet_name: str) -> pd.DataFrame:
    """Bir sekmeyi okur (başlıklar 3. satır, index=2)."""
    df = pd.read_excel(file_path, sheet_name=sheet_name, header=2)
    # NaN → None
    df = df.where(pd.notnull(df), None)
    return df


def clean_val(val):
    """NaN / None / float NaN → None, diğerlerini olduğu gibi bırak."""
    if val is None:
        return None
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    return val


def to_uuid(val):
    """String UUID'yi olduğu gibi döndür, None ise None."""
    import uuid as _uuid
    if val is None:
        return None
    if isinstance(val, _uuid.UUID):
        return val
    try:
        return _uuid.UUID(str(val))
    except (ValueError, AttributeError):
        return None


def to_bool(val):
    """Çeşitli bool formatlarını normalize et."""
    if val is None:
        return None
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.upper() in ("TRUE", "1", "YES", "EVET")
    return bool(val)


def to_datetime(val):
    """Tarih değerini datetime'a çevir."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    if isinstance(val, str):
        # "01.01.2070" gibi formatları destekle
        for fmt in ("%d.%m.%Y", "%Y-%m-%d", "%Y-%m-%d %H:%M:%S"):
            try:
                return datetime.strptime(val, fmt)
            except ValueError:
                continue
    try:
        return pd.Timestamp(val).to_pydatetime()
    except Exception:
        return None


def to_int(val):
    """Float/NaN → int veya None."""
    if val is None:
        return None
    if isinstance(val, float):
        if math.isnan(val):
            return None
        return int(val)
    return int(val)


def upsert(session, model_class, records: list, id_field="id"):
    """
    Basit UPSERT: id varsa güncelle, yoksa ekle.
    """
    added = 0
    updated = 0
    for rec in records:
        rec_id = rec.get(id_field)
        existing = None
        if rec_id is not None:
            existing = session.get(model_class, rec_id)

        if existing is not None:
            # Güncelle
            for key, value in rec.items():
                if key != id_field:
                    setattr(existing, key, value)
            updated += 1
        else:
            obj = model_class(**rec)
            session.add(obj)
            added += 1

    return added, updated


# ─────────────────────────────────────────────────────────────────────────────
# Sekme okuyucular – her sekme için bir fonksiyon
# ─────────────────────────────────────────────────────────────────────────────

def seed_cost_centers(session, df):
    """CostCenter seed data."""
    records = []
    for _, row in df.iterrows():
        records.append({
            "id": to_uuid(row.get("id")),
            "order_number": to_int(row.get("orderNumber")),
            "code": clean_val(row.get("code")),
            "name": clean_val(row.get("name")),
            "is_default": to_bool(row.get("isDefault")),
        })
    return upsert(session, CostCenter, records)


def seed_branches(session, df):
    """Branch seed data."""
    records = []
    for _, row in df.iterrows():
        # costCenter kodu → CostCenter id (code lookup)
        cc_code = clean_val(row.get("costCenter"))
        cc_id = None
        if cc_code:
            cc = session.query(CostCenter).filter_by(code=cc_code).first()
            if cc:
                cc_id = cc.id

        records.append({
            "id": to_uuid(row.get("id")),
            "order_number": to_int(row.get("orderNumber")),
            "code": clean_val(row.get("code")),
            "cost_center_id": cc_id,
            "currency": clean_val(row.get("currency")),
            "is_default": to_bool(row.get("isDefault")),
            "account_language": clean_val(row.get("accountLanguage")),
            "short_name": clean_val(row.get("shortName")),
            "full_name": clean_val(row.get("fullName")),
            "description": clean_val(row.get("description")),
        })
    return upsert(session, Branch, records)


def seed_warehouses(session, df):
    """Warehouse seed data."""
    records = []
    for _, row in df.iterrows():
        # Branch kodu → Branch id
        branch_code = clean_val(row.get("branch"))
        branch_id = None
        if branch_code:
            branch = session.query(Branch).filter_by(code=branch_code).first()
            if branch:
                branch_id = branch.id

        # CostCenter kodu → CostCenter id
        cc_code = clean_val(row.get("costCenter"))
        cc_id = None
        if cc_code:
            cc = session.query(CostCenter).filter_by(code=cc_code).first()
            if cc:
                cc_id = cc.id

        records.append({
            "id": to_uuid(row.get("id")),
            "order_number": to_int(row.get("orderNumber")),
            "code": clean_val(row.get("code")),
            "language": clean_val(row.get("language")) or "tr",
            "short_name": clean_val(row.get("shortName")),
            "full_name": clean_val(row.get("fullName")),
            "description": clean_val(row.get("description")),
            "cost_center_id": cc_id,
            "branch_id": branch_id,
            "is_default": to_bool(row.get("isDefault")),
        })
    return upsert(session, Warehouse, records)


def seed_stock_places(session, df):
    """StockPlace seed data."""
    records = []
    for _, row in df.iterrows():
        # Warehouse kodu → Warehouse id
        wh_code = clean_val(row.get("warehouse"))
        wh_id = None
        if wh_code:
            wh = session.query(Warehouse).filter_by(code=wh_code).first()
            if wh:
                wh_id = wh.id

        records.append({
            "id": to_uuid(row.get("id")),
            "order_number": to_int(row.get("orderNumber")),
            "code": clean_val(row.get("code")),
            "language": clean_val(row.get("language")) or "tr",
            "short_name": clean_val(row.get("shortName")),
            "full_name": clean_val(row.get("fullName")),
            "description": clean_val(row.get("description")),
            "warehouse_id": wh_id,
            "is_default": to_bool(row.get("isDefault")),
            "enabled": to_bool(row.get("enabled")),
        })
    return upsert(session, StockPlace, records)


def seed_contact_types(session, df):
    """ContactType seed data."""
    records = []
    for _, row in df.iterrows():
        records.append({
            "id": to_uuid(row.get("id")),
            "order_number": to_int(row.get("orderNumber")),
            "code": clean_val(row.get("code")),
            "short_name": clean_val(row.get("shortName")),
            "full_name": clean_val(row.get("fullName")),
            "description": clean_val(row.get("description")),
            "is_default": to_bool(row.get("isDefault")),
            "account_type": clean_val(row.get("accountType")),
        })
    return upsert(session, ContactType, records)


def seed_customers(session, df):
    """Customer seed data."""
    records = []
    for _, row in df.iterrows():
        tax_num = clean_val(row.get("taxNumber"))
        if tax_num is not None:
            tax_num = str(tax_num)

        records.append({
            "id": to_uuid(row.get("id")),
            "code": clean_val(row.get("code")),
            "user_name": clean_val(row.get("userName")),
            "short_name": clean_val(row.get("shortName")),
            "full_name": clean_val(row.get("fullName")),
            "currency": clean_val(row.get("currency")),
            "language": clean_val(row.get("language")) or "tr",
            "tax_office": clean_val(row.get("taxOffice")),
            "tax_number": tax_num,
            "customer_language": clean_val(row.get("customerLanguage")) or "en",
            "use_mio": to_bool(row.get("useMio")),
            "enabled": to_bool(row.get("enabled")),
            "address": clean_val(row.get("adres")),
            "country": clean_val(row.get("ulke")),
            "payment_method": clean_val(row.get("odemeSekli")),
            "invoice_delivery_method": clean_val(row.get("faturaTeslimSekli")),
            "shipment_method": clean_val(row.get("sevkiyatSekliAdi")),
        })
    return upsert(session, Customer, records)


def seed_mission_groups(session, df):
    """MissionGroup seed data."""
    records = []
    for _, row in df.iterrows():
        on = clean_val(row.get("orderNumber"))
        records.append({
            "id": to_uuid(row.get("id")),
            "code": clean_val(row.get("code")),
            "order_number": float(on) if on is not None else None,
            "language": clean_val(row.get("language")) or "tr",
            "short_name": clean_val(row.get("shortName")),
            "full_name": clean_val(row.get("fullName")),
            "description": clean_val(row.get("description")),
            "cost_center": clean_val(row.get("costCenter")),
            "department": clean_val(row.get("department")),
        })
    return upsert(session, MissionGroup, records)


def seed_mission_workgroups(session, df):
    """MissionWorkgroup seed data."""
    records = []
    for _, row in df.iterrows():
        records.append({
            "id": to_uuid(row.get("id")),
            "order_number": to_int(row.get("orderNumber")),
            "code": clean_val(row.get("code")),
            "language": clean_val(row.get("language")) or "tr",
            "short_name": clean_val(row.get("shortName")),
            "full_name": clean_val(row.get("fullName")),
            "description": clean_val(row.get("description")),
            "cost_center": clean_val(row.get("costCenter")),
            "department": clean_val(row.get("department")),
            "default_labour_force": clean_val(row.get("defaultLabourForce")),
            "default_shift_required": to_bool(row.get("defaultShiftRequired")),
            "default_overtime_fee": to_bool(row.get("defaultOvertimeFee")),
        })
    return upsert(session, MissionWorkgroup, records)


def seed_missions(session, df):
    """Mission seed data."""
    records = []
    for _, row in df.iterrows():
        # MissionGroup code → id
        mg_code = clean_val(row.get("missionGroup"))
        mg_id = None
        if mg_code:
            mg = session.query(MissionGroup).filter_by(code=mg_code).first()
            if mg:
                mg_id = mg.id

        # MissionWorkgroup code → id
        mw_code = clean_val(row.get("missionWorkGroup"))
        mw_id = None
        if mw_code:
            mw = session.query(MissionWorkgroup).filter_by(code=mw_code).first()
            if mw:
                mw_id = mw.id

        on = clean_val(row.get("orderNumber"))

        records.append({
            "id": to_uuid(row.get("id")),
            "order_number": float(on) if on is not None else None,
            "code": clean_val(row.get("code")),
            "language": clean_val(row.get("language")) or "tr",
            "short_name": clean_val(row.get("shortName")),
            "full_name": clean_val(row.get("fullName")),
            "description": clean_val(row.get("description")),
            "cost_center": clean_val(row.get("costCenter")),
            "department": clean_val(row.get("department")),
            "mission_group_id": mg_id,
            "mission_workgroup_id": mw_id,
            "team_leader_mission_code": clean_val(
                row.get("teamLeaderManagerMission")
            ),
            "operation_manager_mission_code": clean_val(
                row.get("operaionManagerMission")
            ),
            "administrative_manager_mission_code": clean_val(
                row.get("administrativeManagerMission")
            ),
        })
    return upsert(session, Mission, records)


def seed_staff(session, df):
    """Staff seed data."""
    records = []
    for _, row in df.iterrows():
        records.append({
            "id": to_uuid(row.get("id")),
            "user_name": clean_val(row.get("userName")),
            "short_name": clean_val(row.get("shortName")),
            "account_enabled": to_bool(row.get("accountEnabled")),
            "use_mio": to_bool(row.get("useMio")),
            "account_type": clean_val(row.get("accountType")),
            "mission1": clean_val(row.get("mission1")),
            "mission2": clean_val(row.get("mission2")),
            "mission3": clean_val(row.get("mission3")),
            "mission4": clean_val(row.get("mission4")),
            "mission5": clean_val(row.get("mission5")),
            "team_leader": clean_val(row.get("teamLeader")),
            "operation_manager": clean_val(row.get("operationManager")),
            "administrative_manager": clean_val(
                row.get("administrativeManager")
            ),
            "valid_from_time": to_datetime(row.get("validFromTime")),
            "valid_to_time": to_datetime(row.get("validToTime")),
        })
    return upsert(session, Staff, records)


def seed_customer_target_prices(session, df):
    """CustomerTargetServicePrice seed data."""
    # customer sütunu sayısal (1, 2, ...) – bu müşteri sıra numarası
    # Müşteri sıra numarasını Customer tablosundaki code ile eşle
    customers_by_order = {}
    all_customers = session.query(Customer).order_by(Customer.code).all()
    # code sırasına göre 1-indexed map oluştur
    # Excel'de customer=1 → ilk müşteri (code='001'), customer=2 → ikinci (code='002')
    customer_codes_sorted = sorted(all_customers, key=lambda c: c.code)
    for idx, cust in enumerate(customer_codes_sorted, 1):
        customers_by_order[idx] = cust

    records = []
    for _, row in df.iterrows():
        cust_order = to_int(row.get("customer"))
        cust = customers_by_order.get(cust_order)
        if cust is None:
            print(f"  [WARN] Customer order {cust_order} not found, skipping")
            continue

        records.append({
            "customer_id": cust.id,
            "product_family": clean_val(row.get("productFamily")),
            "code": clean_val(row.get("code")),
            "target_price": clean_val(row.get("targetPrice")),
            "light_repair_target_price": clean_val(
                row.get("lightRepairTargetPrice")
            ),
            "family_validation_id": to_uuid(row.get("FamilyValidation")),
            "enabled": to_bool(row.get("enabled")),
        })

    # CustomerTargetServicePrice uses Integer PK (autoincrement), upsert by code
    added = 0
    updated = 0
    for rec in records:
        existing = session.query(CustomerTargetServicePrice).filter_by(
            code=rec["code"]
        ).first()
        if existing:
            for key, value in rec.items():
                setattr(existing, key, value)
            updated += 1
        else:
            obj = CustomerTargetServicePrice(**rec)
            session.add(obj)
            added += 1

    return added, updated


# ─────────────────────────────────────────────────────────────────────────────
# Ana çalıştırma
# ─────────────────────────────────────────────────────────────────────────────

def main():
    print("=" * 70)
    print("RemaLab WMS – Organization Seed Data")
    print(f"Excel: {EXCEL_FILE}")
    print("=" * 70)

    engine = get_engine()

    # organization şemasını oluştur
    with engine.connect() as conn:
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS organization"))
        conn.commit()
    print("[OK] organization şeması hazır.")

    # Tabloları oluştur
    Base.metadata.create_all(bind=engine)
    print("[OK] Tablolar oluşturuldu.")

    # Session aç
    SessionLocal = get_session_factory()
    session = SessionLocal()

    try:
        # Excel dosyasını oku
        xls = pd.ExcelFile(EXCEL_FILE)
        print(f"[OK] Excel okundu. Sekmeler: {len(xls.sheet_names)}")

        # FK bağımlılık sırasına göre seed et
        SEED_ORDER = [
            ("CostCenter",                 seed_cost_centers),
            ("Branch",                     seed_branches),
            ("Warehouse",                  seed_warehouses),
            ("StockPlace",                 seed_stock_places),
            ("ContactType",                seed_contact_types),
            ("Customer",                   seed_customers),
            ("MissionGroup",               seed_mission_groups),
            ("MissionWorkgroup",           seed_mission_workgroups),
            ("Mission",                    seed_missions),
            ("Staff",                      seed_staff),
            ("CustomerTargetServicePrice", seed_customer_target_prices),
        ]

        for sheet_name, seed_func in SEED_ORDER:
            if sheet_name not in xls.sheet_names:
                print(f"[SKIP] {sheet_name} sekmesi Excel'de bulunamadı.")
                continue

            df = read_sheet(EXCEL_FILE, sheet_name)
            added, updated = seed_func(session, df)
            session.flush()  # FK'lar için id'ler gerekli
            print(
                f"[OK] {sheet_name:40s} -> "
                f"{len(df):4d} satir okundu, "
                f"{added:3d} eklendi, {updated:3d} guncellendi"
            )

        session.commit()
        print("\n" + "=" * 70)
        print("TÜM SEED DATA BAŞARIYLA AKTARILDI!")
        print("=" * 70)

    except Exception as e:
        session.rollback()
        print(f"\n[ERROR] Seed işlemi başarısız: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    main()
