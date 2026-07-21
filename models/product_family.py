from sqlalchemy import Boolean, Column, Integer, String

from config.database import Base


class ProductFamily(Base):
    __tablename__ = "product_families"
    __table_args__ = {"schema": "warehouse"}

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, unique=True)
    is_active = Column(Boolean, nullable=True, default=True)
