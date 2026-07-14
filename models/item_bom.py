from sqlalchemy import Column, Integer, String

from config.database import Base

class ItemBOM(Base):
    __tablename__ = "item_bom"
    __table_args__ = {"schema": "warehouse"}

    id = Column(Integer, primary_key=True)
    parent_item_id = Column(String(100), nullable=False)
    child_item_id = Column(String(100), nullable=False)
    quantity = Column(Integer, default=1)
