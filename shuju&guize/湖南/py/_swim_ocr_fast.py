"""
Fast OCR-only re-extract of swimming tables using pre-rendered PNGs.
Skips the render step entirely - processes ~47 pages in ~5 min.
"""
import json, csv, re, sys, time
from pathlib import Path
from dataclasses import dataclass, field
from rapidocr_onnxruntime import RapidOCR

ROOT = Path(r'c:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南')
RENDER_DIR = ROOT / 'OCR可编辑分章Word' / '结构化导出' / '_rendered_pages' / '03-04_第三章_第四节_游泳_印刷页038-084'
OUTPUT_ROOT = ROOT / 'OCR可编辑分章Word' / '结构化导出'
SWIM_SECTION_ID = '03-04'

@dataclass
class OcrCell:
    x: float; y: float; text: str

@dataclass
class TableData:
    title: str
    section_id: str
    table_index: int
    rows: list[tuple[str, str]] = field(default_factory=list)

def clean_text(text: str) -> str:
    text = text.strip().replace(' ','').replace('（','(').replace('）',')')
    text = text.replace('：',':').replace('，',',').replace('O','0').replace('o','0')
    return text

def is_numeric_like(text: str) -> bool:
    t = clean_text(text).replace('>','').replace('<','').replace('≤','').replace('≥','')
    if re.fullmatch(r'\d+(?::\d+(?:\.\d+)?)?', t): return True
    if re.fullmatch(r'\d+\.\d+', t): return True
    return False

def normalize_score(text: str) -> str:
    text = clean_text(text).replace('>','').replace('<','').replace('≤','').replace('≥','')
    if ":" in text and "." not in text: text = text.replace(":", ".")
    return text

def normalize_value(text: str) -> str:
    text = clean_text(text).replace('>','').replace('<','').replace('≤','').replace('≥','')
    return text

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
    return [(normalize_score(values[i]), normalize_value(values[i+1])) for i in range(0, len(values), 2)]

def value_sort_key(text: str):
    text = normalize_value(text)
    if ":" in text:
        parts = text.split(":")
        if len(parts) == 2: return (0, int(parts[0])*60 + float(parts[1]))
    return (1, float(text))

def score_sort_key(text: str):
    return float(normalize_score(text))

def is_new_table_title(text: str) -> bool:
    text = clean_text(text)
    return bool(re.match(r"^表\d+", text)) and "评分标准" in text and "续表" not in text

def is_continuation_title(text: str) -> bool:
    return bool(re.match(r"^续表\d+", clean_text(text)))

def sanitize_filename(name: str) -> str:
    return re.sub(r'[<>:"/\\|?*]', "_", name)

def detect_gender(title: str) -> str:
    if "男子" in title or "男" in title: return "m"
    if "女子" in title or "女" in title: return "f"
    return "o"

def clean_title(text: str) -> str:
    text = clean_text(text)
    text = re.sub(r"^表\s*\d+", "", text)
    text = re.sub(r"^续表\s*\d+", "", text)
    return text.strip("_- ")

# === Main ===
ocr = RapidOCR()
png_files = sorted(RENDER_DIR.glob("page_*.png"))
print(f"Total pages to OCR: {len(png_files)}")

tables: list[TableData] = []
current_table: TableData | None = None
table_index = 0
t0 = time.time()

for idx, png_path in enumerate(png_files, start=1):
    result, _ = ocr(str(png_path))
    cells = []
    if result:
        for box, text, _score in result:
            x = sum(p[0] for p in box)/4
            y = sum(p[1] for p in box)/4
            cells.append(OcrCell(x=x, y=y, text=text))
    lines = group_cells_to_lines(cells)
    
    for line in lines:
        joined = ''.join(clean_text(c.text) for c in line)
        if is_new_table_title(joined):
            if current_table and current_table.rows:
                tables.append(current_table)
            table_index += 1
            current_table = TableData(
                title=clean_title(joined),
                section_id=SWIM_SECTION_ID,
                table_index=table_index,
            )
            print(f"  [{idx:03d}] NEW TABLE: {current_table.title}")
            continue
        if is_continuation_title(joined):
            continue
        if not current_table:
            continue
        pairs = row_to_pairs(line)
        if pairs:
            current_table.rows.extend(pairs)
    
    elapsed = time.time() - t0
    rate = idx / elapsed if elapsed > 0 else 0
    eta = (len(png_files) - idx) / rate if rate > 0 else 0
    print(f"  [{idx:03d}/{len(png_files)}] {elapsed:.0f}s elapsed, ~{rate:.2f} p/s, ETA {eta:.0f}s", flush=True)

if current_table and current_table.rows:
    tables.append(current_table)

print(f"\n=== Extracted {len(tables)} table(s) ===")

# Finalize and save
for table in tables:
    # Dedup
    dedup = {}
    unique = []
    for row in table.rows:
        if row not in dedup:
            dedup[row] = None
            unique.append(row)
    
    # Sort by value ascending
    sorted_rows = sorted(unique, key=lambda row: (value_sort_key(row[1]), -score_sort_key(row[0])))
    max_row = max(sorted_rows, key=lambda r: score_sort_key(r[0]))
    min_row = min(sorted_rows, key=lambda r: score_sort_key(r[0]))
    gender = detect_gender(table.title)
    code = f"hunan_2023_{table.section_id}_{gender}_{table.table_index:03d}"
    
    data = [{"score": s, "value": v, "number": str(i)} for i, (s, v) in enumerate(sorted_rows, start=1)]
    
    payload = {
        "code": {
            "table_name": table.title,
            "headers": ["score", "value"],
            "code": code,
            "max_value": max_row[1],
            "min_value": min_row[1],
            "total": str(len(sorted_rows)),
            "data": data,
        }
    }
    
    # Save CSV
    csv_dir = OUTPUT_ROOT / 'csv'
    csv_dir.mkdir(parents=True, exist_ok=True)
    file_stem = sanitize_filename(f"{code}_{table.title}")
    with (csv_dir / f"{file_stem}.csv").open('w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['sequence_number', 'score', 'value'])
        writer.writeheader()
        for row in data:
            writer.writerow({'sequence_number': row['number'], 'score': row['score'], 'value': row['value']})
    
    # Save JSON
    json_dir = OUTPUT_ROOT / 'json'
    json_dir.mkdir(parents=True, exist_ok=True)
    with (json_dir / f"{file_stem}.json").open('w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    
    print(f"\n{table.title}:")
    print(f"  total: {len(sorted_rows)}")
    print(f"  first 3: {sorted_rows[:3]}")
    print(f"  last 3:  {sorted_rows[-3:]}")
    print(f"  code: {code}")
    print(f"  file: {file_stem}")

# Rebuild JSONL
jsonl_path = OUTPUT_ROOT / 'all_tables.jsonl'
all_jsons = sorted((OUTPUT_ROOT / 'json').glob('*.json'))
print(f"\nRebuilding all_tables.jsonl from {len(all_jsons)} JSON files...")
with jsonl_path.open('w', encoding='utf-8') as f:
    for jp in all_jsons:
        f.write(jp.read_text(encoding='utf-8').strip() + '\n')
print("Done!")
