"""
RemaLab WMS - Modül 5 Seed Data Betiği v2
Statümap.xlsx dosyasındaki tam kaynak→hedef statü geçiş matrisini
(short_name, kontrol_1/2/3, to_dest, description, is_positive, enabled dahil)
ServiceStatuMap tablosuna birebir yazar. Eski kayıtları siler (truncate) ve
excel'e sadık bir matris kurar.
"""
import os
import sys
import uuid
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.database import get_engine, get_session_factory, Base
from models.service_statu_map import ServiceStatuMap

ROWS = [
    {"order": 1, "code": "100_101", "parent": 100, "child": 101, "positive": True, "user_change": True,
     "k1": "Ön bildirim yapıldı", "k2": "Depo kabul yapıldı", "k3": None, "to": "SPA_P",
     "short_name": "Kayıt kabul yap", "desc": "Ön bildirim yapıldı > Depo kabul yapıldı.(100>101)", "enabled": True},
    {"order": 2, "code": "101_102", "parent": 101, "child": 102, "positive": True, "user_change": True,
     "k1": "Depo kabul yapıldı", "k2": "İlk teste aktarıldı", "k3": None, "to": "SPA_P",
     "short_name": "İlk teste aktar", "desc": "Depo kabul yapıldı > İlk teste aktarıldı.(101>102)", "enabled": True},
    {"order": 18, "code": "126_127", "parent": 126, "child": 127, "positive": True, "user_change": True,
     "k1": "Depoya sevk edilecek", "k2": "Müşteri için sevk bekliyor", "k3": None, "to": "SPA_P",
     "short_name": "Müşteri için sevket", "desc": "Depoya sevk edilecek > Müşteri için sevk bekliyor.(126>127)", "enabled": True},
    {"order": 3, "code": "102_103", "parent": 102, "child": 103, "positive": True, "user_change": True,
     "k1": "İlk teste aktarıldı", "k2": "İlk test bekleniyor", "k3": None, "to": "QAC",
     "short_name": "İlk teste kabul", "desc": "İlk teste aktarıldı > İlk test bekleniyor.(102>103)", "enabled": True},
    {"order": 4, "code": "102_104", "parent": 102, "child": 104, "positive": True, "user_change": False,
     "k1": "İlk teste aktarıldı", "k2": "İlk test tamamlandı", "k3": None, "to": "QAC",
     "short_name": "Son test için kabul", "desc": "İlk teste aktarıldı > İlk test tamamlandı.(102>104)", "enabled": False},
    {"order": 5, "code": "103_104", "parent": 103, "child": 104, "positive": True, "user_change": True,
     "k1": "İlk test bekleniyor", "k2": "İlk test tamamlandı", "k3": None, "to": "QAC",
     "short_name": "Üretime teslim edilecek", "desc": "İlk test bekleniyor > İlk test tamamlandı.(103>104)", "enabled": True},
    {"order": 16, "code": "124_125", "parent": 124, "child": 125, "positive": True, "user_change": True,
     "k1": "Son Teste teslim edilecek", "k2": "Son teste kabul yapıldı", "k3": None, "to": "QAC",
     "short_name": "Son teste kabul", "desc": "Son Teste teslim edilecek > Son teste kabul yapıldı.(124>125)", "enabled": True},
    {"order": 17, "code": "125_126", "parent": 125, "child": 126, "positive": True, "user_change": True,
     "k1": "Son teste kabul yapıldı", "k2": "Depoya sevk edilecek", "k3": None, "to": "QAC",
     "short_name": "Depoya sevket", "desc": "Son teste kabul yapıldı > Depoya sevk edilecek.(125>126)", "enabled": True},
    {"order": 6, "code": "104_105", "parent": 104, "child": 105, "positive": True, "user_change": True,
     "k1": "İlk test tamamlandı", "k2": "Üretim planına kabul bekleniyor", "k3": None, "to": "TEC_DISMANTLE",
     "short_name": "Teknik departmana kabul et", "desc": "İlk test tamamlandı > Üretim planına kabul bekleniyor.(104>105)", "enabled": True},
    {"order": 9, "code": "125_109", "parent": 125, "child": 109, "positive": False, "user_change": True,
     "k1": "Son teste kabul yapıldı", "k2": "Üretim aşamasında", "k3": None, "to": "QAC",
     "short_name": "Son test dönüş", "desc": "Son teste kabul yapıldı > Üretim aşamasında.(125>109)", "enabled": False},
    {"order": 8, "code": "105_106", "parent": 105, "child": 106, "positive": True, "user_change": True,
     "k1": "Üretim planına kabul bekleniyor", "k2": "Müşteri onayına sunulacak", "k3": None, "to": "TEC_DISMANTLE",
     "short_name": "Müşteri onayına gönder", "desc": "Üretim planına kabul bekleniyor > Müşteri onayına sunulacak.(105>106)", "enabled": True},
    {"order": 7, "code": "105_109", "parent": 105, "child": 109, "positive": True, "user_change": True,
     "k1": "Üretim planına kabul bekleniyor", "k2": "Üretim aşamasında", "k3": None, "to": "TEC_DISMANTLE",
     "short_name": "Üretime aktar", "desc": "Üretim planına kabul bekleniyor > Üretim aşamasında.(105>109)", "enabled": False},
    {"order": 10, "code": "105_134", "parent": 105, "child": 134, "positive": True, "user_change": False,
     "k1": "Üretim planına kabul bekleniyor", "k2": "RMA kontrol", "k3": None, "to": "TEC_DISMANTLE",
     "short_name": "Rma kontrole aktar", "desc": "Üretim planına kabul bekleniyor > RMA kontrol.(105>134)", "enabled": False},
    {"order": 11, "code": "106_107", "parent": 106, "child": 107, "positive": True, "user_change": True,
     "k1": "Müşteri onayına sunulacak", "k2": "Müşteri onayı bekleniyor", "k3": None, "to": "MNG1_AS",
     "short_name": "Müşteri onayı bekleyecek", "desc": "Müşteri onayına sunulacak > Müşteri onayı bekleniyor.(106>107)", "enabled": True},
    {"order": 12, "code": "107_105", "parent": 107, "child": 105, "positive": True, "user_change": False,
     "k1": "Müşteri onayı bekleniyor", "k2": "Üretim planına kabul bekleniyor", "k3": None, "to": "MNG1_AS",
     "short_name": "Müşteri Onay/Red geldi", "desc": "Müşteri onayı bekleniyor > Üretim planına kabul bekleniyor.(107>105)", "enabled": False},
    {"order": 13, "code": "109_105", "parent": 109, "child": 105, "positive": False, "user_change": True,
     "k1": "Üretim aşamasında", "k2": "Üretim planına kabul bekleniyor", "k3": None, "to": "TEC_DISMANTLE",
     "short_name": "Farklı departmana sevk et", "desc": "Üretim aşamasında > Üretim planına kabul bekleniyor.(109>105)", "enabled": False},
    {"order": 14, "code": "109_124", "parent": 109, "child": 124, "positive": True, "user_change": True,
     "k1": "Üretim aşamasında", "k2": "Son Teste teslim edilecek", "k3": None, "to": "TEC_DISMANTLE",
     "short_name": "Son teste gönder", "desc": "Üretim aşamasında > Son Teste teslim edilecek.(109>124)", "enabled": False},
    {"order": 15, "code": "109_130", "parent": 109, "child": 130, "positive": True, "user_change": True,
     "k1": "Üretim aşamasında", "k2": "Montaj Bekleniyor", "k3": "alt onarımlar bittiğinde bu konuma alınmalı", "to": "TEC_DISMANTLE",
     "short_name": "Montaj bekleyecek", "desc": "Üretim aşamasında > Montaj Bekleniyor.(109>130)", "enabled": False},
    {"order": 19, "code": "127_128", "parent": 127, "child": 128, "positive": True, "user_change": False,
     "k1": "Müşteri için sevk bekliyor", "k2": "Çıkışı yapıldı", "k3": None, "to": "SPA_P",
     "short_name": "Çıkışını yap", "desc": "Müşteri için sevk bekliyor > Çıkışı yapıldı.(127>128)", "enabled": False},
    {"order": 20, "code": "130_131", "parent": 130, "child": 131, "positive": True, "user_change": True,
     "k1": "Montaj Bekleniyor", "k2": "L1 Montaj Yapılacak", "k3": None, "to": "MNG1_AS",
     "short_name": "L1 montaja aktar", "desc": "Montaj Bekleniyor > L1 Montaj Yapılacak.(130>131)", "enabled": False},
    {"order": 21, "code": "130_132", "parent": 130, "child": 132, "positive": True, "user_change": True,
     "k1": "Montaj Bekleniyor", "k2": "L2 Montaj Yapılacak", "k3": None, "to": "MNG1_AS",
     "short_name": "L2 montaja aktar", "desc": "Montaj Bekleniyor > L2 Montaj Yapılacak.(130>132)", "enabled": False},
    {"order": 22, "code": "131_133", "parent": 131, "child": 133, "positive": True, "user_change": False,
     "k1": "L1 Montaj Yapılacak", "k2": "Montaj tamamlandı", "k3": None, "to": "MNG1_AS",
     "short_name": "L1 montajı tamamla", "desc": "L1 Montaj Yapılacak > Montaj tamamlandı.(131>133)", "enabled": False},
    {"order": 23, "code": "132_133", "parent": 132, "child": 133, "positive": True, "user_change": False,
     "k1": "L2 Montaj Yapılacak", "k2": "Montaj tamamlandı", "k3": None, "to": "MNG1_AS",
     "short_name": "L2 montajı tamamla", "desc": "L2 Montaj Yapılacak > Montaj tamamlandı.(132>133)", "enabled": False},
    {"order": 24, "code": "133_124", "parent": 133, "child": 124, "positive": True, "user_change": True,
     "k1": "Montaj tamamlandı", "k2": "Son Teste teslim edilecek", "k3": None, "to": "MNG1_AS",
     "short_name": "Çıkış testine gönder", "desc": "Montaj tamamlandı > Son Teste teslim edilecek.(133>124)", "enabled": False},
    {"order": 25, "code": "135_125", "parent": 135, "child": 125, "positive": True, "user_change": True,
     "k1": "İade için son teste gönderildi", "k2": "Son teste kabul yapıldı", "k3": None, "to": "TEC_DISMANTLE",
     "short_name": "Son teste gönder", "desc": "İade için son teste gönderildi > Son teste kabul yapıldı.(135>125)", "enabled": False},
    {"order": 100, "code": "134_105", "parent": 134, "child": 105, "positive": False, "user_change": True,
     "k1": "RMA kontrol", "k2": "Üretim planına kabul bekleniyor", "k3": None, "to": "TEC_RMA",
     "short_name": "RMA reddedildi", "desc": "RMA kontrol > Üretim planına kabul bekleniyor.(134>105)", "enabled": False},
    {"order": 99, "code": "134_109", "parent": 134, "child": 109, "positive": True, "user_change": True,
     "k1": "RMA kontrol", "k2": "Üretim aşamasında", "k3": None, "to": "TEC_RMA",
     "short_name": "RMA kabul edildi", "desc": "RMA kontrol > Üretim aşamasında.(134>109)", "enabled": False},
    {"order": 101, "code": "136_109", "parent": 136, "child": 109, "positive": True, "user_change": False,
     "k1": "Müşteri Onay/Red Geldi", "k2": "Üretim aşamasında", "k3": None, "to": "MNG1_AS",
     "short_name": "Müşteri Onay/Red Geldi EX", "desc": "Müşteri Onay/Red Geldi > Üretim aşamasında.(136>109)", "enabled": False},
    {"order": 102, "code": "107_136", "parent": 107, "child": 136, "positive": True, "user_change": True,
     "k1": "Müşteri onayı bekleniyor", "k2": "Müşteri Onay/Red Geldi", "k3": None, "to": "MNG1_AS",
     "short_name": "Müşteri Onay/Red Geldi", "desc": "Müşteri onayı bekleniyor > Müşteri Onay/Red Geldi.(107>136)", "enabled": False},
    {"order": 103, "code": "103_105", "parent": 103, "child": 105, "positive": True, "user_change": False,
     "k1": "İlk test bekleniyor", "k2": "Üretim planına kabul bekleniyor", "k3": None, "to": "QAC",
     "short_name": "Test Yapılamıyor - Üretime Aktar", "desc": "İlk test bekleniyor > Üretim planına kabul bekleniyor.(103>105)", "enabled": False},
    {"order": 104, "code": "135_136", "parent": 135, "child": 136, "positive": True, "user_change": True,
     "k1": "İade için son teste gönderildi", "k2": "Müşteri Onay/Red Geldi", "k3": None, "to": "TEC_DISMANTLE",
     "short_name": "İade Edilmeyecek - Müşteri Onayı Geldi", "desc": "İade için son teste gönderildi > Müşteri Onay/Red Geldi.(135>136)", "enabled": False},
    {"order": 105, "code": "109_137", "parent": 109, "child": 137, "positive": True, "user_change": False,
     "k1": "Üretim aşamasında", "k2": "Ara Teste Teslim edilecek", "k3": None, "to": "TEC_DISMANTLE",
     "short_name": "Ara Test için teslim et", "desc": "Üretim aşamasında > Ara Teste Teslim edilecek.(109>137)", "enabled": False},
    {"order": 106, "code": "109_138", "parent": 109, "child": 138, "positive": True, "user_change": False,
     "k1": "Üretim aşamasında", "k2": "Ara Test Bekleniyor", "k3": None, "to": "TEC_DISMANTLE",
     "short_name": "Ara Test için Teslim al", "desc": "Üretim aşamasında > Ara Test Bekleniyor.(109>138)", "enabled": False},
    {"order": 107, "code": "138_124", "parent": 138, "child": 124, "positive": True, "user_change": True,
     "k1": "Ara Test Bekleniyor", "k2": "Son Teste teslim edilecek", "k3": None, "to": "MNG1_AS",
     "short_name": "Ara Test Yap", "desc": "Ara Test Bekleniyor > Son Teste teslim edilecek.(138>124)", "enabled": True},
]


def main():
    print("Modül 5 Seed v2 (Statümap.xlsx) başlıyor...", flush=True)
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    session = get_session_factory()()

    try:
        session.execute(text("DELETE FROM warehouse.service_statu_map"))

        for r in ROWS:
            smap = ServiceStatuMap(
                id=uuid.uuid4(),
                order_number=r["order"],
                code=r["code"],
                parent_statu=r["parent"],
                child_statu=r["child"],
                is_positive=r["positive"],
                is_user_change_statu=r["user_change"],
                kontrol_1=r["k1"],
                kontrol_2=r["k2"],
                kontrol_3=r["k3"],
                to_dest=r["to"],
                short_name=r["short_name"],
                description=r["desc"],
                enabled=r["enabled"],
            )
            session.add(smap)

        session.commit()
        print(f"TUM SEED ISLEMI BASARILI! {len(ROWS)} kuralli matris olusturuldu.", flush=True)
    except Exception as e:
        session.rollback()
        import traceback
        traceback.print_exc()
        print("HATA:", str(e), flush=True)
    finally:
        session.close()


if __name__ == "__main__":
    main()
