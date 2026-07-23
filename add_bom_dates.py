from config.database import engine
from sqlalchemy import text

def add_date_cols():
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE warehouse.product_boms ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;"))
            conn.execute(text("ALTER TABLE warehouse.product_boms ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;"))
            print("Successfully added date columns.")
        except Exception as e:
            print("Error:", e)

if __name__ == '__main__':
    add_date_cols()
