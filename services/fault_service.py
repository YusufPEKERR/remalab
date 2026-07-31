from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from models.item_fault import ItemFault

class FaultService:
    def __init__(self, db: Session):
        self.db = db

    def search_by_symptom(self, symptom_code: str) -> Dict[str, Any]:
        """
        Müşteri şikayetine (Symptom) bağlı olası parça kategorilerini 
        ve teknik arızaları (ItemFault) getirir.
        """
        symptom = self.db.query(Symptom).filter_by(code=symptom_code).first()
        if not symptom:
            return {"error": "Symptom not found"}
            
        # Symptom, item_category referansı taşıyor mu?
        category = symptom.item_category
        
        faults = []
        if category:
            # Bu kategoriye ait arıza tanımları (ItemFault)
            fault_records = self.db.query(ItemFault).filter_by(item_category=category).all()
            faults = [{"code": f.code, "name": f.short_name} for f in fault_records]
            
        return {
            "symptom_code": symptom.code,
            "symptom_name": symptom.short_name,
            "related_category": category,
            "possible_faults": faults
        }
