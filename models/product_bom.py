from sqlalchemy import Column, Integer, String
from config.database import Base

class ProductBOM(Base):
    __tablename__ = "product_boms"
    __table_args__ = {"schema": "warehouse"}

    id = Column(Integer, primary_key=True)
    product_model = Column(String(200), nullable=False)
    child_item_code = Column(String(100), nullable=False)
    quantity = Column(Integer, default=1)
