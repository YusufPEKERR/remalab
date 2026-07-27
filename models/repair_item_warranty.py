import uuid
from sqlalchemy import Column, String, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID
from config.database import Base

class RepairItemWarranty(Base):
    __tablename__ = "repair_item_warranty"
    __table_args__ = {"schema": "warehouse"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(255), nullable=True, unique=True)
    order_number = Column(Integer, nullable=True)
    language = Column(String(10), nullable=True)
    short_name = Column(String(255), nullable=True)
    full_name = Column(String(255), nullable=True)
    description = Column(String(500), nullable=True)
    cost_center = Column(String(255), nullable=True)
    is_paid_for = Column(Boolean, default=True)  # True ise ucretli
    update = Column(Boolean, default=False)
