import uuid
from sqlalchemy import Column, String, Integer, Boolean, Float
from sqlalchemy.dialects.postgresql import UUID
from config.database import Base

class ProductNode(Base):
    __tablename__ = "product_node"
    __table_args__ = {"schema": "warehouse"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(255), nullable=True, unique=True)
    product_model = Column(String(255), nullable=True)
    short_name = Column(String(255), nullable=True)
    color = Column(String(255), nullable=True)
    brand = Column(String(255), nullable=True)
    update = Column(Boolean, default=False)
    enabled = Column(Boolean, default=True)
