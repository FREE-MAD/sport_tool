from __future__ import annotations

import csv
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import requests
from bs4 import BeautifulSoup, NavigableString
from rapidocr_onnxruntime import RapidOCR


ROOT = Path(r"C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南")
HTML_ROOT = ROOT / "新版标准"
OUTPUT_ROOT = HTML_ROOT / "结构化导出_2026"
IMAGE_ROOT = OUTPUT_ROOT / "images"
LOG_PATH = OUTPUT_ROOT / "process_log.txt"
SUMMARY_PATH = OUTPUT_ROOT / "summary.json"


TABLE_DEFS = [
    {
        "html": "湖南省体育高考之立定跳远评分标准（2026新版）.html",
        "title": "立定跳远成绩评分标准（男子）",
        "code": "hunan_2026_02-03_m_001",
        "folder": "02_身体素质项目/02-03_立定跳远",
        "image_range": [3, 9],
        "value_range": [0.0, 3.0],
    },
    {
        "html": "湖南省体育高考之立定跳远评分标准（2026新版）.html",
        "title": "立定跳远成绩评分标准（女子）",
        "code": "hunan_2026_02-03_f_002",
        "folder": "02_身体素质项目/02-03_立定跳远",
        "image_range": [10, 15],
        "value_range": [0.0, 3.0],
    },
    {
        "html": "湖南省体育高考之篮辅评分标准（2026新版）.html",
        "title": "篮球辅项成绩评分标准（男子）",
        "code": "hunan_2026_03-01_m_001",
        "folder": "03_辅助技术项目/03-01_篮球辅项",
        "image_range": [4, 22],
        "value_range": [0.0, 60.0],
    },
    {
        "html": "湖南省体育高考之篮辅评分标准（2026新版）.html",
        "title": "篮球辅项成绩评分标准（女子）",
        "code": "hunan_2026_03-01_f_002",
        "folder": "03_辅助技术项目/03-01_篮球辅项",
        "image_range": [23, 42],
        "value_range": [0.0, 60.0],
    },
    {
        "html": "湖南省体育高考之足辅评分标准（2026新版）.html",
        "title": "足球辅项成绩评分标准（男子）",
        "code": "hunan_2026_03-03_m_001",
        "folder": "03_辅助技术项目/03-03_足球辅项",
        "image_range": [4, 27],
        "value_range": [0.0, 80.0],
    },
    {
        "html": "湖南省体育高考之足辅评分标准（2026新版）.html",
        "title": "足球辅项成绩评分标准（女子）",
        "code": "hunan_2026_03-03_f_002",
        "folder": "03_辅助技术项目/03-03_足球辅项",
        "image_range": [28, 52],
        "value_range": [0.0, 80.0],
    },
    {
        "html": "湖南省体育高考之游辅-男子评分标准（2026新版）.html",
        "title": "游泳辅项成绩评分标准（男子）",
        "code": "hunan_2026_03-04_m_001",
        "folder": "03_辅助技术项目/03-04_游泳",
        "image_range": [3, 76],
        "value_range": [20.0, 80.0],
    },
    {
        "html": "湖南省体育高考之游辅-女子评分标准（2026新版）.html",
        "title": "游泳辅项成绩评分标准（女子）",
        "code": "hunan_2026_03-04_f_002",
        "folder": "03_辅助技术项目/03-04_游泳",
        "image_range": [3, 62],
        # 女子游泳尾段成绩会延伸到 1:31.xx，不能把上限卡在 90 秒内。
        "value_range": [20.0, 100.0],
    },
]


@dataclass
class OcrCell:
    x: float
    y: float
    text: str


def sanitize_filename(name: str) -> str:
    return re.sub(r'[<>:"/\\|?*]', "_", name)


def clean_text(text: str) -> str:
    text = text.strip()
    text = text.replace("（", "(").replace("）", ")")
    text = text.replace("：", ":").replace("，", ",")
    return re.sub(r"\s+", "", text)


def normalize_score(text: str) -> str:
    text = clean_text(text).replace("O", "0").replace("o", "0")
    return text


def normalize_value(text: str) -> str:
    text = clean_text(text).replace("O", "0").replace("o", "0")
    # RapidOCR 在分秒类成绩上常把小数点识别成第二个冒号，例如 1:11:24。
    # 这里统一规范成 1:11.24，后续排序与范围判断也会按秒数处理。
    if text.count(":") == 2:
        minute, second, fraction = text.split(":")
        text = f"{minute}:{second}.{fraction}"
    return text


