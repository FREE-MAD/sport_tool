from __future__ import annotations

import argparse
import json
from pathlib import Path

from PyPDF2 import PdfReader, PdfWriter


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Split one printed-page range from a PDF.")
    parser.add_argument("--source", required=True, help="Absolute path to the source PDF.")
    parser.add_argument("--output-dir", required=True, help="Absolute path to the output folder.")
    parser.add_argument("--order", required=True, help="Order label, e.g. 04-01.")
    parser.add_argument("--title", required=True, help="Section title, e.g. 第四章_第一节_田径.")
    parser.add_argument("--printed-start", type=int, required=True, help="Printed start page.")
    parser.add_argument("--printed-end", type=int, required=True, help="Printed end page.")
    parser.add_argument("--page-offset", type=int, default=4, help="Printed to PDF page offset.")
    return parser


def main() -> None:
    args = build_parser().parse_args()

    source = Path(args.source)
    output_dir = Path(args.output_dir)
    section_dir = output_dir / "\u6309\u8282"
    output_dir.mkdir(parents=True, exist_ok=True)
    section_dir.mkdir(parents=True, exist_ok=True)

    reader = PdfReader(str(source))
    start_zero = args.printed_start + args.page_offset - 1
    end_zero = args.printed_end + args.page_offset - 1

    if start_zero < 0 or end_zero >= len(reader.pages) or start_zero > end_zero:
        raise ValueError(
            f"Invalid range: printed {args.printed_start}-{args.printed_end}, "
            f"pdf {start_zero + 1}-{end_zero + 1}, total {len(reader.pages)}"
        )

    output_pdf = (
        section_dir
        / f"{args.order}_{args.title}_\u5370\u5237\u9875{args.printed_start:03d}-{args.printed_end:03d}.pdf"
    )

    writer = PdfWriter()
    for page_index in range(start_zero, end_zero + 1):
        writer.add_page(reader.pages[page_index])
    with output_pdf.open("wb") as f:
        writer.write(f)

    manifest = {
        "source_pdf": str(source),
        "page_offset": args.page_offset,
        "total_pdf_pages": len(reader.pages),
        "section_items": [
            {
                "kind": "section",
                "order": args.order,
                "title": args.title,
                "start_printed": args.printed_start,
                "end_printed": args.printed_end,
                "start_pdf": start_zero + 1,
                "end_pdf": end_zero + 1,
                "output_file": str(output_pdf),
                "page_count": end_zero - start_zero + 1,
            }
        ],
    }

    (output_dir / "split_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    log_lines = [
        f"\u6e90\u6587\u4ef6: {source}",
        f"\u8f93\u51fa\u76ee\u5f55: {output_dir}",
        f"\u76ee\u5f55\u9875\u504f\u79fb: +{args.page_offset}",
        "",
        "[\u6309\u8282]",
        (
            f"{args.order} | section | {args.title} | "
            f"\u5370\u5237\u9875 {args.printed_start}-{args.printed_end} | "
            f"PDF\u9875 {start_zero + 1}-{end_zero + 1} | "
            f"{end_zero - start_zero + 1} \u9875"
        ),
    ]
    (output_dir / "split_manifest.txt").write_text("\n".join(log_lines), encoding="utf-8")

    print(output_pdf)
    print(f"page_count={end_zero - start_zero + 1}")
    print(f"pdf_range={start_zero + 1}-{end_zero + 1}")


if __name__ == "__main__":
    main()
