"""
RemaLab WMS - Modül 5 Seed Data Betiği
Akış (akış.jpeg) görselindeki statüleri ve geçiş kurallarını ServiceStatuMap tablosuna yazar.
Eski kayıtları siler (truncate) ve tam olarak görsele sadık bir matris kurar.
"""
import os
import sys
import uuid
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.database import get_engine, get_session_factory, Base
from models.service_statu import ServiceStatu
from models.service_statu_map import ServiceStatuMap

NODES = {
    100: "Kayıt Kabul Yap",
    101: "İlk Teste Aktar",
    102: "İlk Teste Kabul",
    103: "Üretime Teslim Edilecek",
    104: "Teknik Departmana Kabul",
    105: "Teknik Departmanda İşlem",
    106: "Müşteri Onayına Gönder",
    107: "Müşteri Onayı Bekliyor",
    109: "Üretime Aktar",
    124: "Çıkış Testine Gönder",
    125: "Son Teste Kabul",
    126: "Depoya Sevket",
    127: "Müşteri İçin Sevket",
    128: "Çıkış Yap",
    130: "Montaj Bekleyecek",
    131: "L1 Montaja Aktar",
    132: "L2 Montaja Aktar",
    133: "Montaj Tamam",
    134: "RMA Kontrole Aktar",
    135: "İade Edilmeyecek",
    136: "Müşteri Onayı Geldi",
    137: "Ara Teste Teslim",
    138: "Ara Test Teslim Al"
}

EDGES = [
    # Ileri Akislar (Yesil & Mavi)
    (100, 101, True),
    (101, 102, True),
    (102, 103, True),
    (102, 104, True),
    (103, 104, True),
    (104, 105, True),
    (105, 109, True),
    (109, 130, True),
    (109, 124, True),
    (109, 105, True),
    (130, 131, True),
    (130, 132, True),
    (131, 133, True),
    (132, 133, True),
    (133, 124, True),
    (124, 125, True),
    (125, 126, True),
    (126, 127, True),
    (127, 128, True),
    
    # Ara Test
    (109, 137, True),
    (137, 138, True),
    (138, 124, True),
    
    # Musteri Onay (Sari/Turuncu)
    (105, 106, True),
    (106, 107, True),
    (107, 105, True), # Onay -> 105
    (107, 136, False), # Red -> 136
    (136, 124, True), # 136'dan 124'e kosullu akis (dashed line)
    
    # RMA (Mor)
    (105, 134, True),
    (134, 109, True), # RMA Kabul
    (134, 105, False), # RMA Red
    
    # Negatif / Geri Donus (Kirmizi)
    (125, 109, False) # Son Testte basarisizlik
]

def main():
    print("Modül 5 Seed Başlıyor...", flush=True)
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    session = get_session_factory()()
    
    try:
        # Clear existing maps
        session.execute(text("DELETE FROM warehouse.service_statu_map"))
        
        # Ensure all nodes exist
        for code, name in NODES.items():
            statu = session.query(ServiceStatu).filter_by(code=code).first()
            if not statu:
                statu = ServiceStatu(
                    id=uuid.uuid4(),
                    code=code,
                    short_name=name,
                    enabled=True
                )
                session.add(statu)
            else:
                statu.short_name = name
                
        # Insert new edges
        for parent, child, is_positive in EDGES:
            code_str = f"{parent}_{child}"
            smap = ServiceStatuMap(
                id=uuid.uuid4(),
                code=code_str,
                parent_statu=parent,
                child_statu=child,
                is_positive=is_positive,
                enabled=True,
                is_user_change_statu=True
            )
            session.add(smap)
            
        session.commit()
        print(f"TUM SEED ISLEMI BASARILI! {len(EDGES)} kuralli matris olusturuldu.", flush=True)
    except Exception as e:
        session.rollback()
        import traceback
        traceback.print_exc()
        print("HATA:", str(e), flush=True)
    finally:
        session.close()

if __name__ == "__main__":
    main()
