from sqlalchemy import Column, Integer, String, Boolean

from config.database import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "warehouse"}

    id = Column(Integer, primary_key=True)
    username = Column(String(100), unique=True, nullable=False)
    tc_no = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="Teknisyen")
    gorev = Column(String(100), nullable=True)
    fullname = Column(String(150), nullable=True)
    account_enabled = Column(Boolean, nullable=False, default=True)
    team_leader = Column(String(150), nullable=True)
    operation_manager = Column(String(150), nullable=True)
    administrative_manager = Column(String(150), nullable=True)
