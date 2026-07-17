from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from json import JSONDecoder
from pathlib import Path


@dataclass(frozen=True)
class TableConfig:
    code: str
    table_name: str
    csv_name: str
    json_name: str
    start_value: str
    end_value: str


TABLES = [
    TableConfig(
        code="hunan_2023_03-04_m_001",
        table_name="游泳辅项成绩评分标准(男子)",
        csv_name="hunan_2023_03-04_m_001_游泳辅项成绩评分标准(男子).csv",
        json_name="hunan_2023_03-04_m_001_游泳辅项成绩评分标准(男子).json",
        start_value="40.00",
        end_value="01:28.50",
    ),
    TableConfig(
        code="hunan_2023_03-04_f_002",
        table_name="游泳辅项成绩评分标准(女子)",
        csv_name="hunan_2023_03-04_f_002_游泳辅项成绩评分标准(女子).csv",
        json_name="hunan_2023_03-04_f_002_游泳辅项成绩评分标准(女子).json",
        start_value="55.00",
        end_value="01:44.67",
    ),
]


def parse_value_to_cs(value: str) -> int:
    if ":" in value:
        minutes, seconds = value.split(":")
        return int(minutes) * 6000 + int(round(float(seconds) * 100))
    return int(round(float(value) * 100))


def format_value_from_cs(value_cs: int) -> str:
    minutes, remainder = divmod(value_cs, 6000)
    seconds = remainder / 100
    if minutes:
        return f"{minutes:02d}:{seconds:05.2f}"
    return f"{seconds:05.2f}"


def load_raw_scores(csv_path: Path) -> dict[int, list[float]]:
    raw_scores: dict[int, list[float]] = {}
    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            try:
                value_cs = parse_value_to_cs(row["value"])
                score = float(row["score"])
            except (KeyError, TypeError, ValueError):
                continue
            raw_scores.setdefault(value_cs, []).append(score)
    return raw_scores


def nearest_known_left(scores: list[float | None], index: int) -> int | None:
    pos = index - 1
    while pos >= 0:
        if scores[pos] is not None:
            return pos
        pos -= 1
    return None


def nearest_known_right(scores: list[float | None], index: int) -> int | None:
    pos = index + 1
    while pos < len(scores):
        if scores[pos] is not None:
            return pos
        pos += 1
    return None


def interpolate_segment(scores: list[float | None], left: int, right: int) -> None:
    left_score = scores[left]
    right_score = scores[right]
    if left_score is None or right_score is None:
        return
    span = right - left
    step = (right_score - left_score) / span
    for pos in range(left + 1, right):
        scores[pos] = left_score + step * (pos - left)


def repair_scores(raw_scores: dict[int, list[float]], start_cs: int, end_cs: int) -> list[tuple[str, str]]:
    value_axis = list(range(start_cs, end_cs + 1))
    scores: list[float | None] = []

    for value_cs in value_axis:
        candidates = [
            candidate
            for candidate in raw_scores.get(value_cs, [])
            if 0.0 <= candidate <= 100.0
        ]
        scores.append(candidates[0] if candidates else None)

    for _ in range(6):
        changed = False

        for idx, score in enumerate(scores):
            if score is None:
                continue
            left = nearest_known_left(scores, idx)
            right = nearest_known_right(scores, idx)
            if left is None or right is None:
                continue
            expected = scores[left] + (scores[right] - scores[left]) * (idx - left) / (right - left)
            if abs(score - expected) > 0.051:
                scores[idx] = None
                changed = True

        idx = 0
        while idx < len(scores):
            if scores[idx] is not None:
                idx += 1
                continue
            start_gap = idx
            while idx < len(scores) and scores[idx] is None:
                idx += 1
            end_gap = idx
            left = start_gap - 1
            right = end_gap
            if left >= 0 and right < len(scores):
                interpolate_segment(scores, left, right)
                changed = True

        if not changed:
            break

    if any(score is None for score in scores):
        raise RuntimeError("仍有未修复的分数空洞")

    repaired: list[tuple[str, str]] = []
    previous_score: float | None = None
    for value_cs, score in zip(value_axis, scores):
        rounded_score = round(score + 1e-8, 2)
        if previous_score is not None and rounded_score > previous_score:
            raise RuntimeError(f"分数序列出现反向增长: {format_value_from_cs(value_cs)}")
        repaired.append((f"{rounded_score:.2f}", format_value_from_cs(value_cs)))
        previous_score = rounded_score
    return repaired


def write_csv(csv_path: Path, rows: list[tuple[str, str]]) -> None:
    with csv_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["sequence_number", "score", "value"])
        for index, (score, value) in enumerate(rows, start=1):
            writer.writerow([index, score, value])


def build_json_payload(config: TableConfig, rows: list[tuple[str, str]]) -> dict:
    return {
        "code": {
            "table_name": config.table_name,
            "headers": ["score", "value"],
            "code": config.code,
            "max_value": rows[0][1],
            "min_value": rows[-1][1],
            "total": str(len(rows)),
            "data": [
                {"score": score, "value": value, "number": str(index)}
                for index, (score, value) in enumerate(rows, start=1)
            ],
        }
    }


def write_json(json_path: Path, payload: dict) -> None:
    json_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def load_json_stream(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    decoder = JSONDecoder()
    items: list[dict] = []
    index = 0
    while index < len(text):
        while index < len(text) and text[index].isspace():
            index += 1
        if index >= len(text):
            break
        item, index = decoder.raw_decode(text, index)
        items.append(item)
    return items


def write_json_stream(path: Path, items: list[dict]) -> None:
    content = "\n".join(json.dumps(item, ensure_ascii=False, indent=2) for item in items)
    path.write_text(content + "\n", encoding="utf-8")


def main() -> None:
    export_root = Path(__file__).resolve().parent.parent.parent
    csv_root = export_root / "csv"
    json_root = export_root / "json" / "03_辅助技术项目" / "03-04_游泳"
    all_tables_path = export_root / "all_tables.jsonl"

    payloads_by_code: dict[str, dict] = {}

    for config in TABLES:
        csv_path = csv_root / config.csv_name
        json_path = json_root / config.json_name
        start_cs = parse_value_to_cs(config.start_value)
        end_cs = parse_value_to_cs(config.end_value)

        rows = repair_scores(load_raw_scores(csv_path), start_cs, end_cs)
        write_csv(csv_path, rows)
        payload = build_json_payload(config, rows)
        write_json(json_path, payload)
        payloads_by_code[config.code] = payload

        print(
            f"{config.code}: total={len(rows)} max_value={rows[0][1]} min_value={rows[-1][1]}"
        )

    all_items = load_json_stream(all_tables_path)
    replaced_codes = set()
    for index, item in enumerate(all_items):
        code = item.get("code", {}).get("code")
        if code in payloads_by_code:
            all_items[index] = payloads_by_code[code]
            replaced_codes.add(code)
    missing_codes = sorted(set(payloads_by_code) - replaced_codes)
    if missing_codes:
        raise RuntimeError(f"all_tables.jsonl 未找到目标 code: {missing_codes}")
    write_json_stream(all_tables_path, all_items)
    print("all_tables.jsonl updated")


if __name__ == "__main__":
    main()
