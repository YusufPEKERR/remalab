"""
RemaLab WMS – CostCenter (Maliyet Merkezi) Modeli
Organization şeması.
"""

from sqlalchemy import Column, String, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from config.database import Base


class CostCenter(Base):
    """Maliyet merkezi tanımı."""
    __tablename__ = "cost_centers"
    __table_args__ = {"schema": "organization"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_number = Column(Integer, nullable=True)
    code = Column(String(100), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    is_default = Column(Boolean, nullable=False, default=False)

    # İlişkiler
    branches = relationship("Branch", back_populates="cost_center_rel")
    warehouses = relationship("Warehouse", back_populates="cost_center_rel")
