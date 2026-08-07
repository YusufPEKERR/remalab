"""
RemaLab WMS – CustomerLevelLabourPrice (Seviye İşçilik Fiyatı) Modeli
Warehouse şeması.

pricing.xlsx Tablo 1: her müşteri × işçilik SEVİYESİ (level_key) için sabit TL işçilik fiyatı.
level_key sabit küme: Level 0 / Level 1 / Level 2 / Level 3 / Bat.Replacement1 / Bat.Replacement2.
Bir onarımda ilk parçanın (Part1) işçiliği, cihazın Repair Level'inin bu tablodaki fiyatıdır.
"""

from sqlalchemy import Column, String, Numeric, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
import uuid
import datetime

from config.database import Base


class CustomerLevelLabourPrice(Base):
    __tablename__ = "customer_level_labour_prices"
    __table_args__ = (
        UniqueConstraint("customer_code", "level_key", name="uq_customer_level_labour_price"),
        {"schema": "warehouse"},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_code = Column(String(50), nullable=False)
    level_key = Column(String(50), nullable=False)
    price = Column(Numeric(12, 2), nullable=False, default=0)
    updated_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
