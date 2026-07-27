from sqlalchemy import Column, Integer

from config.database import Base


class Stock(Base):
    __tablename__ = "stock"
    __table_args__ = {"schema": "warehouse"}

    id = Column(Integer, primary_key=True)
    part_id = Column(Integer)
    location_id = Column(Integer)
    quantity = Column(Integer, nullable=False, default=0)
