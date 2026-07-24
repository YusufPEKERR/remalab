# -*- coding: utf-8 -*-
import os

with open('old.jsx', 'r', encoding='utf-8') as f:
    old_content = f.read()

start_idx = old_content.find("{activeTab === 'barcode_search' && (")
if start_idx == -1:
    print('Could not find start in old.jsx')
    exit(1)

end_str = "{renderMaterialScanner()}\n          </div>\n        )}"
end_idx = old_content.find(end_str, start_idx)
if end_idx == -1:
    print('Could not find end in old.jsx')
    exit(1)

end_idx += len(end_str)
barcode_search_block = old_content[start_idx:end_idx]

tab_def = "{ key: 'barcode_search', label: 'Barkod Sorgula', icon: Scan }"

with open('frontend/src/pages/WorkOrders.jsx', 'r', encoding='utf-8') as f:
    current_content = f.read()

tab_target = "{ key: 'production_work_orders', label: 'Üretim İş Emirleri', icon: Layers },"
if tab_target not in current_content:
    print('Could not find tab target in current content')
    exit(1)
current_content = current_content.replace(
    tab_target,
    tab_target + '\n    ' + tab_def + ','
)

block_target = "{/* --- IMEI PARÇA TAKİP --- */}"
if block_target not in current_content:
    print('Could not find block target in current content')
    exit(1)

current_content = current_content.replace(
    block_target,
    "{/* --- BARKOD SORGULA --- */}\n        " + barcode_search_block + "\n\n        " + block_target
)

if "Scan," not in current_content[:current_content.find("from 'lucide-react'")]:
    current_content = current_content.replace("Search,", "Search, Scan,")

with open('frontend/src/pages/WorkOrders.jsx', 'w', encoding='utf-8') as f:
    f.write(current_content)

print('Successfully restored barcode_search tab!')
