import uuid
from sqlalchemy import Column, String, Integer, Boolean, Float
from sqlalchemy.dialects.postgresql import UUID
from config.database import Base

class Symptom(Base):
    __tablename__ = "symptom"
    __table_args__ = {"schema": "warehouse"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_number = Column(Float, nullable=True)
    code = Column(String(255), nullable=True, unique=True)
    short_name = Column(String(255), nullable=True)
    group_name = Column(String(255), nullable=True)
    mission_group = Column(String(255), nullable=True)
    item_category = Column(String(255), nullable=True)
    update = Column(Boolean, default=False)
