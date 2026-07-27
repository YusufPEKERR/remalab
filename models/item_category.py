import uuid
from sqlalchemy import Column, String, Integer, Boolean, Float
from sqlalchemy.dialects.postgresql import UUID
from config.database import Base

class ItemCategory(Base):
    __tablename__ = "item_category"
    __table_args__ = {"schema": "warehouse"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(255), nullable=True, unique=True)
    order_number = Column(Float, nullable=True)
    short_name = Column(String(255), nullable=True)
    enabled = Column(Boolean, default=True)
    is_pre_approved = Column(Boolean, default=False)
    is_plus_item_price = Column(Boolean, default=False)
    item_labour = Column(String(255), nullable=True)
    update = Column(Boolean, default=False)
