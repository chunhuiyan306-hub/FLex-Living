# -*- coding: utf-8 -*-
"""Parse 报价文件（无出厂价）.xlsx -> lib/catalog/xlsx-imported-products.ts"""
from __future__ import annotations

import hashlib
import re
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "lib" / "catalog" / "xlsx-imported-products.ts"
XLSX_DEFAULT = Path(r"c:\Users\21chy\Desktop\报价文件（无出厂价）.xlsx")

# ProductSystemCategory
SYSTEM_MAP = [
    ("内门", "door", "内门", "Interior doors"),
    ("移门执手", "door", "移门执手", "Sliding door hardware"),
    ("移门", "door", "移门", "Sliding doors"),
    ("导轨", "hardware", "导轨", "Tracks & hardware"),
    ("墙板", "wall_panel", "墙板", "Wall panels"),
    ("墙", "wall_panel", "墙面", "Wall paneling"),
    ("整木", "cabinet", "整木", "Solid wood / millwork"),
    ("木作", "cabinet", "木作", "Millwork"),
    ("收纳", "storage", "收纳", "Storage"),
    ("浴室", "kitchen", "浴室", "Bathroom"),
    ("浴室柜", "kitchen", "浴室柜", "Bathroom vanity"),
    ("厨房", "kitchen", "厨房", "Kitchen"),
    ("灵动", "cabinet", "灵动", "Motiva"),
    ("照明", "lighting", "照明", "Lighting"),
    ("灯光", "lighting", "灯光", "Lighting"),
    ("五金", "hardware", "五金", "Hardware"),
]


def detect_system(sheet_name: str) -> tuple[str, str, str]:
    for key, sys, czh, cen in SYSTEM_MAP:
        if key in sheet_name:
            return sys, czh, cen
    return "cabinet", "综合", "General"


def norm_unit(u: str | None) -> str:
    if not u:
        return "pc"
    u = str(u).strip()
    if u in ("套",):
        return "set"
    if u in ("平方", "㎡", "平方米", "平米"):
        return "sqm"
    if u in ("米", "延米", "M", "m"):
        return "lm"
    if u in ("扇",):
        return "leaf"
    if u in ("件", "个", "支", "根"):
        return "pc"
    return "pc"


def norm_grade(g: str | None) -> str | None:
    if not g:
        return None
    g = str(g).strip().upper().replace("＋", "+")
    if g in ("A+", "A", "B", "C", "D"):
        return g
    return None


def parse_interval(text: object) -> dict:
    """Best-effort mm bounds from Chinese spec text."""
    raw = "" if text is None else str(text).replace("\n", " ").strip()
    d: dict = {"labelZh": raw, "labelEn": raw[:120] if raw else "Band"}
    if not raw or raw == "/":
        return d
    t = raw.replace(" ", "")
    m = re.search(
        r"\((\d+)\s*≤?\s*高\s*≤?\s*(\d+)\)\s*\*\s*\((\d+)\s*≤?\s*宽\s*≤?\s*(\d+)\)",
        t,
    )
    if m:
        d["heightMinMm"] = int(m.group(1))
        d["heightMaxMm"] = int(m.group(2))
        d["widthMinMm"] = int(m.group(3))
        d["widthMaxMm"] = int(m.group(4))
        return d
    m = re.search(r"高\s*≤?\s*(\d+)", t)
    if m:
        d["heightMaxMm"] = int(m.group(1))
    m = re.search(r"宽\s*≤?\s*(\d+)", t)
    if m:
        d["widthMaxMm"] = int(m.group(1))
    m = re.search(r"墙厚\s*≤?\s*(\d+)", t)
    if m:
        d["depthMaxMm"] = int(m.group(1))
    m = re.search(r"（\s*(\d+)\s*≤?\s*高\s*≤?\s*(\d+)\s*）", t)
    if m and "heightMinMm" not in d:
        d["heightMinMm"] = int(m.group(1))
        d["heightMaxMm"] = int(m.group(2))
    m = re.search(r"（\s*(\d+)\s*≤?\s*宽\s*≤?\s*(\d+)\s*）", t)
    if m and "widthMinMm" not in d:
        d["widthMinMm"] = int(m.group(1))
        d["widthMaxMm"] = int(m.group(2))
    return d


