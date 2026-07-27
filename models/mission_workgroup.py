"""
RemaLab WMS – MissionWorkgroup (Atölye/Masa) Modeli
Organization şeması.
"""

from sqlalchemy import Column, String, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from config.database import Base


class MissionWorkgroup(Base):
    """Atölye / Masa tanımı."""
    __tablename__ = "mission_workgroups"
    __table_args__ = {"schema": "organization"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_number = Column(Integer, nullable=True)
    code = Column(String(100), unique=True, nullable=False)
    language = Column(String(10), nullable=True, default="tr")
    short_name = Column(String(255), nullable=False)
    full_name = Column(String(500), nullable=True)
    description = Column(String(1000), nullable=True)
    cost_center = Column(String(255), nullable=True)
    department = Column(String(255), nullable=True)
    default_labour_force = Column(
        String(50), nullable=True, comment="Mavi Yaka / Beyaz Yaka"
    )
    default_shift_required = Column(Boolean, nullable=False, default=True)
    default_overtime_fee = Column(Boolean, nullable=False, default=False)

    # İlişkiler
    missions = relationship("Mission", back_populates="mission_workgroup_rel")
