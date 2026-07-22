from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path


# 只针对 2026 新版 converted 目录生成“总表+code”，保持旧版文件命名一致，便于后续脚本直接复用。
ROOT = Path(r"C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南\新版标准\结构化导出_2026\converted")
PROVINCE_CODE = "002"

# 参考湖南前端业务编码规则，为 2026 converted 目录中的表生成可直接查询的 code。
CODE_RULE_MAP = {
    "02-03": {"type_key": "1A", "sub_code": "005"},
    "03-01": {"type_key": "1aa", "sub_code": "002"},
    "03-03": {"type_key": "1aa", "sub_code": "001"},
    "03-04": {"type_key": "2bb", "sub_code": "001"},
}


def split_prefix(name: str) -> tuple[str | None, str]:
    if "_" not in name:
        return None, name
    prefix, rest = name.split("_", 1)
    if all(part.isdigit() for part in prefix.split("-")):
        return prefix, rest
    return None, name


def normalize_gender(raw_code: str) -> tuple[str, str]:
    parts = raw_code.split("_")
    gender = parts[3] if len(parts) >= 4 else ""
    if gender == "m":
        return "m", "男子"
    if gender == "f":
        return "f", "女子"
    if gender == "o":
        return "o", "不分性别"
    return gender, ""


def build_business_code(item_code: str | None, gender: str, raw_code: str) -> str:
    rule = CODE_RULE_MAP.get(item_code or "")
    if not rule or not gender:
        return raw_code
    return f"{PROVINCE_CODE}{gender}{rule['type_key']}{rule['sub_code']}"


def build_file_entry(file_path: Path) -> dict:
    return {
        "file_name": file_path.name,
        "relative_path": str(file_path.relative_to(ROOT)).replace("\\", "/"),
    }


def build_index_node(folder_path: Path, is_top_level: bool = False) -> dict:
    prefix, title = split_prefix(folder_path.name)
    child_dirs = sorted([path for path in folder_path.iterdir() if path.is_dir()])
    json_files = sorted(
        [
            path
            for path in folder_path.iterdir()
            if path.is_file()
            and path.suffix.lower() == ".json"
            and not path.name.startswith("all_tables_with_code")
            and path.name != "json分类索引.json"
        ]
    )

    node: dict = {
        "title": title,
        "folder": str(folder_path.relative_to(ROOT)).replace("\\", "/"),
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


def read_single_table(json_path: Path) -> dict:
    raw = json.loads(json_path.read_text(encoding="utf-8"))
    payload = raw["code"]
    raw_code = str(payload.get("code", ""))

    relative_parts = json_path.relative_to(ROOT).parts
    category_dir = relative_parts[0] if len(relative_parts) >= 1 else ""
    item_dir = relative_parts[1] if len(relative_parts) >= 2 else ""
    category_code, category_name = split_prefix(category_dir)
    item_code, item_name = split_prefix(item_dir)
    gender, gender_label = normalize_gender(raw_code)

    return {
        "code": build_business_code(item_code, gender, raw_code),
        "table_name": payload.get("table_name", ""),
        "headers": payload.get("headers", []),
        "old_code": raw_code,
        "max_value": payload.get("max_value", ""),
        "min_value": payload.get("min_value", ""),
        "total": str(payload.get("total", len(payload.get("data", [])))),
        "category_code": category_code,
        "category_name": category_name,
        "item_code": item_code,
        "item_name": item_name,
        "gender": gender,
        "gender_label": gender_label,
        "source_path": str(json_path.relative_to(ROOT)).replace("\\", "/"),
        "data": payload.get("data", []),
    }


def build_outputs() -> tuple[dict, dict, dict]:
    json_files = sorted(
        [
            path
            for path in ROOT.rglob("*.json")
            if "all_tables_with_code" not in path.name and path.name != "json分类索引.json"
        ]
    )
    flat_tables: dict[str, dict] = {}
    for json_path in json_files:
        entry = read_single_table(json_path)
        flat_tables[entry["code"]] = entry

    grouped_payload = {
        PROVINCE_CODE: {code: payload for code, payload in sorted(flat_tables.items())}
    }

    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    category_dirs = sorted([path for path in ROOT.iterdir() if path.is_dir() and not path.name.startswith("_")])
    index_payload = {
        "title": "湖南 2026 新版评分标准导出 JSON 分类索引",
        "source_dir": str(ROOT),
        "generated_at": generated_at,
        "categories": [build_index_node(path, is_top_level=True) for path in category_dirs],
    }
    index_payload["total_json_count"] = sum(item["total_json_count"] for item in index_payload["categories"])

    flat_query_lines = [
        json.dumps(
            {
                "code": entry["code"],
                "table_name": entry["table_name"],
                "headers": entry["headers"],
                "old_code": entry["old_code"],
                "max_value": entry["max_value"],
                "min_value": entry["min_value"],
                "total": entry["total"],
                "data": entry["data"],
                "provinceCode": PROVINCE_CODE,
            },
            ensure_ascii=False,
        )
        for _code, entry in sorted(flat_tables.items())
    ]

    summary = {
        "generated_at": generated_at,
        "json_count": len(json_files),
        "code_count": len(flat_tables),
        "codes": sorted(flat_tables.keys()),
    }
    return grouped_payload, index_payload, {"lines": flat_query_lines, "summary": summary}


def main() -> None:
    grouped_payload, index_payload, query_bundle = build_outputs()
    (ROOT / "all_tables_with_code.json").write_text(
        json.dumps(grouped_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (ROOT / "all_tables_with_code - 扁平查询.json").write_text(
        "\n".join(query_bundle["lines"]),
        encoding="utf-8",
    )
    (ROOT / "json分类索引.json").write_text(
        json.dumps(index_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(query_bundle["summary"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
