from __future__ import annotations

from pathlib import Path
from typing import List, Dict
import json
import re

from PyPDF2 import PdfReader, PdfWriter


PDF_PATH = Path(
    r"C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南\湖南省普通高等学校招生体育专业考试细则和评分标准（2023更新版）-1-88.pdf"
)
OUTPUT_DIR = PDF_PATH.parent / "按目录切分_1-88"
PAGE_OFFSET = 4  # 目录页码 1 -> PDF 第 5 页
MAX_PRINTED_PAGE = 84  # 当前 PDF 最后一页对应印刷页码 -84-


CHAPTER_ITEMS: List[Dict[str, str | int]] = [
    {"kind": "chapter", "order": "01", "title": "第一章_考试项目及分值设置", "start": 1},
    {"kind": "chapter", "order": "02", "title": "第二章_身体素质项目", "start": 2},
    {"kind": "chapter", "order": "03", "title": "第三章_辅助技术项目", "start": 15},
]


SECTION_ITEMS: List[Dict[str, str | int]] = [
    {"kind": "section", "order": "02-01", "title": "第二章_第一节_100米跑", "start": 2},
    {"kind": "section", "order": "02-02", "title": "第二章_第二节_五米三向折回跑", "start": 9},
    {"kind": "section", "order": "03-01", "title": "第三章_第一节_篮球往返运球单手低手投篮", "start": 15},
    {"kind": "section", "order": "03-02", "title": "第三章_第二节_排球对墙传球垫球", "start": 29},
    {"kind": "section", "order": "03-03", "title": "第三章_第三节_足球运球绕杆射门", "start": 31},
    {"kind": "section", "order": "03-04", "title": "第三章_第四节_游泳", "start": 38},
]


def sanitize_filename(name: str) -> str:
    return re.sub(r'[<>:"/\\|?*]', "_", name)


def printed_to_pdf_zero_based(printed_page: int) -> int:
    return printed_page + PAGE_OFFSET - 1


def build_ranges(items: List[Dict[str, str | int]]) -> List[Dict[str, str | int]]:
    sorted_items = sorted(items, key=lambda x: int(x["start"]))
    ranges: List[Dict[str, str | int]] = []
    for index, item in enumerate(sorted_items):
        start = int(item["start"])
        next_start = (
            int(sorted_items[index + 1]["start"])
            if index + 1 < len(sorted_items)
            else MAX_PRINTED_PAGE + 1
        )
        end = min(next_start - 1, MAX_PRINTED_PAGE)
        if start > MAX_PRINTED_PAGE or start > end:
            continue
        ranges.append(
            {
                "kind": item["kind"],
                "order": item["order"],
                "title": item["title"],
                "start_printed": start,
                "end_printed": end,
                "start_pdf": printed_to_pdf_zero_based(start) + 1,
                "end_pdf": printed_to_pdf_zero_based(end) + 1,
            }
        )
    return ranges


def write_split_pdf(reader: PdfReader, out_path: Path, start_zero: int, end_zero: int) -> None:
    writer = PdfWriter()
    for page_index in range(start_zero, end_zero + 1):
        writer.add_page(reader.pages[page_index])
    with out_path.open("wb") as f:
        writer.write(f)


def main() -> None:
    OUTPUT_DIR.mkdir(exist_ok=True)
    chapter_dir = OUTPUT_DIR / "按章"
    section_dir = OUTPUT_DIR / "按节"
    chapter_dir.mkdir(exist_ok=True)
    section_dir.mkdir(exist_ok=True)

    reader = PdfReader(str(PDF_PATH))
    chapter_ranges = build_ranges(CHAPTER_ITEMS)
    section_ranges = build_ranges(SECTION_ITEMS)

    manifest = {
        "source_pdf": str(PDF_PATH),
        "page_offset": PAGE_OFFSET,
        "max_printed_page_in_current_pdf": MAX_PRINTED_PAGE,
        "total_pdf_pages": len(reader.pages),
        "chapter_items": [],
        "section_items": [],
    }

    for item in chapter_ranges:
        start_zero = printed_to_pdf_zero_based(int(item["start_printed"]))
        end_zero = printed_to_pdf_zero_based(int(item["end_printed"]))
        file_name = (
            f"{item['order']}_{sanitize_filename(str(item['title']))}"
            f"_印刷页{int(item['start_printed']):03d}-{int(item['end_printed']):03d}.pdf"
        )
        out_path = chapter_dir / file_name
        write_split_pdf(reader, out_path, start_zero, end_zero)
        manifest["chapter_items"].append(
            {
                **item,
                "output_file": str(out_path),
                "page_count": end_zero - start_zero + 1,
            }
        )

    for item in section_ranges:
        start_zero = printed_to_pdf_zero_based(int(item["start_printed"]))
        end_zero = printed_to_pdf_zero_based(int(item["end_printed"]))
        file_name = (
            f"{item['order']}_{sanitize_filename(str(item['title']))}"
            f"_印刷页{int(item['start_printed']):03d}-{int(item['end_printed']):03d}.pdf"
        )
        out_path = section_dir / file_name
        write_split_pdf(reader, out_path, start_zero, end_zero)
        manifest["section_items"].append(
            {
                **item,
                "output_file": str(out_path),
                "page_count": end_zero - start_zero + 1,
            }
        )

    manifest_path = OUTPUT_DIR / "split_manifest.json"
    with manifest_path.open("w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    log_lines = [
        f"源文件: {PDF_PATH}",
        f"输出目录: {OUTPUT_DIR}",
        f"目录页偏移: +{PAGE_OFFSET}",
        f"当前文件覆盖的最后印刷页: {MAX_PRINTED_PAGE}",
        "",
        "[按章]",
    ]
    for item in manifest["chapter_items"]:
        log_lines.append(
            f"{item['order']} | {item['kind']} | {item['title']} | "
            f"印刷页 {item['start_printed']}-{item['end_printed']} | "
            f"PDF页 {item['start_pdf']}-{item['end_pdf']} | "
            f"{item['page_count']} 页"
        )

    log_lines.extend([
        "",
        "[按节]",
    ])
    for item in manifest["section_items"]:
        log_lines.append(
            f"{item['order']} | {item['kind']} | {item['title']} | "
            f"印刷页 {item['start_printed']}-{item['end_printed']} | "
            f"PDF页 {item['start_pdf']}-{item['end_pdf']} | "
            f"{item['page_count']} 页"
        )

    log_path = OUTPUT_DIR / "split_manifest.txt"
    log_path.write_text("\n".join(log_lines), encoding="utf-8")

    print(f"输出目录: {OUTPUT_DIR}")
    print(
        "生成文件数: "
        f"按章 {len(manifest['chapter_items'])} 个, "
        f"按节 {len(manifest['section_items'])} 个"
    )
    print(f"清单文件: {manifest_path}")


if __name__ == "__main__":
    main()
