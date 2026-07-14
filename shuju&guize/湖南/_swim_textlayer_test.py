"""
Test: extract swimming pages using fitz's structured text (dict/words) mode.
This preserves positional info - even if text values are corrupted,
the cell grid structure should be correct, allowing proper table reconstruction.
"""
from pathlib import Path
import fitz, json, csv, re

ROOT = Path(r'c:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南')
PDF = ROOT / '按目录切分_1-88' / '按节' / '03-04_第三章_第四节_游泳_印刷页038-084.pdf'

doc = fitz.open(PDF)
print(f"PDF pages: {doc.page_count}")

# Test pages 2-5 (where the table should be)
for pg in [1, 2, 3, 4]:  # 0-indexed
    page = doc[pg]
    print(f"\n=== Page {pg+1} ===")
    
    # Method 1: dict (blocks -> lines -> spans)
    d = page.get_text("dict")
    for block in d['blocks']:
        if block['type'] != 0:  # text block
            continue
        for line in block['lines']:
            spans_text = []
            for span in line['spans']:
                spans_text.append(span['text'])
            full = ''.join(spans_text).strip()
            if full:
                print(f"  [{line['bbox'][1]:.0f}] {full[:120]}")

doc.close()
