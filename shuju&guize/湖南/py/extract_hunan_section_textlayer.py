from __future__ import annotations

import csv
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

import fitz


ROOT_DIR = Path(r"C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南")
OUTPUT_ROOT = ROOT_DIR / "OCR可编辑分章Word" / "结构化导出"
LOG_PATH = OUTPUT_ROOT / "process_log.txt"
JSONL_PATH = OUTPUT_ROOT / "all_tables.jsonl"
NUMBER_RE = re.compile(r"\d+:\d+\.\d+|\d+\.\d+|\d+")


@dataclass
class TableData:
    title: str
    section_id: str
    table_index: int
    source_pdf: Path
    tokens: list[str] = field(default_factory=list)
    header_lines: list[str] = field(default_factory=list)


def sanitize_filename(name: str) -> str:
    return re.sub(r'[<>:"/\\|?*]', "_", name)


def clean_text(text: str) -> str:
    text = text.strip()
    text = text.replace(" ", "")
    text = text.replace("（", "(").replace("）", ")")
    text = text.replace("：", ":").replace("，", ",").replace("、", "、")
    return text


def normalize_line_for_tokens(text: str) -> str:
    text = text.strip()
    text = text.replace("（", "(").replace("）", ")")
    text = text.replace("：", ":").replace("，", ",")
    return text


def clean_title(text: str) -> str:
    text = clean_text(text)
    text = text.replace("_", "")
    text = re.sub(r"^表\s*\d+", "", text)
    text = re.sub(r"^续表\s*\d+", "", text)
    return text.strip("_- ")


def normalize_score(text: str) -> str:
    return clean_text(text)


def normalize_value(text: str) -> str:
    return clean_text(text)


def detect_gender(title: str) -> str:
    title = clean_text(title)
    has_male = "男子" in title or "(男子" in title or "男生" in title
    has_female = "女子" in title or "(女子" in title or "女生" in title
    if has_male and has_female:
        return "o"
    if has_male:
        return "m"
    if has_female:
        return "f"
    return "o"


def value_sort_key(text: str) -> tuple[int, float]:
    text = normalize_value(text)
    if ":" in text:
        minutes, seconds = text.split(":", 1)
        return (0, int(minutes) * 60 + float(seconds))
    return (1, float(text))


def score_sort_key(text: str) -> float:
    return float(normalize_score(text))


def infer_score_index(tokens: list[str], header_hint: str) -> int:
    def orientation_score(score_index: int) -> float:
        score_tokens = tokens[score_index::2]
        if not score_tokens:
            return -1.0
        parsed: list[float] = []
        for token in score_tokens[:400]:
            if ":" in token:
                return -1.0
            parsed.append(float(token))
        range_ratio = sum(0.0 <= value <= 100.0 for value in parsed) / len(parsed)
        monotonic_ratio = 1.0
        if len(parsed) > 1:
            monotonic_ratio = sum(parsed[i] >= parsed[i + 1] for i in range(len(parsed) - 1)) / (len(parsed) - 1)
        high_score_bonus = 0.5 if max(parsed) >= 95 else 0.0
        return range_ratio * 2.0 + monotonic_ratio + high_score_bonus

    even_score = orientation_score(0)
    odd_score = orientation_score(1)
    if abs(even_score - odd_score) > 0.2:
        return 0 if even_score > odd_score else 1

    header_hint = clean_text(header_hint)
    score_pos = header_hint.find("分值")
    value_pos = header_hint.find("成绩")
    if score_pos != -1 and value_pos != -1:
        return 0 if score_pos < value_pos else 1
    return 0 if even_score >= odd_score else 1


def is_table_title_line(raw_line: str) -> bool:
    stripped = raw_line.strip()
    cleaned = clean_text(stripped)
    if not cleaned:
        return False
    if "评分标准" not in cleaned:
        return False
    if "《" in stripped or "》" in stripped:
        return False
    if re.search(r"^表\s*\d+\s", stripped):
        return True
    if re.search(r"^续表\s*\d+\s", stripped):
        return True
    return False


def normalize_title_line(raw_line: str) -> str:
    return clean_text(raw_line).replace("专项评分标准", "专项成绩评分标准")


def tokens_to_pairs(tokens: list[str], header_lines: list[str]) -> list[tuple[str, str]]:
    if len(tokens) < 4:
        return []
    usable_tokens = list(tokens)
    if len(usable_tokens) % 2 != 0:
        usable_tokens = usable_tokens[:-1]
    if not usable_tokens:
        return []

    score_index = infer_score_index(usable_tokens, "".join(header_lines))
    pairs: list[tuple[str, str]] = []
    for index in range(0, len(usable_tokens), 2):
        left = usable_tokens[index]
        right = usable_tokens[index + 1]
        if score_index == 0:
            score = normalize_score(left)
            value = normalize_value(right)
        else:
            score = normalize_score(right)
            value = normalize_value(left)
        if ":" in score:
            continue
        try:
            score_float = float(score)
        except ValueError:
            continue
        if not 0.0 <= score_float <= 100.0:
            continue
        pairs.append((score, value))
    return pairs


