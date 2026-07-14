"""测试更低的DPI速度"""
from __future__ import annotations
import fitz, re, time
from pathlib import Path
from rapidocr_onnxruntime import RapidOCR

ROOT = Path(r"C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南")

def clean_text(text: str) -> str:
    text = text.strip().replace(" ", "").replace("（", "(").replace("）", ")")
    text = text.replace("：", ":").replace("，", ",").replace("O", "0").replace("o", "0")
    return text

def is_score_table_title(text: str) -> bool:
    t = clean_text(text)
    return "表" in t and "评分标准" in t and "续表" not in t

def is_continuation(text: str) -> bool:
    return clean_text(text).startswith("续表")

def is_numeric(text: str) -> bool:
    t = clean_text(text).replace(">", "").replace("<", "").replace("≤", "").replace("≥", "")
    if re.fullmatch(r"\d+(?::\d+(?:\.\d+)?)?", t): return True
    if re.fullmatch(r"\d+\.\d+", t): return True
    return False

for dpi in [1.0, 1.2]:
    pdf_path = ROOT / "按目录切分_1-88" / "按节" / "02-02_第二章_第二节_五米三向折回跑_印刷页009-014.pdf"
    doc = fitz.open(pdf_path)
    ocr = RapidOCR()
    
    t0 = time.time()
    tables = []
    cur_title = None
    cur_points = 0

    for idx in range(doc.page_count):
        page = doc.load_page(idx)
        pix = page.get_pixmap(matrix=fitz.Matrix(dpi, dpi), alpha=False)
        tmp = Path(f"_speed_test_{idx:03d}.png")
        pix.save(tmp)
        result, _ = ocr(str(tmp))
        tmp.unlink()
        if not result: continue

        cells = [(sum(pt[0] for pt in box) / 4, sum(pt[1] for pt in box) / 4, text) for box, text, _ in result]
        cells.sort(key=lambda c: (c[1], c[0]))
        lines = []
        for c in cells:
            if not lines: lines.append([c]); continue
            avg_y = sum(x[1] for x in lines[-1]) / len(lines[-1])
            if abs(c[1] - avg_y) <= 18: lines[-1].append(c)
            else: lines.append([c])

        for line in lines:
            line.sort(key=lambda c: c[0])
            joined = "".join(clean_text(c[2]) for c in line)
            if is_score_table_title(joined):
                if cur_title: tables.append({"title": cur_title, "points": cur_points})
                cur_title = clean_text(joined)
                cur_title = re.sub(r"^表\s*\d+", "", cur_title).strip("_- ")
                cur_points = 0
                continue
            if is_continuation(joined): continue
            if cur_title is None: continue
            vals = [clean_text(c[2]) for c in line if is_numeric(c[2])]
            if len(vals) >= 2: cur_points += len(vals) // 2

    if cur_title: tables.append({"title": cur_title, "points": cur_points})

    elapsed = time.time() - t0
    total = sum(t["points"] for t in tables)
    print(f"DPI={dpi}: {elapsed:.1f}s, {doc.page_count} pages, {total} points")
    print(f"  每页: {elapsed/doc.page_count:.1f}s, 预估88页: {elapsed/doc.page_count*83:.0f}s")
    for t in tables:
        print(f"    {t['title']}: {t['points']}")
    doc.close()
