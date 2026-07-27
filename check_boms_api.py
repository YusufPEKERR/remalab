import sys
import os
sys.path.append(os.getcwd())
from core.web_bridge import WebBridge
bridge = WebBridge()
print(bridge.get_item_boms()[:200]) # just print the first 200 chars to avoid huge output
