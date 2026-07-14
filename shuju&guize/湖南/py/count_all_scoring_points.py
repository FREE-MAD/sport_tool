"""
从完整PDF中统计所有评分表的评分点个数（多进程加速版）。
评分点 = 评分表中每一对(分数, 成绩值)，即一个计分行。

只使用完整PDF: 湖南省普通高等学校招生体育专业考试细则和评分标准（2023更新版）-1-88.pdf
"""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor, as_completed

ROOT = Path(r"C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南")
PDF_PATH = ROOT / "湖南省普通高等学校招生体育专业考试细则和评分标准（2023更新版）-1-88.pdf"
OUTPUT_JSON = ROOT / "scoring_points_full_summary.json"
TEMP_ROOT = ROOT / "_temp_full_ocr"


def clean_text(text: str) -> str:
    text = text.strip().replace(" ", "").replace("\u3000", "")
    text = text.replace("\uff08", "(").replace("\uff09", ")")
    text = text.replace("\uff1a", ":").replace("\uff0c", ",")
    text = text.replace("O", "0").replace("o", "0")
    return text


def is_score_table_title(text: str) -> bool:
    t = clean_text(text)
    return bool(re.match(r"^表\d+", t)) and "评分标准" in t and "续表" not in t


def is_continuation(text: str) -> bool:
    return clean_text(text).startswith("续表")


def is_numeric(text: str) -> bool:
    t = clean_text(text)
    t = t.replace(">", "").replace("<", "").replace("\u2264", "").replace("\u2265", "")
    if re.fullmatch(r"\d+(?::\d+(?:\.\d+)?)?", t):
        return True
    if re.fullmatch(r"\d+\.\d+", t):
        return True
    return False


def detect_gender(title: str) -> str:
    if "男子" in title or "男生" in title:
        return "男子"
    if "女子" in title or "女生" in title:
        return "女子"
    return "通用"


def process_page_batch(args):
    """处理一批页面，返回该批次的OCR行数据"""
    pdf_path_str, start_idx, end_idx, dpi = args
    import fitz
    from rapidocr_onnxruntime import RapidOCR

    doc = fitz.open(pdf_path_str)
    ocr = RapidOCR()
    matrix = fitz.Matrix(dpi / 72, dpi / 72)

    all_page_data = []
    for idx in range(start_idx, end_idx):
        page = doc.load_page(idx)
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        # 保存到内存临时文件
        import tempfile, os
        fd, tmp_path = tempfile.mkstemp(suffix=".png")
        os.close(fd)
        pix.save(tmp_path)
        result, _ = ocr(tmp_path)
        os.unlink(tmp_path)

        page_num = idx + 1
        cells = []
        if result:
            for box, text, _score in result:
                x = sum(pt[0] for pt in box) / 4
                y = sum(pt[1] for pt in box) / 4
                cells.append((x, y, text.strip()))

        # 按行分组
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

        # 每行排序并合并文本
        joined_lines = []
        for line in lines:
            line.sort(key=lambda c: c[0])
            joined = "".join(clean_text(c[2]) for c in line)
            joined_lines.append({
                "page": page_num,
                "text": joined,
                "vals": [clean_text(c[2]) for c in line if is_numeric(c[2])],
            })

        all_page_data.append((page_num, joined_lines))

    doc.close()
    return all_page_data


def main():
    start_time = time.time()

    if not PDF_PATH.exists():
        print(f"错误: PDF文件不存在: {PDF_PATH}")
        sys.exit(1)

    print("=" * 60)
    print("湖南省体育专业考试 - 完整评分点统计（多进程版）")
    print(f"PDF: {PDF_PATH.name}")
    print("=" * 60)

    # 获取总页数
    import fitz
    doc = fitz.open(PDF_PATH)
    total_pages = doc.page_count
    doc.close()
    print(f"PDF共 {total_pages} 页")

    # 分批：每5页一个batch，用4个进程并行
    BATCH_SIZE = 5
    NUM_WORKERS = 4
    DPI = 120  # 较低DPI加速

    batches = []
    for start in range(0, total_pages, BATCH_SIZE):
        end = min(start + BATCH_SIZE, total_pages)
        batches.append((str(PDF_PATH), start, end, DPI))

    print(f"分 {len(batches)} 批，每批 {BATCH_SIZE} 页，{NUM_WORKERS} 进程并行...")
    sys.stdout.flush()

    # 并行处理
    all_results = {}
    completed = 0
    with ProcessPoolExecutor(max_workers=NUM_WORKERS) as executor:
        future_map = {executor.submit(process_page_batch, b): b for b in batches}
        for future in as_completed(future_map):
            batch = future_map[future]
            try:
                page_data = future.result()
                for page_num, lines in page_data:
                    all_results[page_num] = lines
                completed += 1
                print(f"  进度: {completed}/{len(batches)} 批完成")
                sys.stdout.flush()
            except Exception as e:
                print(f"  批次错误 (页{batch[1]+1}-{batch[2]}): {e}")
                sys.stdout.flush()

    # 按页码排序所有行
    sorted_pages = sorted(all_results.items())

    # 扫描所有行，识别评分表并统计评分点
    tables = []
    cur_title = None
    cur_points = 0
    cur_page_start = None
    cur_page_end = None
    cur_gender = "通用"

    for page_num, lines in sorted_pages:
        for line in lines:
            text = line["text"]
            vals = line["vals"]

            if is_score_table_title(text):
                if cur_title is not None:
                    tables.append({
                        "table_name": cur_title,
                        "gender": cur_gender,
                        "scoring_points": cur_points,
                        "page_range": [cur_page_start, cur_page_end or cur_page_start],
                    })
                cur_title = clean_text(text)
                cur_title = re.sub(r"^表\s*\d+", "", cur_title).strip("_- ")
                cur_gender = detect_gender(cur_title)
                cur_points = 0
                cur_page_start = page_num
                cur_page_end = None
                continue

            if is_continuation(text):
                cur_page_end = page_num
                continue

            if cur_title is None:
                continue

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

    # 输出结果
    total_points = sum(t["scoring_points"] for t in tables)
    print(f"\n{'=' * 60}")
    print(f"识别到 {len(tables)} 张评分表，共 {total_points} 个评分点")
    print("-" * 60)

    for i, t in enumerate(tables, 1):
        if t['page_range'][0] == t['page_range'][1]:
            pages = f"第{t['page_range'][0]}页"
        else:
            pages = f"第{t['page_range'][0]}-{t['page_range'][1]}页"
        print(f"  [{i:2d}] {t['table_name']}")
        print(f"       性别: {t['gender']} | 评分点: {t['scoring_points']} | {pages}")

    # 保存JSON
    output = {
        "document": "湖南省普通高等学校招生体育专业考试细则和评分标准（2023更新版）",
        "total_pages": total_pages,
        "summary": {
            "total_tables": len(tables),
            "total_scoring_points": total_points,
        },
        "tables": tables,
        "processing_time_seconds": round(time.time() - start_time, 1),
    }

    OUTPUT_JSON.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nJSON已保存: {OUTPUT_JSON}")

    import shutil
    if TEMP_ROOT.exists():
        shutil.rmtree(TEMP_ROOT, ignore_errors=True)

    print(f"总耗时: {time.time() - start_time:.1f}s")


if __name__ == "__main__":
    main()