def value_sort_key(text: str) -> float:
    return parse_value_number(text)


def score_sort_key(text: str) -> float:
    return float(normalize_score(text))


def group_cells_to_lines(cells: Iterable[OcrCell], y_tol: float = 12.0) -> list[list[OcrCell]]:
    ordered = sorted(cells, key=lambda item: (item.y, item.x))
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
        group.sort(key=lambda item: item.x)
    return groups


def nearby_text(img) -> str:
    parts: list[str] = []
    node = img
    for _ in range(80):
        node = node.previous_element
        if node is None:
            break
        if isinstance(node, NavigableString):
            text = re.sub(r"\s+", " ", str(node)).strip()
            if text and text not in {"图片"}:
                parts.append(text)
                if len(parts) >= 4:
                    break
    return " | ".join(reversed(parts))


def list_data_images(html_path: Path) -> list[dict]:
    soup = BeautifulSoup(html_path.read_text(encoding="utf-8", errors="ignore"), "html.parser")
    items: list[dict] = []
    for index, img in enumerate(soup.select("img[data-src]"), start=1):
        url = img.get("data-src", "").split("#")[0]
        items.append(
            {
                "index": index,
                "url": url,
                "caption": nearby_text(img),
            }
        )
    return items


def download_image(url: str, out_path: Path) -> None:
    if out_path.exists() and out_path.stat().st_size > 0:
        return
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(response.content)


def tokenize_numbers(text: str) -> list[str]:
    text = text.replace("O", "0").replace("o", "0")
    text = text.replace("。", ".")
    text = re.sub(r"(?<=\d)\s+\.(?=\d)", ".", text)
    text = re.sub(r"(?<=\d)\.\s+(?=\d)", ".", text)
    text = re.sub(r"(?<=\d)\s+(?=\d{2}\b)", "", text)
    # 保留分秒类 token，避免 1:11:24 被拆成 1 / 11 / 24 导致整行配对失败。
    return re.findall(r"\d+:\d+(?::\d+)?|\d+\.\d+|\d+", text)


def is_probable_ad_page(raw_text: str) -> bool:
    """识别尾页广告/咨询页，避免把非评分页误记为异常。"""
    normalized = clean_text(raw_text)
    ad_keywords = [
        "扫码添加咨询",
        "微信咨询",
        "微信公众号",
        "小程序",
        "抖音",
        "交流群",
        "王老师",
        "肖老师",
        "QQ墙号",
        "体育留学",
        "干体体育",
    ]
    hit_count = sum(keyword in normalized for keyword in ad_keywords)
    return hit_count >= 2


def parse_value_number(text: str) -> float:
    normalized = normalize_value(text)
    if ":" not in normalized:
        return float(normalized)
    parts = normalized.split(":")
    if len(parts) != 2:
        raise ValueError(f"无法解析成绩值: {text}")
    minute = int(parts[0])
    second = float(parts[1])
    return minute * 60 + second


def extract_line_tokens_from_image(image_path: Path, ocr: RapidOCR) -> tuple[list[list[str]], int, str]:
    result, _ = ocr(str(image_path))
    if not result:
        return [], 0, ""
    cells: list[OcrCell] = []
    raw_texts: list[str] = []
    for box, text, _score in result:
        x = sum(point[0] for point in box) / 4
        y = sum(point[1] for point in box) / 4
        cells.append(OcrCell(x=x, y=y, text=text))
        raw_texts.append(text)
    lines = group_cells_to_lines(cells)
    line_tokens_list: list[list[str]] = []
    for line in lines:
        line_tokens: list[str] = []
        for cell in line:
            line_tokens.extend(tokenize_numbers(cell.text))
        line_tokens_list.append(line_tokens)
    return line_tokens_list, len(result), "\n".join(raw_texts)


