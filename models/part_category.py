from sqlalchemy import Column, Integer, String

from config.database import Base


class PartCategory(Base):
    __tablename__ = "part_categories"
    __table_args__ = {"schema": "warehouse"}

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, unique=True)
