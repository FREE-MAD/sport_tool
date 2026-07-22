from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path


EXPORT_ROOT = Path(r"C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南\新版标准\结构化导出_2026")
CONVERTED_ROOT = EXPORT_ROOT / "converted"
IMAGE_ROOT = EXPORT_ROOT / "images"
SUMMARY_PATH = EXPORT_ROOT / "summary.json"
PROCESS_LOG_PATH = EXPORT_ROOT / "process_log.txt"


@dataclass(frozen=True)
class TableConfig:
    code: str
    table_name: str
    csv_path: Path
    json_path: Path
    start_value: str
    end_value: str
    score_decimals: int
    value_kind: str  # decimal | time


BASKETBALL_TABLES = [
    TableConfig(
        code="hunan_2026_03-01_m_001",
        table_name="篮球辅项成绩评分标准（男子）",
        csv_path=EXPORT_ROOT / "converted" / "03_辅助技术项目" / "03-01_篮球辅项" / "hunan_2026_03-01_m_001_篮球辅项成绩评分标准（男子）.csv",
        json_path=EXPORT_ROOT / "converted" / "03_辅助技术项目" / "03-01_篮球辅项" / "hunan_2026_03-01_m_001_篮球辅项成绩评分标准（男子）.json",
        start_value="13.95",
        end_value="21.75",
        score_decimals=2,
        value_kind="decimal",
    ),
    TableConfig(
        code="hunan_2026_03-01_f_002",
        table_name="篮球辅项成绩评分标准（女子）",
        csv_path=EXPORT_ROOT / "converted" / "03_辅助技术项目" / "03-01_篮球辅项" / "hunan_2026_03-01_f_002_篮球辅项成绩评分标准（女子）.csv",
        json_path=EXPORT_ROOT / "converted" / "03_辅助技术项目" / "03-01_篮球辅项" / "hunan_2026_03-01_f_002_篮球辅项成绩评分标准（女子）.json",
        start_value="15.65",
        end_value="23.45",
        score_decimals=2,
        value_kind="decimal",
    ),
]


SWIM_FIXES = [
    (
        EXPORT_ROOT / "converted" / "03_辅助技术项目" / "03-04_游泳" / "hunan_2026_03-04_f_002_游泳辅项成绩评分标准（女子）.csv",
        EXPORT_ROOT / "converted" / "03_辅助技术项目" / "03-04_游泳" / "hunan_2026_03-04_f_002_游泳辅项成绩评分标准（女子）.json",
        "1:00.151",
        "1:00.15",
    ),
]


def parse_decimal_value(text: str) -> int:
    return int((Decimal(text) * 100).to_integral_value())


def format_decimal_value(value_cs: int) -> str:
    integer = value_cs // 100
    fraction = value_cs % 100
    if fraction == 0:
        return str(integer)
    if fraction % 10 == 0:
        return f"{integer}.{fraction // 10}"
    return f"{integer}.{fraction:02d}"


def parse_time_value(text: str) -> int:
    if ":" not in text:
        return parse_decimal_value(text)
    minute, sec = text.split(":")
    return int(minute) * 6000 + int((Decimal(sec) * 100).to_integral_value())


def format_time_value(value_cs: int) -> str:
    minute, rest = divmod(value_cs, 6000)
    second = Decimal(rest) / Decimal("100")
    return f"{minute}:{second:05.2f}"


def format_score(value: Decimal, decimals: int) -> str:
    quant = Decimal("1") if decimals == 0 else Decimal("1." + ("0" * decimals))
    value = value.quantize(quant)
    if decimals == 0:
        return str(int(value))
    return f"{value:.{decimals}f}"


def load_raw_scores(csv_path: Path, config: TableConfig) -> dict[int, list[Decimal]]:
    raw_scores: dict[int, list[Decimal]] = {}
    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            try:
                value_text = row["value"]
                score = Decimal(row["score"])
                value_cs = parse_decimal_value(value_text)
            except Exception:
                continue
            if not (0 <= score <= 100):
                continue
            start_value = parse_decimal_value(config.start_value)
            end_value = parse_decimal_value(config.end_value)
            if not (start_value <= value_cs <= end_value):
                continue
            raw_scores.setdefault(value_cs, []).append(score)
    return raw_scores


def nearest_known_left(scores: list[Decimal | None], index: int) -> int | None:
    pos = index - 1
    while pos >= 0:
        if scores[pos] is not None:
            return pos
        pos -= 1
    return None


def nearest_known_right(scores: list[Decimal | None], index: int) -> int | None:
    pos = index + 1
    while pos < len(scores):
        if scores[pos] is not None:
            return pos
        pos += 1
    return None


def average(values: list[Decimal]) -> Decimal:
    return sum(values) / Decimal(len(values))


def interpolate_segment(scores: list[Decimal | None], left: int, right: int) -> None:
    left_score = scores[left]
    right_score = scores[right]
    if left_score is None or right_score is None:
        return
    span = Decimal(right - left)
    step = (right_score - left_score) / span
    for pos in range(left + 1, right):
        scores[pos] = left_score + step * Decimal(pos - left)