def is_price(x) -> bool:
    if x is None:
        return False
    if isinstance(x, (int, float)):
        if isinstance(x, float) and (x != x):  # nan
            return False
        return x > 0
    s = str(x).strip()
    if s in ("#REF!", "#VALUE!", "-", ""):
        return False
    try:
        return float(s) > 0
    except ValueError:
        return False


def to_price(x) -> float:
    if isinstance(x, (int, float)):
        return float(x)
    return float(str(x).strip())


def find_header_row(ws):
    best_r = None
    best_map: dict[str, int] = {}
    for ri, row in enumerate(ws.iter_rows(max_row=40, values_only=True), start=1):
        cells = [str(c).strip() if c is not None else "" for c in row]
        if not any(cells):
            continue
        j = " | ".join(cells)
        if "建议" not in j:
            continue
        cmap: dict[str, int] = {}
        for i, h in enumerate(cells):
            if not h:
                continue
            if "产品" in h and "名称" in h:
                cmap["name"] = i
            elif h.endswith("型号") or h == "型号":
                cmap["model"] = i
            elif "规格" in h or "门洞" in h or "洞规" in h:
                cmap["spec"] = i
            elif "型材" in h:
                cmap["profile"] = i
            elif "饰面" in h or "玻璃" in h:
                cmap["finish"] = i
            elif "级别" in h or h == "等级":
                cmap["grade"] = i
            elif "单位" in h:
                cmap["unit"] = i
            elif "性质" in h:
                cmap["nature"] = i
            elif "建议" in h and "成交" in h:
                cmap["suggested"] = i
            elif "门店" in h or "统一" in h:
                cmap["retail"] = i
            elif "备注" in h:
                cmap["note"] = i
        if "suggested" in cmap and ("model" in cmap or "name" in cmap):
            best_r, best_map = ri, cmap
            break
    return best_r, best_map


def uid(*parts: str) -> str:
    h = hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:10]
    return f"x-{h}"


def fmt_num(x: float) -> str:
    if isinstance(x, float) and x == int(x):
        return str(int(x))
    return str(x)


def esc(s: str) -> str:
    return (
        s.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\n", "\\n")
        .replace("\r", "")
    )


