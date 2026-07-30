import uuid
from sqlalchemy import Column, String, Integer, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from config.database import Base
import datetime

class RepairRecord(Base):
    """
    Alt Onarım İş Emri (Concurrent Repair) tablosu.
    Cihaz 109 statüsündeyken departmanlara eşzamanlı düşen parçalı iş emirleri.
    """
    __tablename__ = "repair_records"
    __table_args__ = {"schema": "warehouse"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    service_record_id = Column(String(255), nullable=False) # service_records veya work_orders FK id'si 
    department_mission = Column(String(255), nullable=False) # Hangi mission'a atandi (BATTERY, L1 vb)
    
    # Su anki statu (Orn: 1000 - Atanacak, 1001 - Atandi, 1002 - Tamamlandi)
    repair_result_type_code = Column(Integer, ForeignKey("warehouse.repair_result_type.code"), default=1000)
    
    # Secilen islem/garanti turleri (teknisyen secer veya sistem atar)
    operation_type_code = Column(String(255), nullable=True)
    warranty_code = Column(String(255), nullable=True) # IW veya OOW
    
    item_category = Column(String(255), nullable=True) # Arızalı parça kategorisi (Orn: Ti-Battery)
    part_item_code = Column(String(100), nullable=True) # warehouse.item/parts kodu (Demontaj ekranı "Parça" seçimi)
    item_fault_code = Column(String(255), nullable=True) # warehouse.item_fault kodu (Demontaj ekranı "Arıza Tespiti")
    supply_status_code = Column(String(255), ForeignKey("warehouse.item_supply_status.code"), nullable=True) # Depo Durum (Onarım Parçaları ekranı)
    supply_requested_by = Column(String(100), nullable=True) # Depo Durum'u en son değiştiren teknisyen (Depo > Parça Teslim ekranı)
    supply_requested_at = Column(DateTime, nullable=True) # Depo Durum'un en son değiştirildiği an
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
