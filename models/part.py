from sqlalchemy import Column, Integer, String

from config.database import Base


class Part(Base):
    __tablename__ = "parts"
    __table_args__ = {"schema": "warehouse"}

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    barcode = Column(String(100), nullable=True)
    critical_limit = Column(Integer, default=10)
    
    # Yeni eklenen sütunlar (Tedarikçi ve Ürün Listesi için)
    supplier = Column(String(255), nullable=True)
    brand = Column(String(100), nullable=True)
    model = Column(String(100), nullable=True)
    item_code = Column(String(100), nullable=True)
    memory = Column(String(50), nullable=True)
    color = Column(String(50), nullable=True)
    stock_tracking_type = Column(String(20), default="Stok Takipli", nullable=True)
    department = Column(String(255), nullable=True)
    status = Column(String(20), default="Aktif", nullable=True)
    part_category_id = Column(Integer, nullable=True)
    part_type = Column(String(100), nullable=True)