def finalize_table(table: TableData) -> dict | None:
    pairs = tokens_to_pairs(table.tokens, table.header_lines)
    if not pairs:
        return None

    seen: set[tuple[str, str]] = set()
    unique_rows: list[tuple[str, str]] = []
    for row in pairs:
        if row in seen:
            continue
        seen.add(row)
        unique_rows.append(row)

    if not unique_rows:
        return None

    sorted_rows = sorted(unique_rows, key=lambda row: (value_sort_key(row[1]), -score_sort_key(row[0])))
    lower_value_is_better = score_sort_key(sorted_rows[0][0]) > score_sort_key(sorted_rows[-1][0])
    if lower_value_is_better:
        max_value = sorted_rows[0][1]
        min_value = sorted_rows[-1][1]
    else:
        max_value = sorted_rows[-1][1]
        min_value = sorted_rows[0][1]

    code = f"hunan_2023_{table.section_id}_{detect_gender(table.title)}_{table.table_index:03d}"
    data = [
        {"score": score, "value": value, "number": str(index)}
        for index, (score, value) in enumerate(sorted_rows, start=1)
    ]
    return {
        "code": {
            "table_name": table.title,
            "headers": ["score", "value"],
            "code": code,
            "max_value": max_value,
            "min_value": min_value,
            "total": str(len(sorted_rows)),
            "data": data,
        }
    }


def extract_tables_from_pdf(pdf_path: Path) -> tuple[list[dict], list[str]]:
    doc = fitz.open(pdf_path)
    section_id = pdf_path.stem.split("_")[0]
    log_lines: list[str] = [f"[PDF-TEXT-MULTI] {pdf_path.name}"]
    tables: list[TableData] = []
    current_table: TableData | None = None
    table_index = 0

    for page_number in range(doc.page_count):
        page = doc.load_page(page_number)
        print(f"[text] {pdf_path.name} page {page_number + 1}/{doc.page_count}", flush=True)
        page_has_tokens = False
        blocks = sorted(page.get_text("blocks"), key=lambda item: (item[1], item[0]))

        for block in blocks:
            for raw_line in str(block[4]).splitlines():
                line = raw_line.strip()
                if not line:
                    continue
                if re.fullmatch(r"-\d+-", line):
                    continue

                if is_table_title_line(line):
                    normalized_title = normalize_title_line(line)
                    if normalized_title.startswith("续表"):
                        log_lines.append(f"  - p{page_number + 1:03d} 续表: {normalized_title}")
                        continue
                    if current_table and current_table.tokens:
                        tables.append(current_table)
                    table_index += 1
                    current_table = TableData(
                        title=clean_title(normalized_title),
                        section_id=section_id,
                        table_index=table_index,
                        source_pdf=pdf_path,
                    )
                    log_lines.append(f"  - p{page_number + 1:03d} 新表: {current_table.title}")
                    continue

                if not current_table:
                    continue

                tokens = NUMBER_RE.findall(normalize_line_for_tokens(line))
                if not tokens:
                    if len(current_table.header_lines) < 12:
                        current_table.header_lines.append(clean_text(line))
                    continue

                current_table.tokens.extend(tokens)
                page_has_tokens = True

        if current_table and not page_has_tokens:
            log_lines.append(f"  - p{page_number + 1:03d} 当前表无数值行")

    if current_table and current_table.tokens:
        tables.append(current_table)

    payloads: list[dict] = []
    for table in tables:
        payload = finalize_table(table)
        if payload:
            payloads.append(payload)
    return payloads, log_lines


def write_table_outputs(payload: dict) -> tuple[Path, Path]:
    table = payload["code"]
    csv_dir = OUTPUT_ROOT / "csv"
    json_dir = OUTPUT_ROOT / "json"
    csv_dir.mkdir(parents=True, exist_ok=True)
    json_dir.mkdir(parents=True, exist_ok=True)

    file_stem = sanitize_filename(f"{table['code']}_{table['table_name']}")
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


def rebuild_jsonl() -> None:
    json_dir = OUTPUT_ROOT / "json"
    json_dir.mkdir(parents=True, exist_ok=True)
    payload_lines = [json_path.read_text(encoding="utf-8").strip() for json_path in sorted(json_dir.glob("*.json"))]
    JSONL_PATH.write_text("\n".join(payload_lines), encoding="utf-8")


def resolve_inputs() -> list[Path]:
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python extract_hunan_section_textlayer.py <pdf-or-dir>")
    target = Path(sys.argv[1])
    if target.is_dir():
        return sorted(target.glob("*.pdf"))
    return [target]


def main() -> None:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    pdf_paths = resolve_inputs()
    all_payloads: list[dict] = []
    all_logs: list[str] = []

    for pdf_path in pdf_paths:
        payloads, pdf_logs = extract_tables_from_pdf(pdf_path)
        all_logs.extend(pdf_logs)
        for payload in payloads:
            write_table_outputs(payload)
            all_payloads.append(payload)
        print(f"[done] {pdf_path.name} tables={len(payloads)}", flush=True)

    rebuild_jsonl()
    with LOG_PATH.open("a", encoding="utf-8") as f:
        if LOG_PATH.exists() and LOG_PATH.stat().st_size > 0:
            f.write("\n")
        f.write("\n".join(all_logs))
    print(f"pdf_count={len(pdf_paths)}")
    print(f"table_count={len(all_payloads)}")
    print(f"jsonl={JSONL_PATH}")


if __name__ == "__main__":
    main()
