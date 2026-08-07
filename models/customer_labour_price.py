"""
RemaLab WMS – CustomerLabourPrice (Müşteri İşçilik Fiyatı Matrisi) Modeli
Warehouse şeması.

item_code (parça veya DGD işçilik kodu) x customer_code (warehouse.customers.code)
kombinasyonu için sabit TL işçilik fiyatı. Müşteri Fiyat Matrisi'nin (customer_item_prices)
birebir yapısal kopyasıdır; yalnızca ayrı bir tabloda yaşar ki iki matris birbirinden
bağımsız fiyat tutabilsin.
"""

from sqlalchemy import Column, String, Numeric, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
import uuid
import datetime

from config.database import Base


class CustomerLabourPrice(Base):
    __tablename__ = "customer_labour_prices"
    __table_args__ = (
        UniqueConstraint("item_code", "customer_code", name="uq_customer_labour_price"),
        {"schema": "warehouse"},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_code = Column(String(100), nullable=False)
    customer_code = Column(String(50), nullable=False)
    price = Column(Numeric(12, 2), nullable=False, default=0)
    updated_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
