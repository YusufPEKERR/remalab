from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from models.service_statu_map import ServiceStatuMap
from models.service_statu import ServiceStatu
from models.service_test_result_type import ServiceTestResultType

class StateMachineService:
    def __init__(self, db: Session):
        self.db = db
        
    def get_allowed_transitions(self, current_statu_code: int) -> List[Dict[str, Any]]:
        """
        Belirtilen statüden gidilebilecek olası (izinli) bir sonraki statüleri döndürür.
        """
        transitions = self.db.query(ServiceStatuMap).filter_by(
            parent_statu=current_statu_code, 
            enabled=True
        ).order_number.asc().all() if hasattr(ServiceStatuMap, 'order_number') else self.db.query(ServiceStatuMap).filter_by(
            parent_statu=current_statu_code, 
            enabled=True
        ).all()
        
        results = []
        for trans in transitions:
            child = self.db.query(ServiceStatu).filter_by(code=trans.child_statu).first()
            results.append({
                "transition_code": trans.code,
                "target_statu_code": trans.child_statu,
                "target_statu_name": child.short_name if child else str(trans.child_statu),
                "is_positive": trans.is_positive,
                "is_user_change": trans.is_user_change_statu,
                "kontrol_1": trans.kontrol_1,
                "kontrol_2": trans.kontrol_2,
                "kontrol_3": trans.kontrol_3,
            })
        return results

    def validate_transition(self, current_statu_code: int, target_statu_code: int) -> bool:
        """
        İki statü arasında direkt geçiş olup olmadığını denetler.
        """
        mapping = self.db.query(ServiceStatuMap).filter_by(
            parent_statu=current_statu_code,
            child_statu=target_statu_code,
            enabled=True
        ).first()
        
        return mapping is not None

    def execute_transition(
        self, 
        current_statu_code: int, 
        target_statu_code: int, 
        request_type_code: Optional[str] = None, 
        test_result_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Geçiş validasyonunu yapar ve kuralları uygular. 
        Gerçek cihaz güncellemesi yapmak yerine "yeni statüyü" (veya red durumunu) döndürür.
        (Gerçek update işlemi çağıran endpoint'te/repository'de yapılmalıdır).
        """
        # KURAL 1: Battery Only ise ve bir test adımıysa testi NotRequired kabul et ve zorla
        # "Battery only" (veya "Battery only ") için boşluklara tolerans göster
        is_battery_only = request_type_code and "battery only" in request_type_code.lower()
        
        # Test adımı mı? Eğer frontend test sonucu göndermiyorsa, normal geçiştir.
        # Battery only akışında eğer frontend sonucu sormadıysa bile (None) ya da manuel geçişte:
        if is_battery_only:
            test_result_code = "NotRequired"

        # KURAL 2: Eğer Test Sonucu Başarısız (Fail1 vb.) ise ve bu geçiş "isPositive" kuralı gerektiriyorsa,
        # işlemi NOK kabul edip 109 statüsüne atar.
        test_result = None
        if test_result_code:
            test_result = self.db.query(ServiceTestResultType).filter_by(code=test_result_code).first()

        is_test_failed = test_result and not test_result.is_success and test_result.code != "NotRequired"

        if is_test_failed:
            # Test başarısız, 109 - Üretim Aşamasında'ya geri dön
            fallback_statu = 109
            return {
                "success": True,
                "new_statu_code": fallback_statu,
                "message": f"Test başarısız ({test_result_code}). Cihaz negatif akışa girdi ve {fallback_statu} statüsüne yönlendirildi.",
                "is_fallback": True
            }

        # KURAL 3: Validasyon
        if not self.validate_transition(current_statu_code, target_statu_code):
            return {
                "success": False,
                "message": f"Geçersiz işlem: {current_statu_code} statüsünden {target_statu_code} statüsüne geçiş izni yok."
            }

        # Geçiş başarılı
        return {
            "success": True,
            "new_statu_code": target_statu_code,
            "message": "Geçiş başarılı.",
            "is_fallback": False
        }
