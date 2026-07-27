import uuid
from sqlalchemy import Column, String, Integer, Boolean, Float
from sqlalchemy.dialects.postgresql import UUID
from config.database import Base

class ServiceStatuMap(Base):
    """Sistemin anayasası: Statü geçiş kuralları"""
    __tablename__ = "service_statu_map"
    __table_args__ = {"schema": "warehouse"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_number = Column(Integer, nullable=True)
    code = Column(String(255), nullable=True, unique=True) # Ornegin: "100_101"
    parent_statu = Column(Integer, nullable=False) # Hangi statüden
    child_statu = Column(Integer, nullable=False)  # Hangi statüye
    is_positive = Column(Boolean, default=True)
    is_user_change_statu = Column(Boolean, default=True)
    kontrol_1 = Column(String(255), nullable=True)
    kontrol_2 = Column(String(255), nullable=True)
    kontrol_3 = Column(String(255), nullable=True)
    to_dest = Column(String(255), nullable=True) # excel'deki 'to' kolonu
    short_name = Column(String(255), nullable=True)
    full_name = Column(String(255), nullable=True)
    description = Column(String(500), nullable=True)
    enabled = Column(Boolean, default=True)
    mio_control = Column(String(255), nullable=True)
    update = Column(Boolean, default=False)
