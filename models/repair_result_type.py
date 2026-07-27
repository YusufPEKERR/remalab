import uuid
from sqlalchemy import Column, String, Integer, Boolean, Float
from sqlalchemy.dialects.postgresql import UUID
from config.database import Base

class RepairResultType(Base):
    __tablename__ = "repair_result_type"
    __table_args__ = {"schema": "warehouse"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(Integer, nullable=True, unique=True)
    order_number = Column(Integer, nullable=True)
    short_name = Column(String(255), nullable=True)
    language = Column(String(10), nullable=True)
    is_success = Column(Boolean, default=False)
    is_cancelled = Column(Boolean, default=False)
    update = Column(Boolean, default=False)