def infer_score_index(tokens: list[str]) -> int:
    def orientation_score(score_index: int) -> float:
        score_tokens = tokens[score_index::2]
        if not score_tokens:
            return -1.0
        parsed: list[float] = []
        for token in score_tokens[:300]:
            try:
                parsed.append(float(token))
            except ValueError:
                continue
        if not parsed:
            return -1.0
        in_score_range = sum(0.0 <= value <= 100.0 for value in parsed) / len(parsed)
        monotonic = 1.0
        if len(parsed) > 1:
            monotonic = sum(parsed[i] >= parsed[i + 1] for i in range(len(parsed) - 1)) / (len(parsed) - 1)
        high_score_bonus = 0.5 if max(parsed) >= 95 else 0.0
        return in_score_range * 2.0 + monotonic + high_score_bonus

    even_score = orientation_score(0)
    odd_score = orientation_score(1)
    return 0 if even_score >= odd_score else 1


def build_pairs_with_score_index(
    candidate_lines: list[list[str]],
    table_def: dict,
    score_index: int,
) -> tuple[list[tuple[str, str]], int]:
    """按指定列方向提取配对数据，score_index=0 表示左列为分数，1 表示右列为分数。"""
    pairs: list[tuple[str, str]] = []
    skipped_line_count = 0
    for line_tokens in candidate_lines:
        accepted_on_line = 0
        for idx in range(0, len(line_tokens), 2):
            left = line_tokens[idx]
            right = line_tokens[idx + 1]
            score = normalize_score(left if score_index == 0 else right)
            value = normalize_value(right if score_index == 0 else left)
            try:
                score_float = float(score)
                value_float = parse_value_number(value)
            except ValueError:
                continue
            if not 0.0 <= score_float <= 100.0:
                continue
            if "value_range" in table_def:
                min_value, max_value = table_def["value_range"]
                if not min_value <= value_float <= max_value:
                    continue
            pairs.append((score, value))
            accepted_on_line += 1
        if accepted_on_line == 0:
            skipped_line_count += 1
    return pairs, skipped_line_count


def build_pairs(line_tokens_list: list[list[str]], table_def: dict) -> tuple[list[tuple[str, str]], int]:
    candidate_lines = [tokens for tokens in line_tokens_list if 2 <= len(tokens) <= 6 and len(tokens) % 2 == 0]
    tokens = [token for line_tokens in candidate_lines for token in line_tokens]
    if len(tokens) % 2 != 0:
        tokens = tokens[:-1]
    if len(tokens) < 4:
        return [], 0
    preferred_score_index = infer_score_index(tokens)
    preferred_pairs, preferred_skipped = build_pairs_with_score_index(candidate_lines, table_def, preferred_score_index)
    fallback_pairs, fallback_skipped = build_pairs_with_score_index(candidate_lines, table_def, 1 - preferred_score_index)
    if len(fallback_pairs) > len(preferred_pairs):
        return fallback_pairs, fallback_skipped
    return preferred_pairs, preferred_skipped


def finalize_rows(rows: list[tuple[str, str]]) -> tuple[list[tuple[str, str]], str, str]:
    seen: set[tuple[str, str]] = set()
    unique_rows: list[tuple[str, str]] = []
    for row in rows:
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
    return sorted_rows, max_value, min_value


def write_outputs(table_def: dict, rows: list[tuple[str, str]]) -> tuple[Path, Path, dict]:
    sorted_rows, max_value, min_value = finalize_rows(rows)
    table_dir = OUTPUT_ROOT / "converted" / Path(table_def["folder"])
    table_dir.mkdir(parents=True, exist_ok=True)
    stem = sanitize_filename(f"{table_def['code']}_{table_def['title']}")
    csv_path = table_dir / f"{stem}.csv"
    json_path = table_dir / f"{stem}.json"

    with csv_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["sequence_number", "score", "value"])
        writer.writeheader()
        for idx, (score, value) in enumerate(sorted_rows, start=1):
            writer.writerow({"sequence_number": idx, "score": score, "value": value})

    payload = {
        "code": {
            "table_name": table_def["title"],
            "headers": ["score", "value"],
            "code": table_def["code"],
            "max_value": max_value,
            "min_value": min_value,
            "total": str(len(sorted_rows)),
            "data": [
                {"score": score, "value": value, "number": str(idx)}
                for idx, (score, value) in enumerate(sorted_rows, start=1)
            ],
        }
    }
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return csv_path, json_path, payload


