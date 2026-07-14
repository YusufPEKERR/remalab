from sqlalchemy import Column, DateTime, Integer, Numeric, String, text

from config.database import Base


class StockMovement(Base):
    __tablename__ = "stock_movements"
    __table_args__ = {"schema": "warehouse"}

    id = Column(Integer, primary_key=True)
    type = Column(String(50), nullable=False)
    movement_kind = Column(String(20), nullable=True)
    quantity = Column(Integer, nullable=False)
    part_id = Column(Integer, nullable=True)
    source_location_id = Column(Integer, nullable=True)
    target_location_id = Column(Integer, nullable=True)
    created_by = Column(String(100), nullable=True)
    technician = Column(String(150), nullable=True)
    description = Column(String, nullable=True)
    unit_price = Column(Numeric(12, 2), nullable=True)
    total_cost = Column(Numeric(12, 2), nullable=True)
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))
