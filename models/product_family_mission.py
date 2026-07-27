import uuid
from sqlalchemy import Column, String, Integer, Boolean, Float
from sqlalchemy.dialects.postgresql import UUID
from config.database import Base

class ProductFamilyMission(Base):
    __tablename__ = "product_family_mission"
    __table_args__ = {"schema": "warehouse"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(255), nullable=True, unique=True)
    order_number = Column(Float, nullable=True)
    mission = Column(String(255), nullable=True)
    product_family = Column(String(255), nullable=True)
    validation = Column(String(255), nullable=True)
    update = Column(Boolean, default=False)
