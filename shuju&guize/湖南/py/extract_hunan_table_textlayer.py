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
    rows: list[tuple[str, str]] = field(default_factory=list)


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
    has_male = any(token in title for token in ["男子", "（男子", "(男子", "男、女", "男_女"])
    has_female = any(token in title for token in ["女子", "（女子", "(女子", "男、女", "男_女"])
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


def extract_title_from_filename(pdf_path: Path) -> str:
    stem = pdf_path.stem
    stem = re.sub(r"_印刷页\d+(?:-\d+)?$", "", stem)
    parts = stem.split("_")
    if len(parts) >= 3:
        candidate = "".join(parts[1:])
    else:
        candidate = stem
    return clean_title(candidate)


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


def extract_pairs_from_text(pdf_path: Path) -> tuple[list[tuple[str, str]], list[str], str]:
    doc = fitz.open(pdf_path)
    all_tokens: list[str] = []
    log_lines: list[str] = [f"[PDF-TEXT] {pdf_path.name}"]
    title = ""
    header_lines: list[str] = []

    for page_number in range(doc.page_count):
        page = doc.load_page(page_number)
        text = page.get_text("text")
        print(f"[text] {pdf_path.name} page {page_number + 1}/{doc.page_count}", flush=True)
        page_tokens_before = len(all_tokens)
        numeric_started = False

        for raw_line in text.splitlines():
            line = raw_line.strip()
            if not line:
                continue
            if re.fullmatch(r"-\d+-", line):
                continue
            cleaned = clean_text(line)
            if not cleaned:
                continue
            if re.match(r"^(续?表)\d+", cleaned):
                title = clean_title(cleaned)
                log_lines.append(f"  - p{page_number + 1:03d} 标题: {title}")
                continue
            tokens = NUMBER_RE.findall(normalize_line_for_tokens(line))
            if not tokens:
                if not numeric_started and len(header_lines) < 12:
                    header_lines.append(cleaned)
                continue
            numeric_started = True
            all_tokens.extend(tokens)

        if len(all_tokens) == page_tokens_before:
            log_lines.append(f"  - p{page_number + 1:03d} 无数据行")

    if not title:
        title = extract_title_from_filename(pdf_path)

    if "评分标准" not in title or len(all_tokens) < 4:
        return [], log_lines, title

    if len(all_tokens) % 2 != 0:
        log_lines.append(f"  - token_count={len(all_tokens)} 为奇数，已丢弃末尾 token={all_tokens[-1]}")
        all_tokens = all_tokens[:-1]

    score_index = infer_score_index(all_tokens, "".join(header_lines))
    pairs: list[tuple[str, str]] = []
    for index in range(0, len(all_tokens), 2):
        left = all_tokens[index]
        right = all_tokens[index + 1]
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

    return pairs, log_lines, title


def split_mixed_gender_title(title: str) -> list[tuple[str, str]]:
    title = clean_text(title)
    match = re.match(
        r"^男、女(?P<event>.+?专项成绩评分标准)\((?:男子)(?P<male_spec>[^,，、)]+)[,，、](?:女子)(?P<female_spec>[^)]+)\)$",
        title,
    )
    if not match:
        return []
    event = match.group("event")
    male_spec = match.group("male_spec")
    female_spec = match.group("female_spec")
    return [
        ("男子" + event + f"({male_spec})", "m"),
        ("女子" + event + f"({female_spec})", "f"),
    ]


def finalize_table(table: TableData) -> dict:
    seen: set[tuple[str, str]] = set()
    unique_rows: list[tuple[str, str]] = []
    for row in table.rows:
        if row in seen:
            continue
        seen.add(row)
        unique_rows.append(row)

    sorted_rows = sorted(unique_rows, key=lambda row: (value_sort_key(row[1]), -score_sort_key(row[0])))
    lower_value_is_better = score_sort_key(sorted_rows[0][0]) > score_sort_key(sorted_rows[-1][0])
    if lower_value_is_better:
        max_value = sorted_rows[0][1]
        min_value = sorted_rows[-1][1]
    else:
        max_value = sorted_rows[-1][1]
        min_value = sorted_rows[0][1]
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


def expand_tables(table: TableData) -> list[TableData]:
    split_titles = split_mixed_gender_title(table.title)
    if not split_titles:
        return [table]
    expanded: list[TableData] = []
    for index, (title, _gender) in enumerate(split_titles, start=1):
        expanded.append(
            TableData(
                title=title,
                section_id=table.section_id,
                table_index=index,
                source_pdf=table.source_pdf,
                rows=list(table.rows),
            )
        )
    return expanded


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


def rebuild_jsonl() -> None:
    json_dir = OUTPUT_ROOT / "json"
    json_dir.mkdir(parents=True, exist_ok=True)
    payload_lines = [json_path.read_text(encoding="utf-8").strip() for json_path in sorted(json_dir.glob("*.json"))]
    JSONL_PATH.write_text("\n".join(payload_lines), encoding="utf-8")


def process_pdf(pdf_path: Path) -> tuple[list[dict], list[str]]:
    pairs, log_lines, title = extract_pairs_from_text(pdf_path)
    if not pairs:
        print(f"[skip] {pdf_path.name} no scoring pairs", flush=True)
        return [], log_lines
    section_id = pdf_path.stem.split("_")[0]
    table = TableData(
        title=title,
        section_id=section_id,
        table_index=1,
        source_pdf=pdf_path,
        rows=pairs,
    )
    payloads = [finalize_table(item) for item in expand_tables(table)]
    if len(payloads) > 1:
        log_lines.append(f"  - 已拆分为 {len(payloads)} 个性别文件")
    return payloads, log_lines


def resolve_inputs() -> list[Path]:
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python extract_hunan_table_textlayer.py <pdf-or-dir>")
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
        payloads, pdf_logs = process_pdf(pdf_path)
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
