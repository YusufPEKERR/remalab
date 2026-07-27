import sys
import json
sys.path.append('.')
from config.database import SessionLocal
from sqlalchemy import text
from core.web_bridge import WebBridge

bridge = WebBridge()
res = json.loads(bridge.get_item_boms())
boms = res.get("item_boms", [])
found = [b for b in boms if b.get("parent_item_id") == "iP17WAn"]
print("FOUND in get_item_boms:", found)
