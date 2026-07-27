"""
RemaLab WMS – Mission (Görev/Yetki) Modeli
Organization şeması.

Amir zinciri: Her görev, 3 seviye yönetim referansı taşır:
  - teamLeaderManagerMission   → Takım lideri görev kodu
  - operationManagerMission    → Operasyon yöneticisi görev kodu
  - administrativeManagerMission → İdari yönetici görev kodu
"""

from sqlalchemy import Column, String, Integer, Float, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from config.database import Base


class Mission(Base):
    """Görev / Yetki tanımı."""
    __tablename__ = "missions"
    __table_args__ = {"schema": "organization"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_number = Column(Float, nullable=True)
    code = Column(String(100), unique=True, nullable=False)
    language = Column(String(10), nullable=True, default="tr")
    short_name = Column(String(255), nullable=False)
    full_name = Column(String(500), nullable=True)
    description = Column(String(1000), nullable=True)
    cost_center = Column(String(255), nullable=True)
    department = Column(String(255), nullable=True)

    # Görev Grubu FK
    mission_group_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organization.mission_groups.id"),
        nullable=True,
    )
    # Atölye/Masa FK
    mission_workgroup_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organization.mission_workgroups.id"),
        nullable=True,
    )

    # Amir zinciri – görev kodu referansları (self-referencing by code)
    team_leader_mission_code = Column(
        String(100), nullable=True,
        comment="Takım lideri görev kodu"
    )
    operation_manager_mission_code = Column(
        String(100), nullable=True,
        comment="Operasyon yöneticisi görev kodu"
    )
    administrative_manager_mission_code = Column(
        String(100), nullable=True,
        comment="İdari yönetici görev kodu"
    )

    # İlişkiler
    mission_group_rel = relationship("MissionGroup", back_populates="missions")
    mission_workgroup_rel = relationship("MissionWorkgroup", back_populates="missions")
