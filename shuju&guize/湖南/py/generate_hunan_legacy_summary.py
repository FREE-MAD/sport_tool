from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path


ROOT = Path(r"C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南")
EXPORT_ROOT = ROOT / "OCR可编辑分章Word" / "结构化导出"
JSON_ROOT = EXPORT_ROOT / "json"
GROUPED_OUTPUT_PATH = EXPORT_ROOT / "all_tables_with_code.json"
FLAT_QUERY_OUTPUT_PATH = EXPORT_ROOT / "all_tables_with_code - 扁平查询.json"

TRACK_CODE_MAP = {
    "04-01-12": "4de0001",
    "04-01-13": "4de0001",
    "04-01-14": "4de0002",
    "04-01-15": "4de0002",
    "04-01-16": "4de0003",
    "04-01-17": "4de0003",
    "04-01-18": "4de0004",
    "04-01-19": "4de0004",
    "04-01-20": "4de0005",
    "04-01-21": "4de0005",
    "04-01-22": "4df0002",
    "04-01-23": "4df0002",
    "04-01-24": "4df0003",
    "04-01-25": "4df0003",
    "04-01-26": "4df0001",
    "04-01-27": "4df0001",
    "04-01-28": "4dg0001",
    "04-01-29": "4dg0002",
    "04-01-30": "4dg0003",
    "04-01-31": "4dg0003",
}

TABLE_CODE_MAP = {
    "02-01": lambda gender, index: f"002{gender}1A001",
    "02-02": lambda gender, index: f"002{gender}1A004",
    "03-01": lambda gender, index: f"002{gender}1aa002",
    "03-02": lambda gender, index: "002o1aa003",
    "03-03": lambda gender, index: f"002{gender}1aa001",
    "03-04": lambda gender, index: f"002{gender}2bb001",
    "04-02": lambda gender, index: f"002{gender}1a002{ {'001':'0002','002':'0002','003':'0003','004':'0003','005':'0004','006':'0004'}[index] }",
    "04-03": lambda gender, index: f"002{gender}1a0030001",
    "04-04": lambda gender, index: {
        "001": "002o1a0010001",
        "002": "002m1a0010002",
        "003": "002f1a0010002",
        "005": "002m1a0010005",
        "006": "002f1a0010005",
    }[index],
    "04-08": lambda gender, index: f"002{gender}2b001{ {'001':'0001','002':'0001','003':'0002','004':'0002','005':'0003','006':'0003','007':'0004','008':'0004'}[index] }",
    "04-10": lambda gender, index: {
        "001": "002o1a0040004",
        "002": "002o1a0040005",
        "003": "002o1a0040003",
    }[index],
    "04-11": lambda gender, index: {
        "001": "002o5ei0001",
        "002": "002m5ei0002",
        "003": "002f5ei0002",
        "004": "002o5ei0003",
    }[index],
    "04-12": lambda gender, index: {
        "001": "002m5eg0001",
        "002": "002f5eg0001",
        "003": "002m5eg0002",
        "004": "002f5eg0002",
        "005": "002o5eg0003",
    }[index],
    "04-13": lambda gender, index: {
        "001": "002o5eh0001",
        "002": "002o5eh0002",
        "003": "002o5eh0003",
    }[index],
}

OLD_CODE_PATTERN = re.compile(
    r"^hunan_2023_(?P<section>\d{2}-\d{2}(?:-\d{2})?)(?:_(?P<gender>[mfo]))?_(?P<index>\d{3})$"
)


def iter_json_files() -> list[Path]:
    """收集所有单表 JSON，跳过总表、索引和工具目录。"""
    return sorted(
        [
            path
            for path in JSON_ROOT.rglob("*.json")
            if "_工具脚本" not in path.parts
            and not path.name.startswith("all_tables_")
            and path.name != "json分类索引.json"
            and path.name != "json分类索引_2026.json"
        ]
    )


def build_standard_code(old_code: str) -> str:
    """按《湖南数据编码和规则》为 2023 老表生成标准业务 code。"""
    match = OLD_CODE_PATTERN.match(old_code)
    if not match:
        raise KeyError(f"无法解析 old_code：{old_code}")

    section = match.group("section")
    gender = match.group("gender") or "o"
    index = match.group("index")

    if section in TRACK_CODE_MAP:
        return f"002{gender}{TRACK_CODE_MAP[section]}"

    rule = TABLE_CODE_MAP.get(section)
    if not rule:
        raise KeyError(f"未配置 section 映射：{section}")
    return rule(gender, index)


def build_table_entry(file_path: Path) -> tuple[str, dict]:
    """把单表 JSON 转成老总表条目结构。"""
    raw_payload = json.loads(file_path.read_text(encoding="utf-8"))["code"]
    old_code = str(raw_payload.get("code", ""))
    business_code = build_standard_code(old_code)
    data_rows = list(raw_payload.get("data", []))

    table_entry = {
        "code": business_code,
        "table_name": raw_payload.get("table_name", ""),
        "headers": raw_payload.get("headers", []),
        "old_code": old_code,
        # 老总表沿用“首条/末条即边界值”的写法，和现有 2026 汇总脚本保持一致。
        "max_value": data_rows[0].get("value", "") if data_rows else "",
        "min_value": data_rows[-1].get("value", "") if data_rows else "",
        "total": str(len(data_rows)),
        "data": data_rows,
    }
    return business_code, table_entry


def write_grouped_json(tables: dict[str, dict]) -> None:
    grouped_payload = {"002": tables}
    GROUPED_OUTPUT_PATH.write_text(
        json.dumps(grouped_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def write_flat_query_jsonl(tables: dict[str, dict]) -> None:
    """兼容旧的扁平查询文件格式，每行一个 JSON 对象。"""
    lines = [
        json.dumps(
            {
                "code": table_entry.get("code", ""),
                "table_name": table_entry.get("table_name", ""),
                "headers": table_entry.get("headers", []),
                "old_code": table_entry.get("old_code", ""),
                "max_value": table_entry.get("max_value", ""),
                "min_value": table_entry.get("min_value", ""),
                "total": table_entry.get("total", ""),
                "data": table_entry.get("data", []),
                "provinceCode": "002",
            },
            ensure_ascii=False,
        )
        for _code, table_entry in sorted(tables.items())
    ]
    FLAT_QUERY_OUTPUT_PATH.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    tables: dict[str, dict] = {}
    updated_count = 0
    skipped_count = 0
    for file_path in iter_json_files():
        try:
            business_code, table_entry = build_table_entry(file_path)
        except (json.JSONDecodeError, KeyError):
            skipped_count += 1
            continue
        tables[business_code] = table_entry
        updated_count += 1

    write_grouped_json(tables)
    write_flat_query_jsonl(tables)
    print(f"generated_at={datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"grouped_output={GROUPED_OUTPUT_PATH}")
    print(f"flat_query_output={FLAT_QUERY_OUTPUT_PATH}")
    print(f"total_json_count={len(tables)}")
    print(f"updated_count={updated_count}")
    print(f"skipped_count={skipped_count}")


if __name__ == "__main__":
    main()
