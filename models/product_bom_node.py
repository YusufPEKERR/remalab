import uuid
from sqlalchemy import Column, String, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID
from config.database import Base

class ProductBomNode(Base):
    """Normalize edilmiş ProductBom"""
    __tablename__ = "product_bom_node"
    __table_args__ = {"schema": "warehouse"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parent_product_code = Column(String(255), nullable=False) # UretilenUrunKodu
    child_item_code = Column(String(255), nullable=False)     # Tuketilen Parca_X
    quantity = Column(Integer, default=1)                     # Tuketilen Parca_X_Miktar
    enabled = Column(Boolean, default=True)
    update = Column(Boolean, default=False)
