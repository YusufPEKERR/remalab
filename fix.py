import sys, os
with open('core/web_bridge.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
for l in lines:
    if 'source_name = sloc.name if sloc else None' in l:
        new_lines.append('                source_name = sloc.name if sloc else None\n')
        continue
    if 'target_name = tloc.name if tloc else None' in l:
        new_lines.append('                target_name = tloc.name if tloc else None\n')
        new_lines.append('                \n')
        new_lines.append('                if not source_name:\n')
        new_lines.append('                    if "İade" in mov.type and "İptal" not in mov.type:\n')
        new_lines.append('                        source_name = "Good Stock"\n')
        new_lines.append('                    elif "İptali" in mov.type:\n')
        new_lines.append('                        source_name = "Good Stock"\n')
        new_lines.append('                    elif mov.type == "Giriş":\n')
        new_lines.append('                        source_name = "Dış Kaynak"\n')
        new_lines.append('                    else:\n')
        new_lines.append('                        source_name = "Bilinmiyor"\n')
        new_lines.append('                        \n')
        new_lines.append('                if not target_name:\n')
        new_lines.append('                    if "Çıkış" in mov.type or "Tüketimi" in mov.type or ("İptal" in mov.type and "İptali" not in mov.type):\n')
        new_lines.append('                        target_name = "Kullanım/Tüketim"\n')
        new_lines.append('                    elif mov.type == "Çıkış":\n')
        new_lines.append('                        target_name = "Dış Kaynak"\n')
        new_lines.append('                    else:\n')
        new_lines.append('                        target_name = "Bilinmiyor"\n')
        skip = True
        continue
    
    if skip:
        if 'res.append({' in l:
            skip = False
            new_lines.append(l)
        continue
    
    new_lines.append(l)

with open('core/web_bridge.py', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print('Done!')
