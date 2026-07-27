"""
RemaLab WMS - Index Migration
Adds B-Tree indexes to the warehouse.item table to solve timeout issues on 30k+ rows.
"""
import os
import sys
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.database import get_engine

def apply_indexes():
    print("Applying indexes to 'warehouse.item' table...")
    engine = get_engine()
    
    # We use raw SQL because adding indexes conditionally via SQLAlchemy metadata can be tricky without Alembic
    indexes_sql = [
        "CREATE INDEX IF NOT EXISTS idx_item_code ON warehouse.item (code);",
        "CREATE INDEX IF NOT EXISTS idx_item_short_name ON warehouse.item (short_name);",
        "CREATE INDEX IF NOT EXISTS idx_item_category ON warehouse.item (item_category);"
    ]
    
    try:
        with engine.begin() as conn:
            for sql in indexes_sql:
                conn.execute(text(sql))
                print(f"Executed: {sql}")
        print("Indexes applied successfully!")
    except Exception as e:
        print(f"Error applying indexes: {e}")

if __name__ == "__main__":
    apply_indexes()
