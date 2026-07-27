import os
import pandas as pd

EXCEL_FILE = "MioCreate.xlsx"
sheets = [
    "RepairResultType",
    "RepairItemOperationType",
    "RepairItemWarranty",
    "ItemCategoryMission",
    "ProductFamilyMission"
]

with open("module4_output.txt", "w", encoding="utf-8") as out:
    xls = pd.ExcelFile(EXCEL_FILE)
    for sheet in sheets:
        if sheet not in xls.sheet_names:
            out.write(f"Sheet {sheet} not found in Excel!\n")
            continue
        out.write(f"--- SHEET: {sheet} ---\n")
        df = pd.read_excel(EXCEL_FILE, sheet_name=sheet, header=2)
        out.write("HEADERS:\n")
        out.write(str(list(df.columns)) + "\n")
        out.write("DATA (First 3 rows):\n")
        for i, row in df.head(3).iterrows():
            out.write(str(row.to_dict()) + "\n")
        out.write("\n" + "="*50 + "\n\n")

print("Done reading Module 4 data.")
