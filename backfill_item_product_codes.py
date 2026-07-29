"""
warehouse.item ve warehouse.parts tablolarındaki `code`/`item_code` sütunundan
(cihaz/ürün kodu + parça kategorisi + opsiyonel renk birleşimi) sadece cihaz/ürün
kodu kısmını ayıklayıp yeni bir `product_code` (+ tanı için `product_code_method`)
kolonuna yazar.

Yöntem (core.item_product_code_extractor):
1. warehouse.parts'taki (brand, model, item_code) satırlarından, aynı cihaza ait
   kodların çoğunluk oyu ile ortak önekini bularak gerçek cihaz kodlarını keşfeder
   (örn. Samsung Galaxy S20 Ultra -> "SMS20U").
2. Güvenilir gruplardan, item_category bazında sabit son ek sözlüğü öğrenir
   (örn. "Back Glass" -> {"BG","BGBLC","BGBlu",...}).
3. Her satır için: önce kendi (brand,model) grubunun kodunu, yoksa kategori son
   ekini kırparak, o da yoksa genel kod sözlüğünde en uzun eşleşen öneki dener.
   Hiçbiri olmazsa satır aynen bırakılır ve "unresolved" olarak işaretlenir/raporlanır.

Kullanım:
    python backfill_item_product_codes.py            # dry-run, sadece özet+rapor yazdırır
    python backfill_item_product_codes.py --apply     # veritabanına yazar
"""
import argparse
import sys
from collections import Counter

sys.path.insert(0, r"C:\Users\JOSEPH\Documents\remalab-web-tabanli")

from config.database import init_database_schema, SessionLocal
from sqlalchemy import text
from core.item_product_code_extractor import (
    discover_device_codes, build_category_suffix_map, build_vocabulary, resolve_product_code
)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Değişiklikleri veritabanına yaz; varsayılan dry-run.")
    args = parser.parse_args()

    init_database_schema()
    db = SessionLocal()
    try:
        parts_rows = db.execute(text(
            "SELECT brand, model, item_code, item_category FROM warehouse.parts WHERE item_code IS NOT NULL"
        )).fetchall()

        device_codes = discover_device_codes(
            [(r.brand, r.model, r.item_code) for r in parts_rows], threshold=0.7, min_len=3, min_n=4
        )
        print(f"{len(device_codes)} cihaz grubu icin guvenilir kod kesfedildi (parts icindeki toplam grup sayisindan)")

        category_suffix_map = build_category_suffix_map(
            [(r.brand, r.model, r.item_code, r.item_category) for r in parts_rows], device_codes
        )
        vocabulary = build_vocabulary(device_codes)
        print(f"kategori son-ek sozlugu: {len(category_suffix_map)} kategori, kelime dagarcigi: {len(vocabulary)} kod")

        item_rows = db.execute(text(
            "SELECT i.id, i.code, i.item_category, p.brand, p.model "
            "FROM warehouse.item i LEFT JOIN warehouse.parts p ON p.item_code = i.code "
            "WHERE i.code IS NOT NULL"
        )).fetchall()

        item_updates = []
        method_counts = Counter()
        unresolved_samples = []
        for r in item_rows:
            group_entry = device_codes.get((_norm(r.brand), r.model)) if r.brand and r.model else None
            pc, method = resolve_product_code(r.code, r.item_category, group_entry, category_suffix_map, vocabulary)
            item_updates.append((r.id, pc, method))
            method_counts[method] += 1
            if method == "unresolved" and len(unresolved_samples) < 30:
                unresolved_samples.append(r.code)

        print(f"\nwarehouse.item: {len(item_updates)} satir islendi")
        for m, c in method_counts.most_common():
            print(f"  {m}: {c}")
        if unresolved_samples:
            print("  unresolved ornekleri:", unresolved_samples[:15])

        parts_updates = []
        pmethod_counts = Counter()
        for r in parts_rows:
            group_entry = device_codes.get((_norm(r.brand), r.model)) if r.brand and r.model else None
            pc, method = resolve_product_code(r.item_code, r.item_category, group_entry, category_suffix_map, vocabulary)
            parts_updates.append((r.item_code, pc, method))
            pmethod_counts[method] += 1

        print(f"\nwarehouse.parts: {len(parts_updates)} satir islendi")
        for m, c in pmethod_counts.most_common():
            print(f"  {m}: {c}")

        if not args.apply:
            print("\nDRY RUN -- degisiklik yazilmadi. Uygulamak icin --apply ekleyin.")
            return

        db.execute(text("ALTER TABLE warehouse.item ADD COLUMN IF NOT EXISTS product_code VARCHAR(100);"))
        db.execute(text("ALTER TABLE warehouse.item ADD COLUMN IF NOT EXISTS product_code_method VARCHAR(30);"))
        db.execute(text("ALTER TABLE warehouse.parts ADD COLUMN IF NOT EXISTS product_code VARCHAR(100);"))
        db.execute(text("ALTER TABLE warehouse.parts ADD COLUMN IF NOT EXISTS product_code_method VARCHAR(30);"))
        db.commit()

        CHUNK = 1000
        for offset in range(0, len(item_updates), CHUNK):
            for iid, pc, method in item_updates[offset:offset + CHUNK]:
                db.execute(
                    text("UPDATE warehouse.item SET product_code = :pc, product_code_method = :m WHERE id = :i"),
                    {"pc": pc, "m": method, "i": iid},
                )
            db.commit()
            print(f"  warehouse.item: {min(offset + CHUNK, len(item_updates))}/{len(item_updates)}")
        print(f"warehouse.item: {len(item_updates)} satir guncellendi.")

        for offset in range(0, len(parts_updates), CHUNK):
            for icode, pc, method in parts_updates[offset:offset + CHUNK]:
                db.execute(
                    text("UPDATE warehouse.parts SET product_code = :pc, product_code_method = :m WHERE item_code = :ic"),
                    {"pc": pc, "m": method, "ic": icode},
                )
            db.commit()
            print(f"  warehouse.parts: {min(offset + CHUNK, len(parts_updates))}/{len(parts_updates)}")
        print(f"warehouse.parts: {len(parts_updates)} satir guncellendi.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def _norm(brand):
    from core.product_code_generator import normalize_brand
    return normalize_brand(brand)


if __name__ == "__main__":
    main()
