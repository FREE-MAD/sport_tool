from __future__ import annotations

import csv
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

import fitz
from rapidocr_onnxruntime import RapidOCR


ROOT_DIR = Path(r"C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南")
INPUT_DIR = ROOT_DIR / "按目录切分_1-88" / "按节"
OUTPUT_ROOT = ROOT_DIR / "OCR可编辑分章Word" / "结构化导出"
RENDER_ROOT = OUTPUT_ROOT / "_rendered_pages"
LOG_PATH = OUTPUT_ROOT / "process_log.txt"
JSONL_PATH = OUTPUT_ROOT / "all_tables.jsonl"


@dataclass
class OcrCell:
    x: float
    y: float
    text: str


@dataclass
class TableData:
    title: str
    section_id: str
    table_index: int
    source_pdf: Path
    rows: list[tuple[str, str]] = field(default_factory=list)


def sanitize_filename(name: str) -> str:
    return re.sub(r'[<>:"/\\|?*]', "_", name)


def clean_text(text: str) -> str:
    text = text.strip()
    text = text.replace(" ", "")
    text = text.replace("（", "(").replace("）", ")")
    text = text.replace("：", ":").replace("，", ",")
    text = text.replace("O", "0").replace("o", "0")
    return text


def clean_title(text: str) -> str:
    text = clean_text(text)
    text = re.sub(r"^表\s*\d+", "", text)
    text = re.sub(r"^续表\s*\d+", "", text)
    text = text.strip("_- ")
    return text


def is_new_table_title(text: str) -> bool:
    text = clean_text(text)
    return bool(re.match(r"^表\d+", text)) and "评分标准" in text and "续表" not in text


def is_continuation_title(text: str) -> bool:
    text = clean_text(text)
    return bool(re.match(r"^续表\d+", text))


def is_numeric_like(text: str) -> bool:
    text = clean_text(text)
    text = text.replace(">", "").replace("<", "")
    text = text.replace("≤", "").replace("≥", "")
    if re.fullmatch(r"\d+(?::\d+(?:\.\d+)?)?", text):
        return True
    if re.fullmatch(r"\d+\.\d+", text):
        return True
    return False


def normalize_score(text: str) -> str:
    text = clean_text(text)
    text = text.replace(">", "").replace("<", "")
    text = text.replace("≤", "").replace("≥", "")
    # OCR occasionally reads decimal scores like 8.88 as 8:88.
    # For score fields we never expect mm:ss values, so normalize colon to dot.
    if ":" in text and "." not in text:
        text = text.replace(":", ".")
    return text


def normalize_value(text: str) -> str:
    text = clean_text(text)
    text = text.replace(">", "").replace("<", "")
    text = text.replace("≤", "").replace("≥", "")
    return text


def detect_gender(title: str) -> str:
    if "男子" in title or "男" in title:
        return "m"
    if "女子" in title or "女" in title:
        return "f"
    return "o"


def value_sort_key(text: str) -> tuple[int, float]:
    text = normalize_value(text)
    if ":" in text:
        parts = text.split(":")
        if len(parts) == 2:
            return (0, int(parts[0]) * 60 + float(parts[1]))
    return (1, float(text))


def score_sort_key(text: str) -> float:
    return float(normalize_score(text))


def group_cells_to_lines(cells: Iterable[OcrCell], y_tol: float = 12.0) -> list[list[OcrCell]]:
    ordered = sorted(cells, key=lambda c: (c.y, c.x))
    groups: list[list[OcrCell]] = []
    for cell in ordered:
        if not groups:
            groups.append([cell])
            continue
        avg_y = sum(item.y for item in groups[-1]) / len(groups[-1])
        if abs(cell.y - avg_y) <= y_tol:
            groups[-1].append(cell)
        else:
            groups.append([cell])
    for group in groups:
        group.sort(key=lambda c: c.x)
    return groups


