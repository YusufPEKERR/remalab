from typing import List
from sqlalchemy.orm import Session
from models.item_category_mission import ItemCategoryMission
from models.product_family_mission import ProductFamilyMission
from models.repair_record import RepairRecord

EXPERT_MISSIONS = {
    "TEC_L3REPAIR",
    "TEC_BATTERY",
    "TEC_DISPLAY",
    "TEC_CAMERA",
    "TEC_CASE"
}

class RepairService:
    def __init__(self, db: Session):
        self.db = db

    def generate_concurrent_repairs(
        self, 
        service_record_id: str, 
        product_family_code: str, 
        faulty_categories: List[str]
    ) -> List[RepairRecord]:
        """
        Dinamik Filtreleme ve Uzmanlık Koruma (Filter & Preserve) Algoritması
        """
        if not faulty_categories:
            return []

        # 1. Havuz (Pool) Oluşturma
        pool_missions = set()
        for cat in faulty_categories:
            missions = self.db.query(ItemCategoryMission).filter_by(
                item_category=cat, enabled=True
            ).all()
            for m in missions:
                if m.mission:
                    pool_missions.add(m.mission)

        if not pool_missions:
            return []

        # 2. Cihazın Zorluk Kademesini (ProductFamilyMission) bulma
        device_missions = self.db.query(ProductFamilyMission).filter_by(
            product_family=product_family_code
        ).all()
        device_level_missions = {m.mission for m in device_missions if m.mission}

        # KURAL 1 & KURAL 2: Filtreleme ve Uzmanlık Koruma
        final_missions = set()
        
        # Havuzdaki genel montaj kademelerini (L1, L2 vb.) cihazın desteklediği ile sınırla
        # Uzmanlık görevleri ise doğrudan ekle.
        for m in pool_missions:
            if m in EXPERT_MISSIONS:
                # KURAL 2 & 3: Uzmanlık ve L3 Koruma (Asla ezme)
                final_missions.add(m)
            else:
                # KURAL 1: L1/L2 Filtrelemesi. Cihazın kademesine uyuyorsa al.
                # Eğer cihazın ProductFamilyMission'ı boşsa (tanımsızsa) hepsini alabiliriz 
                # veya fallback yapabiliriz. Şimdilik uyumlu olanları alıyoruz.
                if not device_level_missions or m in device_level_missions:
                    final_missions.add(m)

        # 3. Repair ID (Alt Onarım) Oluşturma ve Önceliklendirme
        # Önceliklendirme: Battery ilk sırada olacak şekilde sıralama
        def priority_key(mission_name: str) -> int:
            if "BATTERY" in mission_name:
                return 0
            if "L3" in mission_name:
                return 1
            return 2

        sorted_missions = sorted(list(final_missions), key=priority_key)

        records = []
        for mission in sorted_missions:
            # Sadece o mission'a ait kategorileri not olarak veya virgüllü yazabiliriz
            # Şimdilik genel kategorileri kaydediyoruz.
            rec = RepairRecord(
                service_record_id=str(service_record_id),
                department_mission=mission,
                repair_result_type_code=1000, # Atanacak
                item_category=",".join(faulty_categories)
            )
            self.db.add(rec)
            records.append(rec)
            
        self.db.commit()
        return records
