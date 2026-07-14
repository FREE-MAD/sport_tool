from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path


ROOT = Path(r"C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南")
EXPORT_ROOT = ROOT / "OCR可编辑分章Word" / "结构化导出"
JSON_ROOT = EXPORT_ROOT / "json"
OUTPUT_PATH = EXPORT_ROOT / "json分类索引.json"


def split_prefix(name: str) -> tuple[str | None, str]:
    if "_" not in name:
        return None, name
    prefix, rest = name.split("_", 1)
    if all(part.isdigit() for part in prefix.split("-")):
        return prefix, rest
    return None, name


def build_file_entry(file_path: Path) -> dict:
    return {
        "file_name": file_path.name,
        "relative_path": str(file_path.relative_to(EXPORT_ROOT)).replace("\\", "/"),
    }


def build_node(folder_path: Path, is_top_level: bool = False) -> dict:
    prefix, title = split_prefix(folder_path.name)
    child_dirs = sorted([p for p in folder_path.iterdir() if p.is_dir()])
    json_files = sorted([p for p in folder_path.iterdir() if p.is_file() and p.suffix.lower() == ".json"])

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
        node["sub_items"] = [build_node(child) for child in child_dirs]
    if json_files:
        node["json_files"] = [build_file_entry(file_path) for file_path in json_files]
        node["json_count"] = len(json_files)

    child_count = sum(item.get("total_json_count", item.get("json_count", 0)) for item in node.get("sub_items", []))
    node["total_json_count"] = node.get("json_count", 0) + child_count
    return node


def main() -> None:
    category_dirs = sorted(
        [
            path
            for path in JSON_ROOT.iterdir()
            if path.is_dir() and not path.name.startswith("_")
        ]
    )

    data = {
        "title": "湖南体育评分标准导出JSON分类索引",
        "source_dir": str(JSON_ROOT),
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "categories": [build_node(path, is_top_level=True) for path in category_dirs],
    }
    data["total_json_count"] = sum(item["total_json_count"] for item in data["categories"])

    OUTPUT_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"written={OUTPUT_PATH}")
    print(f"total_json_count={data['total_json_count']}")


if __name__ == "__main__":
    main()