def render_pdf(pdf_path: Path, out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)
    image_paths: list[Path] = []
    total_pages = doc.page_count
    for index in range(doc.page_count):
        image_path = out_dir / f"page_{index + 1:03d}.png"
        doc.load_page(index).get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False).save(image_path)
        image_paths.append(image_path)
        if total_pages <= 10 or (index + 1) % 5 == 0 or index + 1 == total_pages:
            print(f"[render] {pdf_path.name} {index + 1}/{total_pages}", flush=True)
    return image_paths


def ocr_page(image_path: Path, ocr: RapidOCR) -> list[OcrCell]:
    result, _ = ocr(str(image_path))
    cells: list[OcrCell] = []
    if not result:
        return cells
    for box, text, _score in result:
        x = sum(point[0] for point in box) / 4
        y = sum(point[1] for point in box) / 4
        cells.append(OcrCell(x=x, y=y, text=text))
    return cells


def row_to_pairs(cells: list[OcrCell]) -> list[tuple[str, str]]:
    values = [clean_text(cell.text) for cell in cells if is_numeric_like(cell.text)]
    if len(values) < 4 or len(values) % 2 != 0:
        return []
    pairs: list[tuple[str, str]] = []
    for index in range(0, len(values), 2):
        score = normalize_score(values[index])
        value = normalize_value(values[index + 1])
        pairs.append((score, value))
    return pairs


def finalize_table(table: TableData) -> dict:
    dedup: dict[tuple[str, str], None] = {}
    unique_rows: list[tuple[str, str]] = []
    for row in table.rows:
        if row in dedup:
            continue
        dedup[row] = None
        unique_rows.append(row)

    sorted_rows = sorted(unique_rows, key=lambda row: (value_sort_key(row[1]), -score_sort_key(row[0])))
    max_score_row = max(sorted_rows, key=lambda row: score_sort_key(row[0]))
    min_score_row = min(sorted_rows, key=lambda row: score_sort_key(row[0]))
    gender = detect_gender(table.title)
    code = f"hunan_2023_{table.section_id}_{gender}_{table.table_index:03d}"
    data = [
        {
            "score": score,
            "value": value,
            "number": str(index),
        }
        for index, (score, value) in enumerate(sorted_rows, start=1)
    ]
    payload = {
        "code": {
            "table_name": table.title,
            "headers": ["score", "value"],
            "code": code,
            "max_value": max_score_row[1],
            "min_value": min_score_row[1],
            "total": str(len(sorted_rows)),
            "data": data,
        }
    }
    return payload


def extract_tables_from_pdf(pdf_path: Path, ocr: RapidOCR) -> tuple[list[dict], list[str]]:
    section_id = pdf_path.stem.split("_")[0]
    render_dir = RENDER_ROOT / sanitize_filename(pdf_path.stem)
    image_paths = render_pdf(pdf_path, render_dir)
    total_pages = len(image_paths)

    tables: list[TableData] = []
    current_table: TableData | None = None
    table_index = 0
    log_lines = [f"[PDF] {pdf_path.name}"]
    print(f"[start] {pdf_path.name} total_pages={total_pages}", flush=True)

    for page_number, image_path in enumerate(image_paths, start=1):
        print(f"[ocr] {pdf_path.name} page {page_number}/{total_pages}", flush=True)
        cells = ocr_page(image_path, ocr)
        lines = group_cells_to_lines(cells)
        page_has_data = False

        for line in lines:
            joined = "".join(clean_text(cell.text) for cell in line)
            if is_new_table_title(joined):
                if current_table and current_table.rows:
                    tables.append(current_table)
                table_index += 1
                current_table = TableData(
                    title=clean_title(joined),
                    section_id=section_id,
                    table_index=table_index,
                    source_pdf=pdf_path,
                )
                log_lines.append(f"  - p{page_number:03d} 新表: {current_table.title}")
                print(
                    f"[table] {pdf_path.name} p{page_number:03d} 新表 -> {current_table.title}",
                    flush=True,
                )
                continue

            if is_continuation_title(joined):
                log_lines.append(f"  - p{page_number:03d} 续表")
                print(f"[table] {pdf_path.name} p{page_number:03d} 续表", flush=True)
                continue

            if not current_table:
                continue

            pairs = row_to_pairs(line)
            if not pairs:
                continue

            page_has_data = True
            current_table.rows.extend(pairs)

        if not page_has_data:
            log_lines.append(f"  - p{page_number:03d} 无数据行")
            print(f"[page] {pdf_path.name} p{page_number:03d} 无数据行", flush=True)

    if current_table and current_table.rows:
        tables.append(current_table)

    return [finalize_table(table) for table in tables], log_lines


