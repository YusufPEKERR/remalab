"""
RemaLab WMS - Truncate and Seed Script
Sistemi canlıya geçiş/test için temizler ve yeni transfer kurallarına uygun dummy veriler ekler.
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

DB_HOST = os.getenv("PG_HOST") or os.getenv("DB_HOST")
DB_PORT = os.getenv("PG_PORT") or os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("PG_DATABASE") or os.getenv("DB_NAME", "remalab")
DB_USER = os.getenv("PG_USER") or os.getenv("DB_USER")
DB_PASSWORD = os.getenv("PG_PASSWORD") or os.getenv("DB_PASSWORD")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

def truncate_and_seed():
    engine = create_engine(DATABASE_URL)
    with engine.begin() as conn:
        print("[1/3] Tablolar temizleniyor (Truncate)...")
        conn.execute(text("""
            TRUNCATE TABLE 
                warehouse.stock_movements,
                warehouse.work_order_parts,
                warehouse.material_requests,
                warehouse.work_orders,
                warehouse.production_materials,
                warehouse.produced_units,
                warehouse.production_runs
            RESTART IDENTITY CASCADE;
        """))
        print("[1/3] Tablolar başarıyla temizlendi.")

        print("[2/3] Depo lokasyon ID'leri alınıyor...")
        locs = conn.execute(text("SELECT id, kind, name FROM warehouse.locations")).mappings().all()
        loc_map = {row["kind"]: row["id"] for row in locs if row["kind"]}

        good_id = loc_map.get("good_stock")
        repair_id = loc_map.get("repair_stock")
        doa_id = loc_map.get("doa_stock")
        out_id = loc_map.get("out_stock")
        scrap_id = loc_map.get("scrap_stock")

        print(f"    Lokasyonlar: Good={good_id}, Repair={repair_id}, DOA={doa_id}, Out={out_id}, Scrap={scrap_id}")

        print("[3/3] Kurallara uygun dummy hareketler ekleniyor...")
        parts = conn.execute(text("SELECT id FROM warehouse.parts LIMIT 5")).scalars().all()
        if parts and good_id and repair_id:
            p1 = parts[0]
            p2 = parts[1] if len(parts) > 1 else parts[0]

            # 1. Good Stock -> Repair Stock (Transfer)
            conn.execute(text("""
                INSERT INTO warehouse.stock_movements (type, movement_kind, quantity, part_id, source_location_id, target_location_id, created_by, description)
                VALUES ('İç Transfer', 'Transfer', 10, :pid, :src, :tgt, 'admin', 'Good Stock tan Repair Depoya malzeme transferi');
            """), {"pid": p1, "src": good_id, "tgt": repair_id})

            # 2. Repair Stock -> Out Stock (Müşteri Teslimi)
            if out_id:
                conn.execute(text("""
                    INSERT INTO warehouse.stock_movements (type, movement_kind, quantity, part_id, source_location_id, target_location_id, created_by, description)
                    VALUES ('Çıkış', 'Outbound', 2, :pid, :src, :tgt, 'admin', 'Cihaz tamiri tamamlandı, müşteriye teslim edildi');
                """), {"pid": p1, "src": repair_id, "tgt": out_id})

            # 3. Repair Stock -> DOA Stock (Arızalı Parça İadesi)
            if doa_id:
                conn.execute(text("""
                    INSERT INTO warehouse.stock_movements (type, movement_kind, quantity, part_id, source_location_id, target_location_id, created_by, description)
                    VALUES ('DOA İade', 'Transfer', 1, :pid, :src, :tgt, 'admin', 'Teknisyenden arızalı dönen parça DOA depoya aktarıldı');
                """), {"pid": p1, "src": repair_id, "tgt": doa_id})

            # 4. DOA Stock -> Good Stock (Tamir Edilen Parça Kazanımı)
            if doa_id and good_id:
                conn.execute(text("""
                    INSERT INTO warehouse.stock_movements (type, movement_kind, quantity, part_id, source_location_id, target_location_id, created_by, description)
                    VALUES ('Giriş', 'Inbound', 1, :pid, :src, :tgt, 'admin', 'DOA depodaki arızalı parça tamir edilip Good Stock a kazandırıldı');
                """), {"pid": p2, "src": doa_id, "tgt": good_id})

            # 5. DOA Stock -> Scrap Stock (Hurdaya Ayırma)
            if doa_id and scrap_id:
                conn.execute(text("""
                    INSERT INTO warehouse.stock_movements (type, movement_kind, quantity, part_id, source_location_id, target_location_id, created_by, description)
                    VALUES ('Hurda', 'Transfer', 1, :pid, :src, :tgt, 'admin', 'Tamiri mümkün olmayan parça hurdaya ayrıldı');
                """), {"pid": p2, "src": doa_id, "tgt": scrap_id})

            print("[3/3] Dummy hareketler başarıyla eklendi.")

    print("\n[OK] Temizleme ve test verisi yukleme islemi basariyla tamamlandi!")

if __name__ == "__main__":
    truncate_and_seed()
