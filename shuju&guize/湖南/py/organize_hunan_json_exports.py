from __future__ import annotations

import json
import re
import shutil
from pathlib import Path


ROOT = Path(r"C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南")
JSON_ROOT = ROOT / "OCR可编辑分章Word" / "结构化导出" / "json"
STAGING_DIR = JSON_ROOT / "_未归类"


def sanitize(name: str) -> str:
    return re.sub(r'[<>:"/\\|?*]', "_", name)


def strip_section_title(title: str) -> str:
    return re.sub(r"^第[一二三四五六七八九十]+章_第[一二三四五六七八九十]+节_", "", title)


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def build_mapping() -> dict[str, Path]:
    manifest_1_88 = load_json(ROOT / "按目录切分_1-88" / "split_manifest.json")
    manifest_449_569 = load_json(ROOT / "按目录切分_449-569" / "split_manifest.json")
    table_manifest = load_json(ROOT / "按目录切分_88-448" / "table_split_manifest.json")

    mapping: dict[str, Path] = {}

    for item in manifest_1_88["section_items"]:
        code = item["order"]
        title = strip_section_title(item["title"])
        chapter = code.split("-")[0]
        chapter_name = {
            "02": "02_身体素质项目",
            "03": "03_辅助技术项目",
        }.get(chapter, f"{chapter}_其他")
        mapping[code] = JSON_ROOT / chapter_name / sanitize(f"{code}_{title}")

    for item in manifest_449_569["items"]:
        code = item["order"]
        title = strip_section_title(item["title"])
        mapping[code] = JSON_ROOT / "04_专项技术项目" / sanitize(f"{code}_{title}")

    track_root = JSON_ROOT / "04_专项技术项目" / "04-01_田径"
    for item in table_manifest["items"]:
        if item["kind"] != "table":
            continue
        code = item["order"]
        title = re.sub(r"^表\d+_", "", item["title"])
        mapping[code] = track_root / sanitize(f"{code}_{title}")

    return mapping


def iter_source_files() -> list[Path]:
    files: list[Path] = []
    if STAGING_DIR.exists():
        files.extend(sorted(STAGING_DIR.glob("*.json")))
    files.extend(sorted(p for p in JSON_ROOT.glob("*.json") if p.is_file()))
    return files


def organize() -> tuple[int, int]:
    mapping = build_mapping()
    moved = 0
    unmatched = 0
    pattern = re.compile(r"^hunan_2023_((?:\d{2}-\d{2}(?:-\d{2})?))_[mfo]_\d{3}_.+\.json$")

    for file_path in iter_source_files():
        match = pattern.match(file_path.name)
        if not match:
            continue
        code = match.group(1)
        target_dir = mapping.get(code)
        if target_dir is None:
            target_dir = JSON_ROOT / "_未归类"
            unmatched += 1
        target_dir.mkdir(parents=True, exist_ok=True)
        shutil.move(str(file_path), str(target_dir / file_path.name))
        print(f"moved: {file_path.name} -> {target_dir.relative_to(JSON_ROOT)}")
        moved += 1

    tools_dir = JSON_ROOT / "_工具脚本"
    tools_dir.mkdir(exist_ok=True)
    for script_name in ["_show_all.py", "_show_totals.py"]:
        script_path = JSON_ROOT / script_name
        if script_path.exists():
            shutil.move(str(script_path), str(tools_dir / script_name))
            print(f"moved: {script_name} -> _工具脚本")

    if STAGING_DIR.exists() and not any(STAGING_DIR.iterdir()):
        STAGING_DIR.rmdir()
        print("removed: _未归类 (empty)")

    return moved, unmatched


if __name__ == "__main__":
    moved_count, unmatched_count = organize()
    print(f"moved_count={moved_count}")
    print(f"unmatched_count={unmatched_count}")
