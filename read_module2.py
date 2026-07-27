"""
MioCreate.xlsx - Modül 2 sekmelerini okur: Item, ItemCategory, ItemBom, Product,
ProductModel, ProductFamily, ProductBom, ItemLabour, ItemFault, Symptom, ItemSupplyStatu.
Basliklar 3. satirda (index=2).
"""
import pandas as pd
import sys, math

EXCEL_FILE = "MioCreate.xlsx"
TARGET_SHEETS = [
    "ItemType",
    "ItemCategory",
    "ItemLabour",
    "ItemFault",
    "Symptom",
    "ItemSupplyStatu",
    "Item",
    "ItemBom",
    "ProductFamily",
    "ProductCategory",
    "Brand",
    "ProductModel",
    "Product",
    "ProductBom",
    "ItemCategoryMission",
]

def read_sheet(fp, name):
    try:
        df_meta = pd.read_excel(fp, sheet_name=name, header=None, nrows=3)
        meta = df_meta.values.tolist()
        df = pd.read_excel(fp, sheet_name=name, header=2)
        df = df.where(pd.notnull(df), None)
        return {
            "sheet": name,
            "meta1": [str(x) if x is not None and str(x)!='nan' else '' for x in meta[0]],
            "meta2": [str(x) if x is not None and str(x)!='nan' else '' for x in meta[1]],
            "cols": list(df.columns),
            "dtypes": {c: str(d) for c,d in df.dtypes.items()},
            "count": len(df),
            "data": df.head(30).to_dict(orient="records"),
        }
    except Exception as e:
        return {"sheet": name, "error": str(e)}

xls = pd.ExcelFile(EXCEL_FILE)
for s in TARGET_SHEETS:
    if s not in xls.sheet_names:
        print(f"[MISSING] {s}")
        continue
    r = read_sheet(EXCEL_FILE, s)
    if "error" in r:
        print(f"[ERROR] {r['sheet']}: {r['error']}")
        continue
    print(f"\n{'='*80}")
    print(f"SHEET: {r['sheet']}  ({r['count']} rows)")
    print(f"META1: {r['meta1']}")
    print(f"META2: {r['meta2']}")
    print(f"COLS: {r['cols']}")
    print(f"DTYPES: {r['dtypes']}")
    for i, row in enumerate(r['data']):
        clean = {k:v for k,v in row.items() if v is not None}
        print(f"  [{i}] {clean}")
