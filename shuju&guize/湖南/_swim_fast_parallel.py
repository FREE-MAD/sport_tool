"""
Fast OCR swimming extraction: 1x DPI + multiprocessing.
Mirrors count_scoring_points.py's efficient approach.
Outputs proper CSV/JSON to replace the garbage files.
"""
from __future__ import annotations

import csv, json, re, sys, time, shutil
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor, as_completed

ROOT = Path(r'c:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南')
PDF_PATH = ROOT / '按目录切分_1-88' / '按节' / '03-04_第三章_第四节_游泳_印刷页038-084.pdf'
OUTPUT_ROOT = ROOT / 'OCR可编辑分章Word' / '结构化导出'
TEMP_ROOT = ROOT / '_temp_swim_extract'
SWIM_SECTION_ID = '03-04'

# Split 47 pages into batches for parallel processing
TOTAL_PAGES = 47
NUM_WORKERS = 6
BATCH_SIZE = max(1, TOTAL_PAGES // NUM_WORKERS)


def clean_text(text: str) -> str:
    text = text.strip().replace(" ", "").replace("（", "(").replace("）", ")")
    text = text.replace("：", ":").replace("，", ",").replace("O", "0").replace("o", "0")
    return text


def is_numeric(text: str) -> bool:
    t = clean_text(text).replace(">", "").replace("<", "")
    t = t.replace("≤", "").replace("≥", "")
    if re.fullmatch(r"\d+(?::\d+(?:\.\d+)?)?", t):
        return True
    if re.fullmatch(r"\d+\.\d+", t):
        return True
    return False


def normalize_score(text: str) -> str:
    text = clean_text(text).replace(">", "").replace("<", "")
    text = text.replace("≤", "").replace("≥", "")
    if ":" in text and "." not in text:
        text = text.replace(":", ".")
    return text


def normalize_value(text: str) -> str:
    text = clean_text(text).replace(">", "").replace("<", "")
    text = text.replace("≤", "").replace("≥", "")
    return text


def is_new_table_title(text: str) -> bool:
    t = clean_text(text)
    return "表" in t and "评分标准" in t and "续表" not in t


def is_continuation(text: str) -> bool:
    return clean_text(text).startswith("续表")


def clean_title(text: str) -> str:
    text = clean_text(text)
    text = re.sub(r"^表\s*\d+", "", text)
    text = re.sub(r"^续表\s*\d+", "", text)
    return text.strip("_- ")


def detect_gender(title: str) -> str:
    if "男子" in title or "男" in title:
        return "m"
    if "女子" in title or "女" in title:
        return "f"
    return "o"


def value_sort_key(text: str):
    text = normalize_value(text)
    if ":" in text:
        parts = text.split(":")
        if len(parts) == 2:
            return (0, int(parts[0]) * 60 + float(parts[1]))
    return (1, float(text))


def score_sort_key(text: str):
    return float(normalize_score(text))


def sanitize_filename(name: str) -> str:
    return re.sub(r'[<>:"/\\|?*]', "_", name)


def process_page_range(args: tuple) -> list[dict]:
    """Process a range of pages in a subprocess. Returns list of (page, line_data) events."""
    pdf_path_str, start_page, end_page, temp_dir = args

    import fitz
    from rapidocr_onnxruntime import RapidOCR

    pdf_path = Path(pdf_path_str)
    temp_dir = Path(temp_dir)
    temp_dir.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(pdf_path)
    ocr = RapidOCR()
    
    events: list[dict] = []  # title events or data events
    
    for idx in range(start_page, end_page):
        page = doc.load_page(idx)
        # 1x DPI - fast!
        pix = page.get_pixmap(matrix=fitz.Matrix(1.0, 1.0), alpha=False)
        tmp = temp_dir / f"pg_{idx:03d}.png"
        pix.save(tmp)
        
        result, _ = ocr(str(tmp))
        tmp.unlink()  # clean up immediately

        if not result:
            continue

        cells = []
        for box, text, _score in result:
            x = sum(pt[0] for pt in box) / 4
            y = sum(pt[1] for pt in box) / 4
            cells.append((x, y, text))

        cells.sort(key=lambda c: (c[1], c[0]))
        lines_data = []
        for c in cells:
            if not lines_data:
                lines_data.append([c])
                continue
            avg_y = sum(xx[1] for xx in lines_data[-1]) / len(lines_data[-1])
            if abs(c[1] - avg_y) <= 18:
                lines_data[-1].append(c)
            else:
                lines_data.append([c])

        for line in lines_data:
            line.sort(key=lambda c: c[0])
            joined = "".join(clean_text(c[2]) for c in line)

            if is_new_table_title(joined):
                events.append({"type": "new_table", "title": clean_title(joined), "page": idx + 1})
                continue

            if is_continuation(joined):
                events.append({"type": "continue", "page": idx + 1})
                continue

            vals = [clean_text(c[2]) for c in line if is_numeric(c[2])]
            if len(vals) >= 4 and len(vals) % 2 == 0:
                pairs = [(normalize_score(vals[i]), normalize_value(vals[i + 1])) for i in range(0, len(vals), 2)]
                events.append({"type": "data", "pairs": pairs, "page": idx + 1})

    doc.close()
    return events


def main():
    t0 = time.time()
    TEMP_ROOT.mkdir(parents=True, exist_ok=True)

    # Create batches
    batches = []
    for i in range(0, TOTAL_PAGES, BATCH_SIZE):
        end = min(i + BATCH_SIZE, TOTAL_PAGES)
        temp_dir = TEMP_ROOT / f"batch_{i:03d}_{end:03d}"
        batches.append((str(PDF_PATH), i, end, str(temp_dir)))

    print(f"Total pages: {TOTAL_PAGES}, workers: {NUM_WORKERS}, batches: {len(batches)}")
    print(f"Batch sizes: {[(b[1], b[2]) for b in batches]}")
    sys.stdout.flush()

    # Parallel processing
    all_events: list[dict] = []
    with ProcessPoolExecutor(max_workers=NUM_WORKERS) as executor:
        future_to_batch = {executor.submit(process_page_range, b): b for b in batches}
        for future in as_completed(future_to_batch):
            b = future_to_batch[future]
            try:
                events = future.result()
                all_events.extend(events)
                elapsed = time.time() - t0
                print(f"  Batch {b[1]}-{b[2]}: {len(events)} events ({elapsed:.0f}s)")
                sys.stdout.flush()
            except Exception as e:
                print(f"  Batch {b[1]}-{b[2]} ERROR: {e}")
                sys.stdout.flush()

    # Sort events by page number
    all_events.sort(key=lambda e: e.get("page", 0))

    # Reconstruct tables from events
    tables: list[dict] = []
    current_title = None
    current_rows: list[tuple[str, str]] = []
    table_index = 0

    for event in all_events:
        if event["type"] == "new_table":
            if current_title is not None and current_rows:
                tables.append({"title": current_title, "rows": current_rows})
            table_index += 1
            current_title = event["title"]
            current_rows = []
        elif event["type"] == "data":
            if current_title is not None:
                current_rows.extend(event["pairs"])

    if current_title is not None and current_rows:
        tables.append({"title": current_title, "rows": current_rows})

    print(f"\n=== Results ({len(tables)} tables) ===")

    # Finalize and save
    for i, table in enumerate(tables, start=1):
        # Dedup
        dedup: dict = {}
        unique: list = []
        for row in table["rows"]:
            if row not in dedup:
                dedup[row] = None
                unique.append(row)

        # Sort by value ascending
        sorted_rows = sorted(unique, key=lambda row: (value_sort_key(row[1]), -score_sort_key(row[0])))
        max_row = max(sorted_rows, key=lambda row: score_sort_key(row[0]))
        min_row = min(sorted_rows, key=lambda row: score_sort_key(row[0]))
        gender = detect_gender(table["title"])
        code = f"hunan_2023_{SWIM_SECTION_ID}_{gender}_{table_index:03d}"
        table_index += 1  # actually use i

        code = f"hunan_2023_{SWIM_SECTION_ID}_{gender}_{i:03d}"
        data = [{"score": s, "value": v, "number": str(n)} for n, (s, v) in enumerate(sorted_rows, start=1)]

        payload = {
            "code": {
                "table_name": table["title"],
                "headers": ["score", "value"],
                "code": code,
                "max_value": max_row[1],
                "min_value": min_row[1],
                "total": str(len(sorted_rows)),
                "data": data,
            }
        }

        # Save CSV
        csv_dir = OUTPUT_ROOT / "csv"
        csv_dir.mkdir(parents=True, exist_ok=True)
        file_stem = sanitize_filename(f"{code}_{table['title']}")
        csv_path = csv_dir / f"{file_stem}.csv"
        with csv_path.open("w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["sequence_number", "score", "value"])
            writer.writeheader()
            for row in data:
                writer.writerow({"sequence_number": row["number"], "score": row["score"], "value": row["value"]})

        # Save JSON
        json_dir = OUTPUT_ROOT / "json"
        json_dir.mkdir(parents=True, exist_ok=True)
        json_path = json_dir / f"{file_stem}.json"
        with json_path.open("w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)

        print(f"\n{table['title']}:")
        print(f"  total: {len(sorted_rows)}")
        print(f"  first 3: {sorted_rows[:3]}")
        print(f"  last 3:  {sorted_rows[-3:]}")
        print(f"  code: {code}")
        print(f"  csv:  {csv_path.name}")
        print(f"  json: {json_path.name}")

    # Rebuild JSONL
    jsonl_path = OUTPUT_ROOT / "all_tables.jsonl"
    all_jsons = sorted((OUTPUT_ROOT / "json").glob("*.json"))
    print(f"\nRebuilding all_tables.jsonl from {len(all_jsons)} JSON files...")
    with jsonl_path.open("w", encoding="utf-8") as f:
        for jp in all_jsons:
            f.write(jp.read_text(encoding="utf-8").strip() + "\n")

    elapsed = time.time() - t0
    print(f"\nDone! Total time: {elapsed:.0f}s")

    # Cleanup temp
    if TEMP_ROOT.exists():
        shutil.rmtree(TEMP_ROOT)
        print("Temp files cleaned.")


if __name__ == "__main__":
    main()
