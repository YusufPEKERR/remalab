from config.database import engine
from sqlalchemy import text

def add_col():
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE warehouse.product_boms ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Aktif';"))
            print("Successfully added status column.")
        except Exception as e:
            print("Error:", e)

if __name__ == '__main__':
    add_col()
