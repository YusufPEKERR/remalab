import uuid
from sqlalchemy import Column, String, Integer, Boolean, Float
from sqlalchemy.dialects.postgresql import UUID
from config.database import Base

class ProductModel(Base):
    __tablename__ = "product_model"
    __table_args__ = {"schema": "warehouse"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_number = Column(Integer, nullable=True)
    code = Column(String(255), nullable=True, unique=True)
    language = Column(String(10), default="tr")
    short_name = Column(String(255), nullable=True)
    brand = Column(String(255), nullable=True)
    product_family = Column(String(255), nullable=True)
    repair_time = Column(Integer, nullable=True)
    is_vip = Column(Boolean, default=False)
    has_water_resistance = Column(Boolean, default=False)
    is_pre_approved_price = Column(Boolean, default=False)
    is_auto_repair = Column(Boolean, default=False)
    service_brand = Column(String(255), nullable=True)
    enabled = Column(Boolean, default=True)
    update = Column(Boolean, default=False)
