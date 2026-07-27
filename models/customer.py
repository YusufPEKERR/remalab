"""
RemaLab WMS – Customer (Müşteri) Modeli
Organization şeması.
"""

from sqlalchemy import Column, String, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from config.database import Base


class Customer(Base):
    """Müşteri cari tanımı."""
    __tablename__ = "customers"
    __table_args__ = {"schema": "organization"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(50), unique=True, nullable=False)
    user_name = Column(String(255), nullable=True)
    short_name = Column(String(255), nullable=False)
    full_name = Column(String(500), nullable=True)
    currency = Column(String(10), nullable=True)
    language = Column(String(10), nullable=True, default="tr")
    tax_office = Column(String(255), nullable=True)
    tax_number = Column(String(100), nullable=True)
    customer_language = Column(String(10), nullable=True, default="en")
    use_mio = Column(Boolean, nullable=False, default=False)
    enabled = Column(Boolean, nullable=False, default=True)
    address = Column(String(1000), nullable=True)
    country = Column(String(255), nullable=True)
    payment_method = Column(String(255), nullable=True)
    invoice_delivery_method = Column(String(100), nullable=True)
    shipment_method = Column(String(255), nullable=True)

    # İlişkiler
    target_service_prices = relationship(
        "CustomerTargetServicePrice", back_populates="customer_rel"
    )
