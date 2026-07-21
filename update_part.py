import sys
import json
sys.path.append('.')
from config.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
sql = "UPDATE warehouse.parts SET part_category = 'Yarı Mamül' WHERE item_code = 'iP17WAn'"
db.execute(text(sql))
db.commit()
db.close()
