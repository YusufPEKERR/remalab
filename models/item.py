import uuid
from sqlalchemy import Column, String, Boolean, Float, DateTime
from sqlalchemy.dialects.postgresql import UUID
from config.database import Base

class Item(Base):
    """Genel parça/malzeme tablosu (Ürünler dahil edilebilir veya ayrı tutulabilir)"""
    __tablename__ = "item"
    __table_args__ = {"schema": "warehouse"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(255), nullable=True, unique=True)
    short_name = Column(String(255), nullable=True)
    color = Column(String(255), nullable=True)
    item_type = Column(String(255), nullable=True)
    item_category = Column(String(255), nullable=True)
    enabled = Column(Boolean, default=True)
    update = Column(Boolean, default=False)
    alis = Column(Float, nullable=True)
    satis = Column(Float, nullable=True)
    update_time = Column(DateTime, nullable=True)
    error_message = Column(Float, nullable=True)
