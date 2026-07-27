"""
RemaLab WMS – StockPlace (Stok Yeri) Modeli
Organization şeması.

Temel Depo Kuralları:
  - DOA   → Arızalı/Hurda malzeme stok yeri
  - GOOD  → Sağlam malzeme stok yeri
  - OUT   → Çıkış stok yeri
  - REPAIR → Onarım malzeme stok yeri
  - SCRAP  → İmha malzeme stok yeri
  - REVLCD → Revize ekran stok yeri
"""

from sqlalchemy import Column, String, Integer, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from config.database import Base


# Stok yeri tipleri – iş kuralı sabitleri
STOCK_PLACE_TYPES = {
    "DOA": "Arızalı Malzeme Stok Yeri",
    "GOOD": "Sağlam Malzeme Stok Yeri",
    "OUT": "Çıkış Stok Yeri",
    "REPAIR": "Onarım Malzeme Stok Yeri",
    "SCRAP": "İmha Malzeme Stok Yeri",
    "REVLCD": "Revize Ekran Stok Yeri",
}


class StockPlace(Base):
    """Depo altındaki stok yeri tanımı."""
    __tablename__ = "stock_places"
    __table_args__ = {"schema": "organization"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_number = Column(Integer, nullable=True)
    code = Column(String(50), nullable=False)
    language = Column(String(10), nullable=True, default="tr")
    short_name = Column(String(255), nullable=False)
    full_name = Column(String(500), nullable=True)
    description = Column(String(1000), nullable=True)
    warehouse_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organization.warehouses.id"),
        nullable=False,
    )
    is_default = Column(Boolean, nullable=True, default=False)
    enabled = Column(Boolean, nullable=True, default=True)

    # İlişkiler
    warehouse_rel = relationship("Warehouse", back_populates="stock_places")

    @property
    def is_defective(self) -> bool:
        """DOA (arızalı) stok yeri mi?"""
        return self.code == "DOA"

    @property
    def is_good(self) -> bool:
        """Sağlam malzeme stok yeri mi?"""
        return self.code == "GOOD"

    @property
    def is_exit(self) -> bool:
        """Çıkış stok yeri mi?"""
        return self.code == "OUT"

    @property
    def is_repair(self) -> bool:
        """Onarım stok yeri mi?"""
        return self.code == "REPAIR"

    @property
    def is_scrap(self) -> bool:
        """İmha stok yeri mi?"""
        return self.code == "SCRAP"
