"""Deeper text layer investigation on swimming PDF pages."""
from pathlib import Path
import fitz

ROOT = Path(r'c:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南')
PDF = ROOT / '按目录切分_1-88' / '按节' / '03-04_第三章_第四节_游泳_印刷页038-084.pdf'
DOC = fitz.open(PDF)

for pg in range(DOC.page_count):
    page = DOC[pg]
    
    # Try all text extraction methods
    text_raw = page.get_text("text")
    words = page.get_text("words")
    text_blocks = page.get_text("blocks")
    
    has_text = bool(text_raw.strip())
    has_words = bool(words)
    has_blocks = bool(text_blocks)
    
    if has_text or has_words:
        print(f"Page {pg+1}: text={len(text_raw)} chars, words={len(words)}, blocks={len(text_blocks)}")
        if has_text:
            # show first 150 chars
            first = text_raw[:150].replace('\n','|')
            print(f"  text: {first}")
    
    if pg >= 5 and not has_text and not has_words:
        print(f"Page {pg+1}: NO TEXT LAYER (scanned image only)")
        # Check if page has images
        imgs = page.get_images()
        print(f"  images on page: {len(imgs)}")
        break

DOC.close()
print("\nDone.")
