"""
RemaLab WMS – Warehouse (Depo) Modeli
Organization şeması.
Not: Mevcut warehouse şemasındaki Location/Stock tablolarından bağımsızdır.
"""

from sqlalchemy import Column, String, Integer, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from config.database import Base


class Warehouse(Base):
    """Depo tanımı."""
    __tablename__ = "warehouses"
    __table_args__ = {"schema": "organization"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_number = Column(Integer, nullable=True)
    code = Column(String(100), unique=True, nullable=False)
    language = Column(String(10), nullable=True, default="tr")
    short_name = Column(String(255), nullable=False)
    full_name = Column(String(500), nullable=True)
    description = Column(String(1000), nullable=True)
    is_default = Column(Boolean, nullable=False, default=False)