def repair_basketball_rows(config: TableConfig) -> list[tuple[str, str]]:
    start_value = parse_decimal_value(config.start_value)
    end_value = parse_decimal_value(config.end_value)
    value_axis = list(range(start_value, end_value + 1))
    raw_scores = load_raw_scores(config.csv_path, config)
    scores: list[Decimal | None] = []

    for value_cs in value_axis:
        candidates = raw_scores.get(value_cs, [])
        scores.append(average(candidates) if candidates else None)

    for _ in range(8):
        changed = False
        for idx, score in enumerate(scores):
            if score is None:
                continue
            left = nearest_known_left(scores, idx)
            right = nearest_known_right(scores, idx)
            if left is None or right is None:
                continue
            left_score = scores[left]
            right_score = scores[right]
            if left_score is None or right_score is None:
                continue
            expected = left_score + (right_score - left_score) * Decimal(idx - left) / Decimal(right - left)
            # 只剔除明显错位值，例如 0、2.80 这类 OCR 脏点，不动正常分段斜率变化。
            if abs(score - expected) > Decimal("0.6"):
                scores[idx] = None
                changed = True

        idx = 0
        while idx < len(scores):
            if scores[idx] is not None:
                idx += 1
                continue
            gap_start = idx
            while idx < len(scores) and scores[idx] is None:
                idx += 1
            gap_end = idx
            left = gap_start - 1
            right = gap_end
            if left >= 0 and right < len(scores):
                interpolate_segment(scores, left, right)
                changed = True

        if not changed:
            break

    if any(score is None for score in scores):
        raise RuntimeError(f"{config.code} 仍存在未修复的空洞")

    rows: list[tuple[str, str]] = []
    previous_score: Decimal | None = None
    for value_cs, score in zip(value_axis, scores):
        assert score is not None
        rounded = score.quantize(Decimal("1.00"))
        if previous_score is not None and rounded > previous_score:
            raise RuntimeError(f"{config.code} 分数序列发生反向增长: {format_decimal_value(value_cs)}")
        rows.append((format_score(rounded, config.score_decimals), format_decimal_value(value_cs)))
        previous_score = rounded
    return rows


def write_csv(csv_path: Path, rows: list[tuple[str, str]]) -> None:
    with csv_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["sequence_number", "score", "value"])
        writer.writeheader()
        for index, (score, value) in enumerate(rows, start=1):
            writer.writerow({"sequence_number": index, "score": score, "value": value})


def write_json(config: TableConfig, rows: list[tuple[str, str]]) -> None:
    payload = {
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
    config.json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def repair_basketball_tables() -> None:
    for config in BASKETBALL_TABLES:
        rows = repair_basketball_rows(config)
        write_csv(config.csv_path, rows)
        write_json(config, rows)
        print(f"[basketball] repaired {config.code} total={len(rows)}")


def repair_swim_typo(csv_path: Path, json_path: Path, old_value: str, new_value: str) -> None:
    csv_rows: list[dict[str, str]] = []
    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            if row["value"] == old_value:
                row["value"] = new_value
            csv_rows.append(row)

    with csv_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["sequence_number", "score", "value"])
        writer.writeheader()
        writer.writerows(csv_rows)

    payload = json.loads(json_path.read_text(encoding="utf-8"))
    for row in payload["code"]["data"]:
        if row["value"] == old_value:
            row["value"] = new_value
    payload["code"]["max_value"] = payload["code"]["data"][0]["value"]
    payload["code"]["min_value"] = payload["code"]["data"][-1]["value"]
    payload["code"]["total"] = str(len(payload["code"]["data"]))
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[swim] fixed typo {json_path.name}: {old_value} -> {new_value}")


def rebuild_summary() -> None:
    tables: list[dict] = []
    log_lines: list[str] = []

    for json_path in sorted(CONVERTED_ROOT.rglob("*.json")):
        csv_path = json_path.with_suffix(".csv")
        payload = json.loads(json_path.read_text(encoding="utf-8"))["code"]
        code = str(payload.get("code", ""))
        image_dir = IMAGE_ROOT / code
        downloaded_images = []
        if image_dir.exists():
            downloaded_images = [str(path) for path in sorted(image_dir.glob("*.png"))]

        entry = {
            "title": payload.get("table_name", ""),
            "code": code,
            "json_path": str(json_path),
            "csv_path": str(csv_path),
            "total": int(payload.get("total", "0")),
            "max_value": payload.get("max_value", ""),
            "min_value": payload.get("min_value", ""),
            "image_count": len(downloaded_images),
            "downloaded_images": downloaded_images,
            "anomalies": [],
        }
        tables.append(entry)
        log_lines.append(
            f"[TABLE] {entry['title']} code={entry['code']} images={entry['image_count']} total={entry['total']} max={entry['max_value']} min={entry['min_value']}"
        )

    summary = {
        "output_root": str(EXPORT_ROOT),
        "table_count": len(tables),
        "encoding_mapping": {item["title"]: item["code"] for item in tables},
        "tables": tables,
        "top_level_anomalies": [],
    }
    SUMMARY_PATH.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    PROCESS_LOG_PATH.write_text("\n".join(log_lines) + "\n", encoding="utf-8")
    print(f"[summary] rebuilt table_count={len(tables)}")


def main() -> None:
    repair_basketball_tables()
    for csv_path, json_path, old_value, new_value in SWIM_FIXES:
        repair_swim_typo(csv_path, json_path, old_value, new_value)
    rebuild_summary()


if __name__ == "__main__":
    main()
