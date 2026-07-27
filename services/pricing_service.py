from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from models.item import Item
from models.item_category import ItemCategory
from models.item_labour import ItemLabour

class PricingService:
    def __init__(self, db: Session):
        self.db = db

    def calculate_basket(self, item_codes: List[str]) -> Dict[str, Any]:
        """
        Onarım sepetindeki parçaların fiyatlandırma ve işçilik kurallarını hesaplar.
        """
        result = {
            "total_parts_price": 0.0,
            "dominant_labour": None,
            "items": []
        }
        
        labour_candidates = []
        
        for code in item_codes:
            item = self.db.query(Item).filter_by(code=code).first()
            if not item:
                continue
                
            category = None
            if item.item_category:
                category = self.db.query(ItemCategory).filter_by(short_name=item.item_category).first()
                if not category:
                    category = self.db.query(ItemCategory).filter_by(code=item.item_category).first()
                    
            item_detail = {
                "code": item.code,
                "name": item.short_name,
                "price": item.satis or 0.0,
                "is_pre_approved": False,
                "is_plus_item_price": False,
                "labour_class": None
            }
            
            if category:
                item_detail["is_pre_approved"] = category.is_pre_approved
                item_detail["is_plus_item_price"] = category.is_plus_item_price
                item_detail["labour_class"] = category.item_labour
                
                # Kural 1: Ön fiyat verilebilir ise fiyatı sepete ekle
                if category.is_pre_approved:
                    result["total_parts_price"] += item_detail["price"]
                # Kural 2: isPlusItemPrice ise (stok hareketi olmadan parça fiyatı)
                elif category.is_plus_item_price:
                    result["total_parts_price"] += item_detail["price"]
                
                # İşçilik adaylarını topla
                if category.item_labour:
                    labour_candidates.append(category.item_labour)
                    
            result["items"].append(item_detail)
            
        # Kural 3: İşçilik baskınlığı (En büyük order_number)
        if labour_candidates:
            labours = self.db.query(ItemLabour).filter(ItemLabour.short_name.in_(labour_candidates)).all()
            if not labours:
                labours = self.db.query(ItemLabour).filter(ItemLabour.code.in_(labour_candidates)).all()
                
            if labours:
                # order_number'a göre sırala (en büyük en baskın kabul edilecek, örn: Level 3 > Level 1)
                dominant = max(labours, key=lambda l: l.order_number or 0)
                result["dominant_labour"] = {
                    "code": dominant.code,
                    "name": dominant.short_name,
                    "order_number": dominant.order_number
                }
                
        return result

    def calculate_basket_with_warranty(self, item_codes: List[str], warranties: List[str]) -> Dict[str, Any]:
        """
        Onarım sepetini garanti (IW/OOW) kuralları ile hesaplar.
        Eğer bir parça IW (In Warranty - is_paid_for=False) ise fiyatı 0 olarak yansır.
        """
        from models.repair_item_warranty import RepairItemWarranty
        
        result = self.calculate_basket(item_codes)
        
        # Garanti bazli fiyat ezme (Override with 0 TL if IW)
        # Zip item_codes and warranties to match them
        # result["items"] icindeki dictleri guncelleyelim
        
        adjusted_total = 0.0
        for i, item_detail in enumerate(result["items"]):
            w_code = warranties[i] if i < len(warranties) else None
            is_iw = False
            
            if w_code:
                w_record = self.db.query(RepairItemWarranty).filter_by(code=w_code).first()
                if w_record and not w_record.is_paid_for:
                    is_iw = True
                    
            if is_iw:
                # Ucretsiz onarim, fiyat 0
                item_detail["price"] = 0.0
                item_detail["warranty"] = "IW (Ücretsiz)"
            else:
                item_detail["warranty"] = "OOW (Ücretli)"
                
            # Adjusted total sum
            if item_detail.get("is_pre_approved") or item_detail.get("is_plus_item_price"):
                adjusted_total += item_detail["price"]
                
        result["total_parts_price"] = adjusted_total
        return result

