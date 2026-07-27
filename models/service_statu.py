import uuid
from sqlalchemy import Column, String, Integer, Boolean, Float
from sqlalchemy.dialects.postgresql import UUID
from config.database import Base

class ServiceStatu(Base):
    __tablename__ = "service_statu"
    __table_args__ = {"schema": "warehouse"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(Integer, nullable=True, unique=True)
    order_number = Column(Float, nullable=True)
    language = Column(String(10), default="tr")
    short_name = Column(String(255), nullable=True)
    full_name = Column(String(255), nullable=True)
    description = Column(String(500), nullable=True)
    cost_center = Column(String(255), nullable=True)
    mission = Column(String(255), nullable=True)
    is_closed = Column(Boolean, default=False)
    is_repair_continue = Column(Boolean, default=True)
    enabled = Column(Boolean, default=True)
    update = Column(Boolean, default=False)
