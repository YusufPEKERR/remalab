from sqlalchemy import Column, DateTime, Integer, Numeric, String, text

from config.database import Base


class InboundEntry(Base):
    __tablename__ = "inbound_entries"
    __table_args__ = {"schema": "warehouse"}

    id = Column(Integer, primary_key=True)
    part_id = Column(Integer)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)
    total_cost = Column(Numeric(12, 2), nullable=False)
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))
    created_by = Column(String(50), nullable=False)
