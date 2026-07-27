"""
RemaLab WMS – MissionGroup (Görev Grubu) Modeli
Organization şeması.

İş Kuralı (Onarım İş Sırası):
  orderNumber büyük olan grup önce işlenir.
  Aynı orderNumber'a sahip gruplar aynı anda işlem görebilir.
"""

from sqlalchemy import Column, String, Integer, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from config.database import Base


class MissionGroup(Base):
    """Görev grubu tanımı – onarım iş sırasını belirler."""
    __tablename__ = "mission_groups"
    __table_args__ = {"schema": "organization"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(100), unique=True, nullable=False)
    order_number = Column(
        Float, nullable=True,
        comment="Onarım iş sırası. Büyük olan önce işlenir. "
                "Aynı değerdekiler paralel çalışabilir."
    )
    language = Column(String(10), nullable=True, default="tr")
    short_name = Column(String(255), nullable=False)
    full_name = Column(String(500), nullable=True)
    description = Column(String(1000), nullable=True)
    cost_center = Column(String(255), nullable=True)
    department = Column(String(255), nullable=True)

    # İlişkiler
    missions = relationship("Mission", back_populates="mission_group_rel")
