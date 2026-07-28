"""
warehouse.product_family tablosundaki, henüz gerçek bir kısaltması olmayan
(code == short_name) satırlara core.product_code_generator.generate_family_code
ile üretilen kısa ürün kodlarını yazar.

Apple/iPhone ailelerindeki 46 küratörlü kod (iP12PM, iP12PR, ...) dokunulmadan
kalır çünkü onlarda code != short_name.

Idempotent: bir kez --apply ile çalıştırıldıktan sonra tekrar çalıştırıldığında
işlenecek satır kalmaz (code artık short_name'e eşit değildir).

Kullanım:
    python backfill_product_family_codes.py            # dry-run, sadece yazdırır
    python backfill_product_family_codes.py --apply     # veritabanına yazar
"""
import argparse
import sys

sys.path.insert(0, r"C:\Users\JOSEPH\Documents\remalab-web-tabanli")

from config.database import init_database_schema, SessionLocal
from sqlalchemy import text
from core.product_code_generator import generate_family_code


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Değişiklikleri veritabanına yaz; varsayılan dry-run.")
    args = parser.parse_args()

    init_database_schema()
    db = SessionLocal()
    try:
        all_rows = db.execute(text(
            "SELECT id, code, short_name, brand FROM warehouse.product_family"
        )).fetchall()
        existing_codes_lower = {r.code.lower() for r in all_rows if r.code}

        targets = sorted(
            (r for r in all_rows if r.code == r.short_name),
            key=lambda r: ((r.brand or ""), (r.short_name or ""), str(r.id)),
        )
        print(f"{len(all_rows)} toplam ürün ailesi, {len(targets)} tanesine kod üretilecek")

        updates = []
        for r in targets:
            new_code = generate_family_code(r.brand, r.short_name, existing_codes_lower)
            updates.append((r.id, new_code))
            print(f"  {(r.brand or '?'):14} | {r.short_name!r:50} -> {new_code}")

        if not args.apply:
            print("\nDRY RUN -- değişiklik yazılmadı. Uygulamak için --apply ekleyin.")
            return

        for fid, new_code in updates:
            db.execute(
                text("UPDATE warehouse.product_family SET code = :c WHERE id = :i"),
                {"c": new_code, "i": fid},
            )
        db.commit()

        dup = db.execute(text(
            "SELECT LOWER(code) FROM warehouse.product_family GROUP BY LOWER(code) HAVING COUNT(*) > 1"
        )).fetchall()
        assert not dup, f"Backfill sonrası tekrar eden kod bulundu: {dup}"
        print(f"\n{len(updates)} satır güncellendi. Tekrar eden kod yok.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
