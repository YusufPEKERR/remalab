from sqlalchemy import Column, Integer, String

from config.database import Base


class Part(Base):
    __tablename__ = "parts"
    __table_args__ = {"schema": "warehouse"}

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    barcode = Column(String(100), nullable=True)
    critical_limit = Column(Integer, default=10)
