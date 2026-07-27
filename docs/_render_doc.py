# -*- coding: utf-8 -*-
"""SISTEM_DOKUMANTASYONU.md -> tek dosyalik, sik HTML uretir."""
import os
import markdown

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "SISTEM_DOKUMANTASYONU.md")
OUT = os.path.join(HERE, "SISTEM_DOKUMANTASYONU.html")

with open(SRC, encoding="utf-8") as f:
    text = f.read()

body = markdown.markdown(
    text,
    extensions=["tables", "fenced_code", "toc", "sane_lists", "attr_list"],
    extension_configs={"toc": {"permalink": "#"}},
)

HTML = """<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>RemaLab WMS — Sistem Dökümantasyonu</title>
<style>
  :root {{
    --bg:#0f1219; --panel:#161b26; --panel2:#1c2230; --text:#e6e9ef; --muted:#9aa4b2;
    --border:#2a3242; --accent:#4c8dff; --accent2:#7c5cff; --code:#0b0e14; --th:#212b36;
    --green:#3ddc84; --warn:#ffb454;
  }}
  * {{ box-sizing:border-box; }}
  html {{ scroll-behavior:smooth; }}
  body {{ margin:0; background:var(--bg); color:var(--text);
    font:16px/1.7 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; }}
  .wrap {{ max-width:1080px; margin:0 auto; padding:48px 28px 120px; }}
  h1,h2,h3,h4 {{ line-height:1.25; font-weight:700; scroll-margin-top:20px; }}
  h1 {{ font-size:2.1rem; margin:.2em 0 .6em;
    background:linear-gradient(90deg,var(--accent),var(--accent2));
    -webkit-background-clip:text; background-clip:text; color:transparent; }}
  h2 {{ font-size:1.5rem; margin-top:2.2em; padding-bottom:.35em; border-bottom:1px solid var(--border); }}
  h3 {{ font-size:1.2rem; margin-top:1.8em; color:#cdd6e4; }}
  h4 {{ font-size:1.03rem; margin-top:1.4em; color:#cdd6e4; }}
  a {{ color:var(--accent); text-decoration:none; }}
  a:hover {{ text-decoration:underline; }}
  p, li {{ color:var(--text); }}
  blockquote {{ margin:1.2em 0; padding:.6em 1.1em; border-left:4px solid var(--accent);
    background:var(--panel); border-radius:0 8px 8px 0; color:#c9d2df; }}
  blockquote p {{ margin:.4em 0; }}
  code {{ font-family:"JetBrains Mono",Consolas,Menlo,monospace; font-size:.88em;
    background:var(--panel2); padding:.15em .45em; border-radius:5px; color:#ffd9a0; }}
  pre {{ background:var(--code); border:1px solid var(--border); border-radius:10px;
    padding:16px 18px; overflow-x:auto; }}
  pre code {{ background:none; padding:0; color:#c8e1ff; font-size:.85em; line-height:1.6; }}
  table {{ border-collapse:collapse; width:100%; margin:1.2em 0; font-size:.92rem;
    display:block; overflow-x:auto; }}
  th,td {{ border:1px solid var(--border); padding:9px 12px; text-align:left; vertical-align:top; }}
  th {{ background:var(--th); color:#fff; font-weight:600; white-space:nowrap; }}
  tr:nth-child(even) td {{ background:var(--panel); }}
  tr:hover td {{ background:var(--panel2); }}
  hr {{ border:none; border-top:1px solid var(--border); margin:2.6em 0; }}
  ul,ol {{ padding-left:1.4em; }}
  li {{ margin:.25em 0; }}
  .headerbar {{ display:flex; align-items:center; gap:14px; margin-bottom:8px; }}
  .badge {{ display:inline-block; font-size:.72rem; letter-spacing:.08em; text-transform:uppercase;
    background:var(--panel2); color:var(--muted); border:1px solid var(--border);
    padding:4px 10px; border-radius:999px; }}
  .toc {{ background:var(--panel); border:1px solid var(--border); border-radius:12px;
    padding:14px 20px; margin:1.4em 0 2.4em; }}
  .toc > ul {{ margin:.3em 0; }}
  .toc .toctitle {{ font-weight:700; color:#fff; font-size:1rem; }}
  ::selection {{ background:rgba(76,141,255,.35); }}
  .headerlink {{ opacity:0; margin-left:.4em; font-size:.8em; }}
  h2:hover .headerlink, h3:hover .headerlink {{ opacity:.6; }}
</style>
</head>
<body>
<div class="wrap">
  <div class="headerbar">
    <span class="badge">RemaLab WMS</span>
    <span class="badge">Sistem Dökümantasyonu</span>
  </div>
  {body}
</div>
</body>
</html>
""".format(body=body)

with open(OUT, "w", encoding="utf-8") as f:
    f.write(HTML)

print(OUT)
