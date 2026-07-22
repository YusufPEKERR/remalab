import sys
import os
from sqlalchemy import text

# Add current directory to path so config is importable
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config.database import get_engine

def add_imei_column():
    engine = get_engine()
    with engine.connect() as conn:
        try:
            # Check if column exists
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'warehouse' 
                  AND table_name = 'service_records' 
                  AND column_name = 'imei_number';
            """))
            if not result.fetchone():
                print("Adding imei_number column...")
                conn.execute(text("ALTER TABLE warehouse.service_records ADD COLUMN imei_number VARCHAR(100);"))
                conn.commit()
                print("Column added successfully!")
            else:
                print("Column already exists.")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    add_imei_column()
