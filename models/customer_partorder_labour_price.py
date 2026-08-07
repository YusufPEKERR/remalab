"""
RemaLab WMS – CustomerPartorderLabourPrice (Parça Sırası İşçilik Ücreti) Modeli
Warehouse şeması.

pricing.xlsx Tablo 2: her müşteri × parça sırası dilimi (order_key) için sabit TL işçilik ücreti.
order_key sabit küme: '1-5' ("1-5. Parça"), '6+' ("6. ve Sonrası"). Bir onarımda ilk parçadan
(Part1, seviye fiyatı alır) SONRAKİ parçaların işçiliği bu tablodan gelir: 2.–6. parça '1-5',
7.+ parça '6+'.
"""

from sqlalchemy import Column, String, Numeric, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
import uuid
import datetime

from config.database import Base


class CustomerPartorderLabourPrice(Base):
    __tablename__ = "customer_partorder_labour_prices"
    __table_args__ = (
        UniqueConstraint("customer_code", "order_key", name="uq_customer_partorder_labour_price"),
        {"schema": "warehouse"},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_code = Column(String(50), nullable=False)
    order_key = Column(String(50), nullable=False)
    price = Column(Numeric(12, 2), nullable=False, default=0)
    updated_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
