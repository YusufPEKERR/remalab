from sqlalchemy import Column, Integer, String, DateTime, text

from config.database import Base

class ProductBOM(Base):
    __tablename__ = "product_boms"
    __table_args__ = {"schema": "warehouse"}

    id = Column(Integer, primary_key=True)
    product_model = Column(String(200), nullable=False)
    child_item_code = Column(String(100), nullable=False)
    quantity = Column(Integer, default=1)
    status = Column(String(20), default="Aktif")
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"), onupdate=text("CURRENT_TIMESTAMP"))
