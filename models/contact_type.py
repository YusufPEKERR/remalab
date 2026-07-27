"""
RemaLab WMS – ContactType (İletişim Türü) Modeli
Organization şeması.
"""

from sqlalchemy import Column, String, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID
import uuid

from config.database import Base


class ContactType(Base):
    """İletişim türü tanımı (Staff / Customer / Supplier)."""
    __tablename__ = "contact_types"
    __table_args__ = {"schema": "organization"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_number = Column(Integer, nullable=True)
    code = Column(String(100), nullable=False)
    short_name = Column(String(255), nullable=False)
    full_name = Column(String(500), nullable=True)
    description = Column(String(1000), nullable=True)
    is_default = Column(Boolean, nullable=True, default=False)
    account_type = Column(String(50), nullable=False)  # STAFF, CUSTOMER, SUPPLIER
