from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path


# 统一维护湖南 2026 新版结构化导出的输入输出目录，避免后续重复改路径。
ROOT = Path(r"C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南")
EXPORT_ROOT = ROOT / "新版标准" / "结构化导出_2026"
SOURCE_ROOT = EXPORT_ROOT / "converted"
OUTPUT_ROOT = EXPORT_ROOT / "对新规定的json进行归总"
LEGACY_GROUPED_PATH = ROOT / "OCR可编辑分章Word" / "结构化导出" / "all_tables_with_code.json"

# 参考小程序 `002rule.js` 的业务编码规则，将 2026 新规表映射到前端实际使用的 code。
# 主项：provinceCode + genderCode + mainTypeKey + subCode
# 辅项：provinceCode + genderCode + auxiliaryTypeKey + subCode
CODE_RULE_MAP = {
    "02-03": {
        "scope": "mainProject",
        "type_key": "1A",
        "sub_code": "005",
    },
    "03-01": {
        "scope": "auxiliaryProject",
        "type_key": "1aa",
        "sub_code": "002",
    },
    "03-03": {
        "scope": "auxiliaryProject",
        "type_key": "1aa",
        "sub_code": "001",
    },
    "03-04": {
        "scope": "auxiliaryProject",
        "type_key": "2bb",
        "sub_code": "001",
    },
}


def split_prefix(name: str) -> tuple[str | None, str]:
    """拆分目录名前缀编码，例如 02_身体素质项目 -> (02, 身体素质项目)。"""
    if "_" not in name:
        return None, name
    prefix, rest = name.split("_", 1)
    if all(part.isdigit() for part in prefix.split("-")):
        return prefix, rest
    return None, name


def normalize_gender(code_value: str) -> tuple[str, str]:
    """从原始 code 中提取性别标记，兼容后续可能出现的不分性别表。"""
    parts = code_value.split("_")
    gender = parts[3] if len(parts) >= 4 else ""
    if gender == "m":
        return "m", "男子"
    if gender == "f":
        return "f", "女子"
    if gender == "o":
        return "o", "不分性别"
    return gender, ""


def build_file_entry(file_path: Path) -> dict:
    """为分类索引文件生成单个 json 文件的入口信息。"""
    return {
        "file_name": file_path.name,
        "relative_path": str(file_path.relative_to(EXPORT_ROOT)).replace("\\", "/"),
    }


def build_index_node(folder_path: Path, is_top_level: bool = False) -> dict:
    """递归生成 2026 新规 json 分类索引。"""
    prefix, title = split_prefix(folder_path.name)
    child_dirs = sorted([path for path in folder_path.iterdir() if path.is_dir()])
    json_files = sorted([path for path in folder_path.iterdir() if path.is_file() and path.suffix.lower() == ".json"])

    node: dict = {
        "title": title,
        "folder": str(folder_path.relative_to(EXPORT_ROOT)).replace("\\", "/"),
    }
    if prefix:
        node["code"] = prefix
    if is_top_level:
        node["category"] = title
        node.pop("title", None)

    if child_dirs:
        node["sub_items"] = [build_index_node(child) for child in child_dirs]
    if json_files:
        node["json_files"] = [build_file_entry(file_path) for file_path in json_files]
        node["json_count"] = len(json_files)

    child_count = sum(item.get("total_json_count", item.get("json_count", 0)) for item in node.get("sub_items", []))
    node["total_json_count"] = node.get("json_count", 0) + child_count
    return node


def to_float(value: object) -> float:
    """将分值或成绩安全转成浮点数，方便做筛选比较。"""
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return float("-inf")


def trim_score_25_rows(data_rows: list[dict]) -> list[dict]:
    """每个项目中分数为 25 的记录仅保留 value 最大的 3 条，其余删除。"""
    score_25_rows = [
        (index, row)
        for index, row in enumerate(data_rows)
        if to_float(row.get("score")) == 25.0
    ]
    if len(score_25_rows) <= 3:
        return [dict(row) for row in data_rows]

    # 先按 value 从大到小取前 3 条，再按原顺序放回，保持整张表的顺序稳定。
    keep_indexes = {
        index
        for index, _row in sorted(
            score_25_rows,
            key=lambda item: to_float(item[1].get("value")),
            reverse=True,
        )[:3]
    }

    trimmed_rows = [
        dict(row)
        for index, row in enumerate(data_rows)
        if to_float(row.get("score")) != 25.0 or index in keep_indexes
    ]

    # 删除多余记录后重新编号，避免 number 和实际行号不一致。
    for index, row in enumerate(trimmed_rows, start=1):
        row["number"] = str(index)

    return trimmed_rows


def build_business_code(item_code: str | None, gender: str, raw_code: str) -> str:
    """按小程序湖南规则生成业务 code；未命中的项回退原始 code。"""
    rule = CODE_RULE_MAP.get(item_code or "")
    if not rule:
        return raw_code
    return "002" + gender + rule["type_key"] + rule["sub_code"]


def load_legacy_tables() -> tuple[dict[str, dict], dict[str, dict]]:
    """读取老总表，作为本次迁移并入的基础数据。"""
    if not LEGACY_GROUPED_PATH.exists():
        return {}, {"002": {}}

    legacy_grouped = json.loads(LEGACY_GROUPED_PATH.read_text(encoding="utf-8"))
    province_tables = legacy_grouped.get("002", {})
    flat_tables = {code: dict(payload) for code, payload in province_tables.items()}
    grouped_tables = {"002": {code: dict(payload) for code, payload in province_tables.items()}}
    return flat_tables, grouped_tables


