"""
多进程并行OCR，统计湖南省体育专业考试各项目评分点数量。
以后台进程方式运行，结果写入指定文件。
"""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor, as_completed

ROOT = Path(r"C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南")
SECTION_DIR = ROOT / "按目录切分_1-88" / "按节"
TEMP_ROOT = ROOT / "_temp_ocr_parallel"
OUTPUT_JSON = ROOT / "scoring_points_summary.json"
PROGRESS_LOG = ROOT / "_ocr_progress.log"

SECTION_ORDER = [
    ("02-01", "100米跑"),
    ("02-02", "五米三向折回跑"),
    ("03-01", "篮球往返运球单手低手投篮"),
    ("03-02", "排球对墙传球垫球"),
    ("03-03", "足球运球绕杆射门"),
    ("03-04", "游泳"),
]


def clean_text(text: str) -> str:
    text = text.strip().replace(" ", "").replace("（", "(").replace("）", ")")
    text = text.replace("：", ":").replace("，", ",").replace("O", "0").replace("o", "0")
    return text


def is_score_table_title(text: str) -> bool:
    t = clean_text(text)
    return "表" in t and "评分标准" in t and "续表" not in t


def is_continuation(title: str) -> bool:
    return clean_text(title).startswith("续表")


def is_numeric(text: str) -> bool:
    t = clean_text(text).replace(">", "").replace("<", "")
    t = t.replace("≤", "").replace("≥", "")
    if re.fullmatch(r"\d+(?::\d+(?:\.\d+)?)?", t):
        return True
    if re.fullmatch(r"\d+\.\d+", t):
        return True
    return False


def detect_gender(title: str) -> str:
    if "男" in title:
        return "男子"
    if "女" in title:
        return "女子"
    return "通用"


def process_one_section(args: tuple) -> dict:
    pdf_path_str, section_name, code, temp_dir = args

    import fitz
    from rapidocr_onnxruntime import RapidOCR

    pdf_path = Path(pdf_path_str)
    temp_dir = Path(temp_dir)
    temp_dir.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(pdf_path)
    ocr = RapidOCR()
    total_pages = doc.page_count

    tables = []
    cur_title = None
    cur_points = 0
    cur_page_start = None
    cur_page_end = None
    cur_gender = "通用"

    for idx in range(total_pages):
        page = doc.load_page(idx)
        pix = page.get_pixmap(matrix=fitz.Matrix(1.0, 1.0), alpha=False)
        tmp = temp_dir / f"pg_{idx:03d}.png"
        pix.save(tmp)
        result, _ = ocr(str(tmp))
        tmp.unlink()

        if not result:
            continue

        cells = []
        for box, text, _score in result:
            x = sum(pt[0] for pt in box) / 4
            y = sum(pt[1] for pt in box) / 4
            cells.append((x, y, text))

        cells.sort(key=lambda c: (c[1], c[0]))
        lines = []
        for c in cells:
            if not lines:
                lines.append([c])
                continue
            avg_y = sum(xx[1] for xx in lines[-1]) / len(lines[-1])
            if abs(c[1] - avg_y) <= 18:
                lines[-1].append(c)
            else:
                lines.append([c])

        page_num = idx + 1

        for line in lines:
            line.sort(key=lambda c: c[0])
            joined = "".join(clean_text(c[2]) for c in line)

            if is_score_table_title(joined):
                if cur_title is not None:
                    tables.append({
                        "table_name": cur_title,
                        "gender": cur_gender,
                        "scoring_points": cur_points,
                        "page_range": [cur_page_start, cur_page_end or cur_page_start],
                    })
                cur_title = clean_text(joined)
                cur_title = re.sub(r"^表\s*\d+", "", cur_title).strip("_- ")
                cur_gender = detect_gender(cur_title)
                cur_points = 0
                cur_page_start = page_num
                cur_page_end = None
                continue

            if is_continuation(joined):
                cur_page_end = page_num
                continue

            if cur_title is None:
                continue

            vals = [clean_text(c[2]) for c in line if is_numeric(c[2])]
            if len(vals) >= 2:
                cur_points += len(vals) // 2
                cur_page_end = page_num

    if cur_title is not None:
        tables.append({
            "table_name": cur_title,
            "gender": cur_gender,
            "scoring_points": cur_points,
            "page_range": [cur_page_start, cur_page_end or cur_page_start],
        })

    doc.close()

    total_points = sum(t["scoring_points"] for t in tables)
    return {
        "code": code,
        "name": section_name,
        "tables_count": len(tables),
        "total_scoring_points": total_points,
        "tables": tables,
    }


def main():
    start_time = time.time()
    TEMP_ROOT.mkdir(parents=True, exist_ok=True)

    pdf_files = sorted(SECTION_DIR.glob("*.pdf"))
    pdf_map = {}
    for pf in pdf_files:
        for code, _name in SECTION_ORDER:
            if pf.stem.startswith(code):
                pdf_map[code] = pf
                break

    tasks = []
    for code, name in SECTION_ORDER:
        if code not in pdf_map:
            continue
        temp_dir = TEMP_ROOT / code
        tasks.append((str(pdf_map[code]), name, code, str(temp_dir)))

    results = []
    with ProcessPoolExecutor(max_workers=6) as executor:
        future_map = {executor.submit(process_one_section, t): t[1] for t in tasks}
        for future in as_completed(future_map):
            name = future_map[future]
            try:
                result = future.result()
                results.append(result)
                elapsed = time.time() - start_time
                msg = f"[完成] {result['code']} {result['name']}: {result['tables_count']}张表, {result['total_scoring_points']}个评分点 (耗时{elapsed:.0f}s)"
                print(msg)
                sys.stdout.flush()
                with open(PROGRESS_LOG, "a", encoding="utf-8") as f:
                    f.write(msg + "\n")
            except Exception as e:
                msg = f"[错误] {name}: {e}"
                print(msg)
                sys.stdout.flush()
                with open(PROGRESS_LOG, "a", encoding="utf-8") as f:
                    f.write(msg + "\n")

    code_order = {code: i for i, (code, _) in enumerate(SECTION_ORDER)}
    results.sort(key=lambda r: code_order.get(r["code"], 999))

    grand_tables = sum(r["tables_count"] for r in results)
    grand_total = sum(r["total_scoring_points"] for r in results)

    output = {
        "document": "湖南省普通高等学校招生体育专业考试细则和评分标准（2023更新版）",
        "summary": {
            "total_tables": grand_tables,
            "total_scoring_points": grand_total,
        },
        "sections": results,
        "processing_time_seconds": round(time.time() - start_time, 1),
    }

    OUTPUT_JSON.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nJSON已输出: {OUTPUT_JSON}")

    import shutil
    if TEMP_ROOT.exists():
        shutil.rmtree(TEMP_ROOT)
        print("临时文件已清理")


if __name__ == "__main__":
    main()
