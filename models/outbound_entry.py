from sqlalchemy import Column, DateTime, Integer, String, text

from config.database import Base


class OutboundEntry(Base):
    __tablename__ = "outbound_entries"
    __table_args__ = {"schema": "warehouse"}

    id = Column(Integer, primary_key=True)
    part_id = Column(Integer)
    location_id = Column(Integer)
    quantity = Column(Integer, nullable=False)
    destination = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))
    created_by = Column(String(50), nullable=False)
