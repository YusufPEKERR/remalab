from sqlalchemy import Column, DateTime, Integer, String, text

from config.database import Base


class StockMovement(Base):
    __tablename__ = "stock_movements"
    __table_args__ = {"schema": "warehouse"}

    id = Column(Integer, primary_key=True)
    type = Column(String(50), nullable=False)
    quantity = Column(Integer, nullable=False)
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))
