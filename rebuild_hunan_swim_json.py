from __future__ import annotations

import csv
import json
import re
from pathlib import Path


CSV_DIR = Path(r"C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南\OCR可编辑分章Word\结构化导出\csv")
JSON_DIR = Path(r"C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南\OCR可编辑分章Word\结构化导出\json\04_专项技术项目\04-08_游泳")
PDF_TEXT_PATH = Path(r"C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南\py\pdf_full_text.txt")

TIME_PATTERN = re.compile(r"^\d{2}:\d{2}\.\d{2}$")
SCORE_PATTERN = re.compile(r"^\d+(?:\.\d+)?$")
TABLE_START_PATTERN = re.compile(r"^表(?P<table_no>\d+)\s+")
PAGE_MARK_PATTERN = re.compile(r"^=== Page (?P<page_no>\d+) ===$")

# 这些表经用户确认存在首页/末页漏读，需要优先按 PDF 全文重建而不是仅靠 CSV。
TABLE_NO_BY_FILE = {
    "hunan_2023_04-08_m_001_男子100米自由泳专项成绩评分标准.csv": "50",
    "hunan_2023_04-08_f_002_女子100米自由泳专项成绩评分标准.csv": "51",
    "hunan_2023_04-08_m_003_男子100米仰泳专项成绩评分标准.csv": "52",
    "hunan_2023_04-08_f_004_女子100米仰泳专项成绩评分标准.csv": "53",
    "hunan_2023_04-08_m_007_男子100米蝶泳专项成绩评分标准.csv": "56",
    "hunan_2023_04-08_f_008_女子100米蝶泳专项成绩评分标准.csv": "57",
}

# 这些页范围已经按 PDF 原文核对过，用来避免 OCR 全文在表切换处串入相邻项目。
PAGE_RANGE_BY_FILE = {
    "hunan_2023_04-08_m_001_男子100米自由泳专项成绩评分标准.csv": (493, 499),
    "hunan_2023_04-08_f_002_女子100米自由泳专项成绩评分标准.csv": (500, 508),
    "hunan_2023_04-08_m_003_男子100米仰泳专项成绩评分标准.csv": (509, 515),
    "hunan_2023_04-08_f_004_女子100米仰泳专项成绩评分标准.csv": (516, 524),
    "hunan_2023_04-08_m_007_男子100米蝶泳专项成绩评分标准.csv": (537, 543),
    "hunan_2023_04-08_f_008_女子100米蝶泳专项成绩评分标准.csv": (544, 551),
}


def time_to_centiseconds(value: str) -> int:
    minute_part, second_part = value.split(":")
    second_text, centisecond_text = second_part.split(".")
    return (int(minute_part) * 60 + int(second_text)) * 100 + int(centisecond_text)


def normalize_rows(raw_rows: list[dict[str, str]]) -> list[dict[str, str]]:
    raw_rows.sort(key=lambda item: time_to_centiseconds(item["value"]))
    return [
        {
            "score": item["score"],
            "value": item["value"],
            "number": str(index),
        }
        for index, item in enumerate(raw_rows, start=1)
    ]


def parse_lines_to_rows(lines: list[str]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    pending_score: str | None = None
    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("===") or line.startswith("-"):
            continue
        if line.startswith("表") or line.startswith("续表"):
            continue
        if line in {"分值", "成绩", "（秒）"}:
            continue
        if "羽毛球" in line or "乒乓球" in line:
            continue

        parts = line.split()
        if len(parts) == 2 and SCORE_PATTERN.match(parts[0]) and TIME_PATTERN.match(parts[1]):
            rows.append({"score": parts[0], "value": parts[1]})
            pending_score = None
            continue

        if len(parts) == 1 and SCORE_PATTERN.match(parts[0]):
            pending_score = parts[0]
            continue

        if len(parts) == 1 and TIME_PATTERN.match(parts[0]) and pending_score is not None:
            rows.append({"score": pending_score, "value": parts[0]})
            pending_score = None
            continue

    return normalize_rows(rows)


def rows_from_pdf_pages(start_page: int, end_page: int) -> list[dict[str, str]]:
    lines = PDF_TEXT_PATH.read_text(encoding="utf-8").splitlines()
    start_index: int | None = None
    end_index: int | None = None

    for index, line in enumerate(lines):
        match = PAGE_MARK_PATTERN.match(line.strip())
        if not match:
            continue
        current_page = int(match.group("page_no"))
        if current_page == start_page and start_index is None:
            start_index = index
            continue
        if start_index is not None and current_page == end_page + 1:
            end_index = index
            break

    if start_index is None:
        raise ValueError(f"未在 PDF 全文中找到页段 {start_page}-{end_page}")
    if end_index is None:
        end_index = len(lines)

    return parse_lines_to_rows(lines[start_index:end_index])


def csv_to_rows(csv_path: Path) -> list[dict[str, str]]:
    with csv_path.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        valid_rows: list[dict[str, str]] = []
        for row in reader:
            score = (row.get("score") or "").strip()
            value = (row.get("value") or "").strip()
            if not TIME_PATTERN.match(value):
                continue
            if not SCORE_PATTERN.match(score):
                continue
            valid_rows.append({"score": score, "value": value})

    return normalize_rows(valid_rows)


def rebuild_single(csv_path: Path) -> dict[str, str]:
    json_name = csv_path.name.replace(".csv", ".json")
    json_path = JSON_DIR / json_name
    existing = json.loads(json_path.read_text(encoding="utf-8"))
    payload = existing["code"]
    table_no = TABLE_NO_BY_FILE.get(csv_path.name)
    page_range = PAGE_RANGE_BY_FILE.get(csv_path.name)
    if page_range:
        rows = rows_from_pdf_pages(*page_range)
    else:
        rows = csv_to_rows(csv_path)
    payload["min_value"] = rows[0]["value"]
    payload["max_value"] = rows[-1]["value"]
    payload["total"] = str(len(rows))
    payload["data"] = rows
    json_path.write_text(json.dumps(existing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {
        "file": json_name,
        "source": f"pdf_pages_{page_range[0]}_{page_range[1]}" if page_range else f"pdf_table_{table_no}" if table_no else "csv",
        "total": str(len(rows)),
        "min_value": rows[0]["value"],
        "max_value": rows[-1]["value"],
    }


def main() -> None:
    targets = sorted(CSV_DIR.glob("hunan_2023_04-08_*.csv"))
    results = [rebuild_single(path) for path in targets]
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
