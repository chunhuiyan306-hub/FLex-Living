import json
import openpyxl

path = r"c:\Users\21chy\Desktop\报价文件（无出厂价）.xlsx"
wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
print("sheets:", json.dumps(wb.sheetnames, ensure_ascii=False))
for name in wb.sheetnames[:15]:
    ws = wb[name]
    rows = list(ws.iter_rows(max_row=8, values_only=True))
    print("\n===", name, "===")
    for r in rows:
        print(r)
wb.close()