def write_table_outputs(payload: dict) -> tuple[Path, Path]:
    table = payload["code"]
    title = table["table_name"]
    csv_dir = OUTPUT_ROOT / "csv"
    json_dir = OUTPUT_ROOT / "json"
    csv_dir.mkdir(parents=True, exist_ok=True)
    json_dir.mkdir(parents=True, exist_ok=True)

    file_stem = sanitize_filename(f"{table['code']}_{title}")
    csv_path = csv_dir / f"{file_stem}.csv"
    json_path = json_dir / f"{file_stem}.json"

    with csv_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["sequence_number", "score", "value"])
        writer.writeheader()
        for row in table["data"]:
            writer.writerow(
                {
                    "sequence_number": row["number"],
                    "score": row["score"],
                    "value": row["value"],
                }
            )

    with json_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"[write] csv={csv_path.name}", flush=True)
    print(f"[write] json={json_path.name}", flush=True)
    return csv_path, json_path


def reset_output_files() -> None:
    for dir_name in ["csv", "json"]:
        target_dir = OUTPUT_ROOT / dir_name
        if not target_dir.exists():
            continue
        for file_path in target_dir.glob("*"):
            if file_path.is_file():
                file_path.unlink()

    for file_path in [JSONL_PATH, LOG_PATH]:
        if file_path.exists():
            file_path.unlink()


def rebuild_jsonl() -> None:
    json_dir = OUTPUT_ROOT / "json"
    json_dir.mkdir(parents=True, exist_ok=True)
    payload_lines: list[str] = []
    for json_path in sorted(json_dir.glob("*.json")):
        payload_lines.append(json_path.read_text(encoding="utf-8").strip())
    JSONL_PATH.write_text("\n".join(payload_lines), encoding="utf-8")


def main() -> None:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    RENDER_ROOT.mkdir(parents=True, exist_ok=True)

    ocr = RapidOCR()
    if len(sys.argv) > 1:
        pdf_paths = [Path(sys.argv[1])]
        clean_mode = False
    else:
        pdf_paths = sorted(INPUT_DIR.glob("*.pdf"))
        clean_mode = True

    if clean_mode:
        reset_output_files()

    all_payloads: list[dict] = []
    log_lines: list[str] = []
    for pdf_path in pdf_paths:
        payloads, pdf_logs = extract_tables_from_pdf(pdf_path, ocr)
        log_lines.extend(pdf_logs)
        for payload in payloads:
            write_table_outputs(payload)
            all_payloads.append(payload)
        print(f"[done] {pdf_path.name} tables={len(payloads)}", flush=True)

    rebuild_jsonl()
    if clean_mode:
        LOG_PATH.write_text("\n".join(log_lines), encoding="utf-8")
    else:
        with LOG_PATH.open("a", encoding="utf-8") as f:
            if LOG_PATH.stat().st_size > 0:
                f.write("\n")
            f.write("\n".join(log_lines))
    print(f"pdf_count={len(pdf_paths)}")
    print(f"table_count={len(all_payloads)}")
    print(f"jsonl={JSONL_PATH}")


if __name__ == "__main__":
    main()
