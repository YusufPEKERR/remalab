import uuid
from sqlalchemy import Column, String, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID
from config.database import Base

class ItemLabour(Base):
    """İşçilik seviyesi tanımı (Level 0..3, Bat.Replacement1/2).

    order_number = BASKINLIK. Bir onarımda birden çok parça varsa cihazın seviyesi,
    parçalarının bağlı olduğu seviyeler içinde order_number'ı EN BÜYÜK olandır.
    Fiyatlandırma bu seviyeye göre yapılır (warehouse.customer_level_labour_prices).

    enabled=False olan seviye artık kullanılmaz: kategori atamasında seçilemez ve
    fiyat matrisinde sütunu çıkmaz. (Level 1M böyle kapatıldı - üyesi kalmamıştı ve
    hiçbir müşteride fiyatı tanımlı değildi, yani 0 € faturalanıyordu.)
    """
    __tablename__ = "item_labour"
    __table_args__ = {"schema": "warehouse"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(255), nullable=True, unique=True)
    order_number = Column(Integer, nullable=True)
    language = Column(String(10), default="tr")
    short_name = Column(String(255), nullable=True)
    full_name = Column(String(255), nullable=True)
    description = Column(String(255), nullable=True)
    cost_center = Column(String(255), nullable=True)
    item_type = Column(String(255), nullable=True)
    enabled = Column(Boolean, nullable=False, default=True)
    update = Column(Boolean, default=False)
