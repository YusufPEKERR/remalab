import uuid
from sqlalchemy import Column, String, Integer, Boolean, Float
from sqlalchemy.dialects.postgresql import UUID
from config.database import Base

class ProductFamily(Base):
    __tablename__ = "product_family"
    __table_args__ = {"schema": "warehouse"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_number = Column(Integer, nullable=True)
    code = Column(String(255), nullable=True, unique=True)
    language = Column(String(10), default="tr")
    short_name = Column(String(255), nullable=True)
    brand = Column(String(255), nullable=True)
    update = Column(Boolean, default=False)