def process_table(table_def: dict, image_cache: dict[str, list[dict]], ocr: RapidOCR) -> dict:
    html_path = HTML_ROOT / table_def["html"]
    images = image_cache[table_def["html"]]
    start, end = table_def["image_range"]
    selected = [item for item in images if start <= item["index"] <= end]

    image_dir = IMAGE_ROOT / sanitize_filename(table_def["code"])
    image_dir.mkdir(parents=True, exist_ok=True)

    all_pairs: list[tuple[str, str]] = []
    anomalies: list[str] = []
    image_paths: list[str] = []

    for item in selected:
        image_name = f"{item['index']:03d}.png"
        image_path = image_dir / image_name
        print(f"[image] {table_def['code']} downloading/ocr {item['index']} -> {image_name}", flush=True)
        download_image(item["url"], image_path)
        image_paths.append(str(image_path))
        line_tokens_list, box_count, raw_text = extract_line_tokens_from_image(image_path, ocr)
        pairs, skipped_line_count = build_pairs(line_tokens_list, table_def)
        if len(pairs) < 5:
            if is_probable_ad_page(raw_text):
                print(
                    f"[image] {table_def['code']} idx={item['index']} skipped as non-table ad page",
                    flush=True,
                )
                continue
            anomalies.append(
                f"图片 {item['index']} 抽取对数过少: pairs={len(pairs)}, lines={len(line_tokens_list)}, boxes={box_count}, caption={item['caption']}"
            )
            continue
        all_pairs.extend(pairs)
        print(
            f"[image] {table_def['code']} idx={item['index']} boxes={box_count} lines={len(line_tokens_list)} skipped_lines={skipped_line_count} pairs={len(pairs)}",
            flush=True,
        )

    if not all_pairs:
        raise RuntimeError(f"{table_def['title']} 未抽取到有效数据")

    csv_path, json_path, payload = write_outputs(table_def, all_pairs)
    return {
        "title": table_def["title"],
        "code": table_def["code"],
        "html": str(html_path),
        "image_range": f"{start}-{end}",
        "image_count": len(selected),
        "downloaded_images": image_paths,
        "csv_path": str(csv_path),
        "json_path": str(json_path),
        "total": int(payload["code"]["total"]),
        "max_value": payload["code"]["max_value"],
        "min_value": payload["code"]["min_value"],
        "anomalies": anomalies,
    }


def main() -> None:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    IMAGE_ROOT.mkdir(parents=True, exist_ok=True)

    html_files = sorted({item["html"] for item in TABLE_DEFS})
    image_cache: dict[str, list[dict]] = {}
    log_lines: list[str] = []
    top_level_anomalies: list[str] = []

    for html_name in html_files:
        html_path = HTML_ROOT / html_name
        image_cache[html_name] = list_data_images(html_path)
        log_lines.append(f"[HTML] {html_name} data_images={len(image_cache[html_name])}")

    if "湖南省体育高考之足辅评分标准（2026新版）.html" in image_cache:
        first_captions = [item["caption"] for item in image_cache["湖南省体育高考之足辅评分标准（2026新版）.html"][:3]]
        if any("立定跳远" in caption for caption in first_captions):
            top_level_anomalies.append("足辅HTML前置说明图片标题出现“立定跳远评分标准”，与正文项目不一致，已按后续真实表头范围提取。")

    requested_codes = set(sys.argv[1:]) if len(sys.argv) > 1 else None
    selected_defs = [item for item in TABLE_DEFS if requested_codes is None or item["code"] in requested_codes]
    if not selected_defs:
        raise SystemExit("未匹配到任何待处理编码。")

    ocr = RapidOCR()
    table_results: list[dict] = []
    for table_def in selected_defs:
        print(f"[table] start {table_def['code']} {table_def['title']}", flush=True)
        result = process_table(table_def, image_cache, ocr)
        table_results.append(result)
        print(f"[table] done {table_def['code']} total={result['total']}", flush=True)
        log_lines.append(
            f"[TABLE] {result['title']} code={result['code']} images={result['image_count']} total={result['total']} max={result['max_value']} min={result['min_value']}"
        )
        for anomaly in result["anomalies"]:
            log_lines.append(f"  [WARN] {anomaly}")

    summary = {
        "output_root": str(OUTPUT_ROOT),
        "html_count": len(html_files),
        "table_count": len(table_results),
        "encoding_mapping": {
            result["title"]: result["code"] for result in table_results
        },
        "tables": table_results,
        "top_level_anomalies": top_level_anomalies,
    }
    LOG_PATH.write_text("\n".join(log_lines), encoding="utf-8")
    SUMMARY_PATH.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
