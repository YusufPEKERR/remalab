from sqlalchemy import Boolean, Column, Integer, String

from config.database import Base


class PartCategory(Base):
    __tablename__ = "part_categories"
    __table_args__ = {"schema": "warehouse"}

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, unique=True)
    part_type = Column(String(100), nullable=True)
    departments = Column(String(255), nullable=True)
    stock_tracking_type = Column(String(20), nullable=True, default="Stok Takipli")
    default_location_id = Column(Integer, nullable=True)
    is_active = Column(Boolean, nullable=True, default=True)
    description = Column(String, nullable=True)
