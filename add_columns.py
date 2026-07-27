import sys, os
from sqlalchemy import text
from config.database import SessionLocal

db = SessionLocal()
try:
    db.execute(text("ALTER TABLE warehouse.parts ADD COLUMN part_type VARCHAR(100) DEFAULT 'Stoklu Parça';"))
    db.commit()
    print("Added part_type to parts")
except Exception as e:
    db.rollback()
    print("Error parts:", e)
db.close()
