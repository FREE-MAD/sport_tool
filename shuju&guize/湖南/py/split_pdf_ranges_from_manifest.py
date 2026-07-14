from __future__ import annotations

import argparse
import json
from pathlib import Path

from PyPDF2 import PdfReader, PdfWriter


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Split multiple printed-page ranges from a PDF.")
    parser.add_argument("--source", required=True, help="Absolute path to the source PDF.")
    parser.add_argument("--output-dir", required=True, help="Absolute path to the output folder.")
    parser.add_argument("--manifest", required=True, help="Absolute path to a JSON manifest.")
    parser.add_argument("--page-offset", type=int, default=4, help="Printed to PDF page offset.")
    parser.add_argument("--subdir", default="按表", help="Output subdirectory for generated PDFs.")
    parser.add_argument(
        "--manifest-prefix",
        default="table_split_manifest",
        help="Prefix for generated manifest files.",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()

    source = Path(args.source)
    output_dir = Path(args.output_dir)
    manifest_path = Path(args.manifest)
    split_dir = output_dir / args.subdir

    output_dir.mkdir(parents=True, exist_ok=True)
    split_dir.mkdir(parents=True, exist_ok=True)

    items = json.loads(manifest_path.read_text(encoding="utf-8"))
    reader = PdfReader(str(source))

    result = {
        "source_pdf": str(source),
        "page_offset": args.page_offset,
        "total_pdf_pages": len(reader.pages),
        "output_subdir": str(split_dir),
        "items": [],
    }
    log_lines = [
        f"源文件: {source}",
        f"输出目录: {output_dir}",
        f"子目录: {split_dir}",
        f"目录页偏移: +{args.page_offset}",
        "",
        "[items]",
    ]

    for item in items:
        printed_start = int(item["printed_start"])
        printed_end = int(item["printed_end"])
        start_zero = printed_start + args.page_offset - 1
        end_zero = printed_end + args.page_offset - 1

        if start_zero < 0 or end_zero >= len(reader.pages) or start_zero > end_zero:
            raise ValueError(
                f"Invalid range for {item['order']}: printed {printed_start}-{printed_end}, "
                f"pdf {start_zero + 1}-{end_zero + 1}, total {len(reader.pages)}"
            )

        output_pdf = (
            split_dir
            / f"{item['order']}_{item['title']}_印刷页{printed_start:03d}-{printed_end:03d}.pdf"
        )

        writer = PdfWriter()
        for page_index in range(start_zero, end_zero + 1):
            writer.add_page(reader.pages[page_index])
        with output_pdf.open("wb") as f:
            writer.write(f)

        result_item = {
            "kind": item.get("kind", "table"),
            "order": item["order"],
            "title": item["title"],
            "start_printed": printed_start,
            "end_printed": printed_end,
            "start_pdf": start_zero + 1,
            "end_pdf": end_zero + 1,
            "output_file": str(output_pdf),
            "page_count": end_zero - start_zero + 1,
        }
        result["items"].append(result_item)
        log_lines.append(
            f"{result_item['order']} | {result_item['kind']} | {result_item['title']} | "
            f"印刷页 {printed_start}-{printed_end} | "
            f"PDF页 {start_zero + 1}-{end_zero + 1} | "
            f"{result_item['page_count']} 页"
        )

    json_out = output_dir / f"{args.manifest_prefix}.json"
    txt_out = output_dir / f"{args.manifest_prefix}.txt"
    json_out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    txt_out.write_text("\n".join(log_lines), encoding="utf-8")

    print(split_dir)
    print(f"generated={len(result['items'])}")
    print(json_out)
    print(txt_out)


if __name__ == "__main__":
    main()
