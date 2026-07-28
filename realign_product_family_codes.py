"""
warehouse.product_family.code, önceki turda (core.product_code_generator ile)
markaya göre üretilmiş kodlardı. Ancak warehouse.parts/item tablolarında zaten
GERÇEK, 30 binden fazla parçada tutarlı şekilde kullanılan cihaz kodları
bulunduğu keşfedildi (core.item_product_code_extractor.discover_device_codes).

Bu script, product_family.code'u -- mevcut gerçek parça verisiyle eşleşen
aileler için -- o gerçek kodla değiştirir (üretilmiş kod yerine). Eşleşme
bulunamayan aileler (o modele ait hiç parça/envanter kaydı olmayanlar)
önceki turda üretilmiş kod ile olduğu gibi kalır.

Kullanım:
    python realign_product_family_codes.py            # dry-run
    python realign_product_family_codes.py --apply     # veritabanına yazar
"""
import argparse
import sys
from collections import Counter

sys.path.insert(0, r"C:\Users\JOSEPH\Documents\remalab-web-tabanli")

from config.database import init_database_schema, SessionLocal
from sqlalchemy import text
from core.item_product_code_extractor import discover_device_codes
from core.product_code_generator import normalize_brand


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    init_database_schema()
    db = SessionLocal()
    try:
        parts_rows = db.execute(text(
            "SELECT brand, model, item_code FROM warehouse.parts WHERE item_code IS NOT NULL"
        )).fetchall()
        device_codes = discover_device_codes(
            [(r.brand, r.model, r.item_code) for r in parts_rows], threshold=0.7, min_len=3, min_n=4
        )
        print(f"{len(device_codes)} gercek cihaz kodu keşfedildi (parts verisinden)")

        families = db.execute(text(
            "SELECT id, brand, short_name, code FROM warehouse.product_family"
        )).fetchall()

        # Aynı gerçek kod birden fazla aile satırına düşebilir (örn. 'iPad Mini 3' ve
        # 'iPad Mini 3 7,9 Inch' aynı fiziksel cihaz, iki ayrı satır - product_family'nin
        # kendi veri kalitesi sorunu). code UNIQUE olduğundan sadece ilk eşleşen satır
        # gerçek kodu alır, geri kalanı çakışma nedeniyle atlanıp raporlanır (uydurma bir
        # "-2" son eki eklemek gerçek bir Apple parça numarasını yanlış temsil eder).
        reserved = {f.code.lower() for f in families}
        updates = []
        skipped_collisions = []
        unmatched = 0
        for f in families:
            key = (normalize_brand(f.brand), f.short_name)
            entry = device_codes.get(key)
            if not entry:
                unmatched += 1
                continue
            new_code = entry["code"]
            if new_code == f.code:
                continue
            if new_code.lower() in reserved and new_code.lower() != f.code.lower():
                skipped_collisions.append((f.brand, f.short_name, f.code, new_code))
                continue
            reserved.discard(f.code.lower())
            reserved.add(new_code.lower())
            updates.append((f.id, f.brand, f.short_name, f.code, new_code, entry["confidence"], entry["n"]))

        print(f"\n{len(updates)} aile gercek koda gore GUNCELLENECEK, {unmatched} aile icin gercek parca verisi yok (mevcut uretilmis kod korunur)")
        for fid, brand, sn, old, new, conf, n in updates[:60]:
            print(f"  {brand or '?':10} | {sn!r:40} {old!r:14} -> {new!r:14} (conf={conf:.2f}, n={n})")
        if len(updates) > 60:
            print(f"  ... +{len(updates)-60} more")
        if skipped_collisions:
            print(f"\n{len(skipped_collisions)} aile CAKISMA nedeniyle atlandi (eski kod korundu):")
            for brand, sn, old, new in skipped_collisions:
                print(f"  {brand or '?':10} | {sn!r:40} kod {old!r} kalir (gercek kod {new!r} baska bir aile tarafindan zaten kullaniliyor)")

        if not args.apply:
            print("\nDRY RUN -- degisiklik yazilmadi. Uygulamak icin --apply ekleyin.")
            return

        for fid, brand, sn, old, new_code, conf, n in updates:
            db.execute(
                text("UPDATE warehouse.product_family SET code = :c WHERE id = :i"),
                {"c": new_code, "i": fid},
            )
        db.commit()

        dup = db.execute(text(
            "SELECT LOWER(code) FROM warehouse.product_family GROUP BY LOWER(code) HAVING COUNT(*) > 1"
        )).fetchall()
        print(f"\n{len(updates)} aile guncellendi.")
        if dup:
            print(f"UYARI: guncelleme sonrasi {len(dup)} tekrar eden kod var: {dup[:10]}")
        else:
            print("Tekrar eden kod yok.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
