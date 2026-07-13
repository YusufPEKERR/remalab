import os
import re

files = [
    'core/web_bridge.py',
    'frontend/src/layouts/MainLayout.jsx',
    'frontend/src/pages/Irsaliye.jsx',
    'frontend/src/pages/Parts.jsx',
    'frontend/src/pages/Raporlar.jsx',
    'frontend/src/services/api.js'
]

def resolve_file(filepath):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    pattern = re.compile(r'<<<<<<< Updated upstream\n(.*?)=======\n(.*?)>>>>>>> Stashed changes\n', re.DOTALL)
    
    new_content = pattern.sub(r'\1\2', content)
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Resolved {filepath}")
    else:
        print(f"No conflicts found or regex failed in {filepath}")

for f in files:
    resolve_file(f)
