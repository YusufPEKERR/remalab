import os
path = 'core/web_bridge.py'
with open(path, encoding='utf-8') as f:
    c = f.read()

old = 'return json.dumps({"success": True, "item_boms": result})'
new = 'open("DEBUG_BOMS.txt", "w", encoding="utf-8").write(json.dumps(result)); return json.dumps({"success": True, "item_boms": result})'

if old in c:
    c = c.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)
    print("Patched web_bridge.py")
else:
    print("Old string not found.")
