from sqlalchemy import Column, Integer, String

from config.database import Base


class Product(Base):
    __tablename__ = "products"
    __table_args__ = {"schema": "warehouse"}

    id = Column(Integer, primary_key=True)
    item_code = Column(String(100), unique=True, nullable=True)
    brand = Column(String(100), nullable=True)
    model = Column(String(100), nullable=True)
    memory = Column(String(50), nullable=True)
    color = Column(String(50), nullable=True)
