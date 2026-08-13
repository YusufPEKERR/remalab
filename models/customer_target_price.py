"""
RemaLab WMS – CustomerTargetPrice (Müşteri Hedef Fiyat Matrisi) Modeli
Warehouse şeması.

customer_code x product_family_code (cihaz modeli) x screen_test_result x
power_test_result kombinasyonu için bir hedef/limit fiyat. Demontaj ekranında
eklenen onarım parçalarının toplam fiyatı (bkz. get_effective_price) bu limiti
aşarsa cihaz otomatik olarak Müşteri Onayına yönlendirilir (bkz.
submit_dismantle_decision). brand/product_type, product_family_code'dan
otomatik türetilir - bağımsız düzenlenmez (çelişkiyi önlemek için).
"""

from sqlalchemy import Column, String, Numeric, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
import uuid
import datetime

from config.database import Base
from core.zaman import tr_now


class CustomerTargetPrice(Base):
    __tablename__ = "customer_target_prices"
    __table_args__ = (
        UniqueConstraint(
            "customer_code", "product_family_code", "screen_test_result", "power_test_result",
            name="uq_customer_target_price"
        ),
        {"schema": "warehouse"},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_code = Column(String(50), nullable=False)
    product_family_code = Column(String(100), nullable=False)
    brand = Column(String(100), nullable=True)
    product_type = Column(String(100), nullable=True)
    # 'OK' / 'NOK' / 'BOŞ' (test yapılmamış) - joker değildir, üç ayrı durumdan biri zorunludur.
    screen_test_result = Column(String(10), nullable=False)
    power_test_result = Column(String(10), nullable=False)
    target_price = Column(Numeric(12, 2), nullable=False, default=0)
    currency = Column(String(10), nullable=True)
    updated_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=tr_now)
    updated_at = Column(DateTime, default=tr_now, onupdate=tr_now)
