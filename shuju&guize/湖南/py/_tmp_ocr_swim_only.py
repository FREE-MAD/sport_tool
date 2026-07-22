import sys, csv, json, re
from pathlib import Path
import fitz
from rapidocr_onnxruntime import RapidOCR
from dataclasses import dataclass, field
from typing import Iterable

ROOT = Path(r'c:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南')
PDF = ROOT / '按目录切分_1-88' / '按节' / '03-04_第三章_第四节_游泳_印刷页038-084.pdf'
TMP_RENDER = ROOT / '_tmp_swim_render_ocr'
TMP_OUT = ROOT / '_tmp_swim_ocr_out'
TMP_RENDER.mkdir(parents=True, exist_ok=True)
TMP_OUT.mkdir(parents=True, exist_ok=True)

@dataclass
class OcrCell:
    x: float
    y: float
    text: str

@dataclass
class TableData:
    title: str
    rows: list[tuple[str, str]] = field(default_factory=list)

def clean_text(text: str) -> str:
    text = text.strip().replace(' ', '').replace('（', '(').replace('）', ')')
    text = text.replace('：', ':').replace('，', ',').replace('O', '0').replace('o', '0')
    return text

def is_numeric_like(text: str) -> bool:
    t = clean_text(text).replace('>', '').replace('<', '').replace('≤', '').replace('≥', '')
    if re.fullmatch(r'\d+(?::\d+(?:\.\d+)?)?', t): return True
    if re.fullmatch(r'\d+\.\d+', t): return True
    return False

def group_cells_to_lines(cells, y_tol=12.0):
    ordered = sorted(cells, key=lambda c: (c.y, c.x))
    groups = []
    for c in ordered:
        if not groups: groups.append([c]); continue
        avg_y = sum(item.y for item in groups[-1]) / len(groups[-1])
        if abs(c.y - avg_y) <= y_tol: groups[-1].append(c)
        else: groups.append([c])
    for g in groups: g.sort(key=lambda c: c.x)
    return groups

def row_to_pairs(cells):
    values = [clean_text(c.text) for c in cells if is_numeric_like(c.text)]
    if len(values) < 4 or len(values) % 2 != 0: return []
    return [(values[i], values[i+1]) for i in range(0, len(values), 2)]

current_table = None
ocr = RapidOCR()
doc = fitz.open(PDF)
tables = []
for idx in range(doc.page_count):
    page = doc.load_page(idx)
    img = TMP_RENDER / f'p{idx+1:03d}.png'
    page.get_pixmap(matrix=fitz.Matrix(2,2), alpha=False).save(img)
    result, _ = ocr(str(img))
    cells = []
    if result:
        for box, text, _ in result:
            x = sum(p[0] for p in box)/4
            y = sum(p[1] for p in box)/4
            cells.append(OcrCell(x=x, y=y, text=text))
    lines = group_cells_to_lines(cells)
    for line in lines:
        joined = ''.join(clean_text(c.text) for c in line)
        if re.search(r'游泳辅项成绩评分标准', joined) and '评分标准' in joined and '续表' not in joined:
            if current_table and current_table.rows: tables.append(current_table)
            current_table = TableData(title=clean_text(joined).replace('表', '').replace('10', '').replace('11', '').strip('（）()_- '))
            print(f'[新表] 第{idx+1}页: {current_table.title}')
            continue
        if current_table is None: continue
        pairs = row_to_pairs(line)
        if pairs:
            current_table.rows.extend(pairs)
if current_table and current_table.rows: tables.append(current_table)
doc.close()

for t in tables:
    print(f'\\n{t.title}: {len(t.rows)} pairs')
    print(f'  first: {t.rows[:3]}')
    print(f'  last: {t.rows[-3:]}')
    # Save to temp JSON
    out = TMP_OUT / f'{t.title}.json'
    with open(out, 'w', encoding='utf-8') as f:
        json.dump({'table_name': t.title, 'total': len(t.rows), 'rows': [{'score': s, 'value': v} for s, v in t.rows]}, f, ensure_ascii=False, indent=2)
    print(f'  saved: {out}')
