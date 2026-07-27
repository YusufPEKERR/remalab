import uuid
from sqlalchemy import Column, String, Integer, Boolean, Float
from sqlalchemy.dialects.postgresql import UUID
from config.database import Base

class ItemCategoryMission(Base):
    __tablename__ = "item_category_mission"
    __table_args__ = {"schema": "warehouse"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_number = Column(Float, nullable=True)
    code = Column(String(255), nullable=True, unique=True)
    item_category = Column(String(255), nullable=True)
    mission = Column(String(255), nullable=True)
    enabled = Column(Boolean, default=True)
    update = Column(Boolean, default=False)
