from sqlalchemy import Column, Integer, String

from config.database import Base


class Location(Base):
    __tablename__ = "locations"
    __table_args__ = {"schema": "warehouse"}

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    kind = Column(String(20), nullable=True)
    description = Column(String(255), nullable=True)
