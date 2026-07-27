from typing import Generator
from sqlalchemy.orm import Session
from config.database import SessionLocal

def get_db_session() -> Generator[Session, None, None]:
    """FastAPI Dependency for database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
