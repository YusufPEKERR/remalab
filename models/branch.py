"""
RemaLab WMS – Branch (Şube) Modeli
Organization şeması.
"""

from sqlalchemy import Column, String, Integer, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from config.database import Base


class Branch(Base):
    """Şube tanımı."""
    __tablename__ = "branches"
    __table_args__ = {"schema": "organization"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_number = Column(Integer, nullable=True)
    code = Column(String(100), unique=True, nullable=False)
    cost_center_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organization.cost_centers.id"),
        nullable=True,
    )
    currency = Column(String(10), nullable=True)
    is_default = Column(Boolean, nullable=False, default=False)
    account_language = Column(String(10), nullable=True)
    short_name = Column(String(255), nullable=False)
    full_name = Column(String(500), nullable=True)
    description = Column(String(1000), nullable=True)

    # İlişkiler
    cost_center_rel = relationship("CostCenter", back_populates="branches")
    warehouses = relationship("Warehouse", back_populates="branch_rel")
