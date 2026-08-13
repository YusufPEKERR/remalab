"""
RemaLab WMS – CustomerDgdLabourPrice (DGD İşçilik Fiyatı) Modeli
Warehouse şeması.

pricing.xlsx Tablo 3: her müşteri × DGD durumu (dgd_key) için sabit TL işçilik fiyatı.
dgd_key sabit küme: 'full_functional' ("Full Functional"), 'not_full_functional'
("Full Functional Değil"), 'ch_bat_replacement' ("CH Bat.Replacement"). Bir onarımda cihazın
DGD işçiliği, cihazın durumuna göre bu tablodan seçilir (durum -> sütun eşlemesi sonraki aşamada).
"""

from sqlalchemy import Column, String, Numeric, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
import uuid
import datetime

from config.database import Base
from core.zaman import tr_now


class CustomerDgdLabourPrice(Base):
    __tablename__ = "customer_dgd_labour_prices"
    __table_args__ = (
        UniqueConstraint("customer_code", "dgd_key", name="uq_customer_dgd_labour_price"),
        {"schema": "warehouse"},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_code = Column(String(50), nullable=False)
    dgd_key = Column(String(50), nullable=False)
    price = Column(Numeric(12, 2), nullable=False, default=0)
    updated_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=tr_now)
    updated_at = Column(DateTime, default=tr_now, onupdate=tr_now)