def read_single_table(json_path: Path) -> dict:
    """读取单个结构化评分表，并补齐分类、路径、性别等归总字段。"""
    raw = json.loads(json_path.read_text(encoding="utf-8"))
    code_payload = raw["code"]
    raw_code = str(code_payload.get("code", ""))

    relative_parts = json_path.relative_to(SOURCE_ROOT).parts
    category_dir = relative_parts[0] if len(relative_parts) >= 1 else ""
    item_dir = relative_parts[1] if len(relative_parts) >= 2 else ""
    category_code, category_name = split_prefix(category_dir)
    item_code, item_name = split_prefix(item_dir)
    gender, gender_label = normalize_gender(raw_code)
    trimmed_data = trim_score_25_rows(code_payload.get("data", []))
    business_code = build_business_code(item_code, gender, raw_code)

    # 这里沿用原表“首条/末条”代表边界值的语义，避免和数值大小方向混淆。
    max_value = trimmed_data[0].get("value", "") if trimmed_data else ""
    min_value = trimmed_data[-1].get("value", "") if trimmed_data else ""

    # 归总表保留原始数据结构，同时补充目录和来源信息，便于后续查表与追溯。
    table_entry = {
        "code": business_code,
        "old_code": raw_code,
        "table_name": code_payload.get("table_name", ""),
        "headers": code_payload.get("headers", []),
        "max_value": max_value,
        "min_value": min_value,
        "total": str(len(trimmed_data)),
        "category_code": category_code,
        "category_name": category_name,
        "item_code": item_code,
        "item_name": item_name,
        "gender": gender,
        "gender_label": gender_label,
        "source_path": str(json_path.relative_to(EXPORT_ROOT)).replace("\\", "/"),
        "data": trimmed_data,
    }
    return table_entry


def build_tables() -> tuple[dict[str, dict], dict[str, dict]]:
    """同时生成扁平总表与按省份分组的总表。"""
    flat_tables, grouped_tables = load_legacy_tables()

    json_files = sorted(
        [
            path
            for path in SOURCE_ROOT.rglob("*.json")
            if not path.name.startswith("all_tables_")
            and not path.name.startswith("all_tables_with_code")
            and path.name != "json分类索引.json"
            and path.name != "json分类索引_2026.json"
        ]
    )
    for json_path in json_files:
        table_entry = read_single_table(json_path)
        code_value = table_entry["code"]
        flat_tables[code_value] = table_entry
        grouped_tables["002"][code_value] = table_entry

    return flat_tables, grouped_tables


def write_json(output_path: Path, payload: dict) -> None:
    """统一写出 UTF-8 JSON，保证中文可读。"""
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def build_query_line(table_entry: dict) -> dict:
    """生成兼容老版“扁平查询”文件的单行查询对象。"""
    return {
        "code": table_entry.get("code", ""),
        "table_name": table_entry.get("table_name", ""),
        "headers": table_entry.get("headers", []),
        "old_code": table_entry.get("old_code", ""),
        "max_value": table_entry.get("max_value", ""),
        "min_value": table_entry.get("min_value", ""),
        "total": table_entry.get("total", ""),
        "data": table_entry.get("data", []),
        "provinceCode": "002",
    }


def write_query_jsonl(output_path: Path, flat_tables: dict[str, dict]) -> None:
    """按老版扁平查询格式写出 NDJSON，每行一个表对象。"""
    lines = [
        json.dumps(build_query_line(table_entry), ensure_ascii=False)
        for _code, table_entry in sorted(flat_tables.items())
    ]
    output_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)

    flat_tables, grouped_tables = build_tables()
    category_dirs = sorted([path for path in SOURCE_ROOT.iterdir() if path.is_dir() and not path.name.startswith("_")])
    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    flat_payload = {
        "title": "湖南评分标准 JSON 扁平总表（含 2026 新规并入）",
        "province": "002",
        "province_name": "湖南省",
        "version": "2023+2026",
        "source_dir": str(SOURCE_ROOT),
        "legacy_source": str(LEGACY_GROUPED_PATH),
        "generated_at": generated_at,
        "total_json_count": len(flat_tables),
        "tables": flat_tables,
    }
    grouped_payload = {
        "title": "湖南评分标准 JSON 总表（含 2026 新规并入）",
        "version": "2023+2026",
        "generated_at": generated_at,
        "total_json_count": len(flat_tables),
        "data": grouped_tables,
    }
    index_payload = {
        "title": "湖南 2026 新版评分标准导出 JSON 分类索引",
        "source_dir": str(SOURCE_ROOT),
        "generated_at": generated_at,
        "categories": [build_index_node(path, is_top_level=True) for path in category_dirs],
    }
    index_payload["total_json_count"] = sum(item["total_json_count"] for item in index_payload["categories"])

    write_json(OUTPUT_ROOT / "all_tables_2026_flat.json", flat_payload)
    write_json(OUTPUT_ROOT / "all_tables_2026_grouped.json", grouped_payload)
    write_json(OUTPUT_ROOT / "json分类索引_2026.json", index_payload)
    write_query_jsonl(OUTPUT_ROOT / "all_tables_2026_flat_query.json", flat_tables)

    print(f"output_dir={OUTPUT_ROOT}")
    print(f"total_json_count={len(flat_tables)}")


if __name__ == "__main__":
    main()