def run(path: Path) -> None:
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    products: dict[str, dict] = {}

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        hdr_r, cmap = find_header_row(ws)
        if not hdr_r or "suggested" not in cmap:
            continue

        sys, cat_zh, cat_en = detect_system(sheet_name)
        prev_name = ""
        prev_model = ""
        prev_finish = ""
        prev_profile = ""

        rows_iter = ws.iter_rows(min_row=hdr_r + 1, values_only=True)
        for row in rows_iter:
            if not row:
                continue
            def gv(key: str, default=""):
                if key not in cmap:
                    return default
                i = cmap[key]
                if i >= len(row):
                    return default
                v = row[i]
                return default if v is None else v

            name = gv("name")
            if name:
                prev_name = str(name).strip()
            model = gv("model")
            if model:
                prev_model = str(model).strip().replace("\n", " ")
            finish = gv("finish")
            if finish and str(finish).strip() not in ("/", ""):
                prev_finish = str(finish).strip().replace("\n", "; ")
            profile = gv("profile")
            if profile and str(profile).strip() not in ("/", ""):
                prev_profile = str(profile).strip()

            spec = gv("spec")
            grade = norm_grade(gv("grade"))
            unit = norm_unit(gv("unit"))
            sug = gv("suggested")
            ret = gv("retail") if "retail" in cmap else None
            note = gv("note")
            if not is_price(sug):
                continue
            if not prev_model and not prev_name:
                continue

            p_sug = to_price(sug)
            p_ret = to_price(ret) if is_price(ret) else None

            prod_key = f"{sheet_name[:24]}|{prev_model}|{prev_name[:32]}"
            if prod_key not in products:
                pid = uid(sheet_name, prev_model, prev_name)
                products[prod_key] = {
                    "id": pid,
                    "sheet": sheet_name,
                    "system": sys,
                    "categoryZh": cat_zh,
                    "categoryEn": cat_en,
                    "productNameZh": prev_name or prev_model,
                    "productNameEn": prev_name or prev_model,
                    "model": prev_model or "—",
                    "defaultUnit": unit,
                    "exclusionZh": "",
                    "exclusionEn": "",
                    "notesZh": str(note).strip() if note else "",
                    "customRules": [],
                    "rows": [],
                }
            iv = parse_interval(spec)
            interval_id = uid(prod_key, str(spec), str(grade), str(p_sug))
            if not grade:
                grade = "A"
            row_id = uid(interval_id, grade, str(p_sug))
            desc_zh = prev_finish or prev_profile or "—"
            products[prod_key]["rows"].append(
                {
                    "id": row_id,
                    "intervalId": interval_id,
                    "interval": iv,
                    "grade": grade,
                    "finishZh": desc_zh[:200],
                    "finishEn": desc_zh[:200],
                    "unit": unit,
                    "suggested": p_sug,
                    "retail": p_ret,
                }
            )

    wb.close()

    # TypeScript emit
    lines = [
        '/**',
        f' * Auto-generated from: {path.name}',
        " * 建议成交价 -> rrpCnyPerUnit；全国统一门店价 -> nationalRetailCnyPerUnit",
        ' * Regenerate: `python scripts/xlsx_to_prices.py`',
        " */",
        "",
        'import type { PriceLibraryProduct, PriceLibraryRow } from "../domain/types";',
        "",
        "function R(",
        "  productId: string,",
        "  partial: Omit<PriceLibraryRow, \"productId\">,",
        "): PriceLibraryRow {",
        "  return { ...partial, productId };",
        "}",
        "",
        "export const XLSX_IMPORTED_PRODUCTS: PriceLibraryProduct[] = [",
    ]

    for pk, p in products.items():
        if not p["rows"]:
            continue
        ex_zh = esc(p["notesZh"][:500]) if p["notesZh"] else ""
        lines.append("  {")
        lines.append(f'    id: "{esc(p["id"])}",')
        lines.append(f'    system: "{p["system"]}",')
        lines.append(f'    categoryZh: "{esc(p["categoryZh"])}",')
        lines.append(f'    categoryEn: "{esc(p["categoryEn"])}",')
        lines.append(f'    productNameZh: "{esc(p["productNameZh"])}",')
        lines.append(f'    productNameEn: "{esc(str(p["productNameEn"])[:80])}",')
        lines.append(f'    model: "{esc(p["model"])}",')
        lines.append(f'    defaultPricingUnit: "{p["defaultUnit"]}",')
        lines.append("    customRules: [],")
        lines.append(f'    exclusionZh: "{ex_zh}",')
        lines.append(f'    exclusionEn: "",')
        if p["notesZh"]:
            lines.append(f'    notesZh: "{ex_zh}",')
        lines.append("    rows: [")
        for r in p["rows"]:
            iv = r["interval"]
            lines.append(f'      R("{esc(p["id"])}", {{')
            lines.append(f'        id: "{esc(r["id"])}",')
            lines.append("        interval: {")
            lines.append(f'          id: "{esc(r["intervalId"])}",')
            lines.append(f'          labelZh: "{esc(iv.get("labelZh", ""))}",')
            lines.append(f'          labelEn: "{esc(iv.get("labelEn", ""))}",')
            for k in (
                "heightMinMm",
                "heightMaxMm",
                "widthMinMm",
                "widthMaxMm",
                "depthMinMm",
                "depthMaxMm",
            ):
                if k in iv:
                    lines.append(f"          {k}: {iv[k]},")
            lines.append("        },")
            lines.append(f'        finishGrade: "{r["grade"]}",')
            lines.append(f'        finishDescriptionZh: "{esc(r["finishZh"])}",')
            lines.append(f'        finishDescriptionEn: "{esc(r["finishEn"])}",')
            lines.append(f'        pricingUnit: "{r["unit"]}",')
            lines.append(f"        rrpCnyPerUnit: {fmt_num(r['suggested'])},")
            if r["retail"]:
                lines.append(
                    f"        nationalRetailCnyPerUnit: {fmt_num(r['retail'])},"
                )
            lines.append("      }),")
        lines.append("    ],")
        lines.append("  },")

    lines.append("];")
    lines.append("")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUT} ({len(products)} products)")


if __name__ == "__main__":
    p = Path(sys.argv[1]) if len(sys.argv) > 1 else XLSX_DEFAULT
    if not p.exists():
        print("Missing xlsx:", p, file=sys.stderr)
        sys.exit(1)
    run(p)
