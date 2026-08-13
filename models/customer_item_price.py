"""
RemaLab WMS – CustomerItemPrice (Müşteri Fiyat Matrisi) Modeli
Warehouse şeması.

item_code (parça veya DGD işçilik kodu) x customer_code (warehouse.customers.code)
kombinasyonu için sabit TL fiyat. Eşleşme yoksa warehouse.item.satis'e düşülür
(bkz. get_effective_price Slot'u).
"""

from sqlalchemy import Column, String, Numeric, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
import uuid
import datetime

from config.database import Base
from core.zaman import tr_now


class CustomerItemPrice(Base):
    __tablename__ = "customer_item_prices"
    __table_args__ = (
        UniqueConstraint("item_code", "customer_code", name="uq_customer_item_price"),
        {"schema": "warehouse"},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_code = Column(String(100), nullable=False)
    customer_code = Column(String(50), nullable=False)
    price = Column(Numeric(12, 2), nullable=False, default=0)
    updated_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=tr_now)
    updated_at = Column(DateTime, default=tr_now, onupdate=tr_now)
