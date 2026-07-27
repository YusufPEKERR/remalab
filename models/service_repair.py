from sqlalchemy import Column, Integer, String, Text, DateTime, func, Index
from config.database import Base

class ServiceRepair(Base):
    """
    Servis Onarımları Tablosu
    BatchEntries tablosundaki imei_number üzerinden işlemleri takip eder.
    """
    __tablename__ = 'service_repairs'
    __table_args__ = (
        Index('idx_service_repairs_imei', 'imei_number'),
        {'schema': 'warehouse'}
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    imei_number = Column(String(100), nullable=False)
    technician_name = Column(String(100), nullable=True)
    fault_description = Column(Text, nullable=True)
    repair_notes = Column(Text, nullable=True)
    status = Column(String(50), default='In Progress')
    warranty_status = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
