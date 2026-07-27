import sys
import os
sys.path.append(os.getcwd())
from config.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
boms = db.execute(text("SELECT * FROM warehouse.item_bom")).mappings().all()
print("BOM count:", len(boms))
for b in boms:
    print(dict(b))
