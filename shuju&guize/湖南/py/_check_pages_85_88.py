"""快速检查PDF第85-88页OCR内容"""
import fitz
from rapidocr_onnxruntime import RapidOCR
from pathlib import Path

ROOT = Path(r"C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南")
PDF_PATH = ROOT / "湖南省普通高等学校招生体育专业考试细则和评分标准（2023更新版）-1-88.pdf"
TEMP = ROOT / "_temp_check"

doc = fitz.open(PDF_PATH)
ocr = RapidOCR()

for idx in range(84, 88):
    page = doc.load_page(idx)
    pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
    tmp = TEMP / f"pg_{idx+1:03d}.png"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    pix.save(tmp)
    result, _ = ocr(str(tmp))
    print(f"\n=== PDF Page {idx+1} ===")
    if result:
        texts = []
        for box, text, score in result:
            texts.append(text.strip())
        for t in texts[:30]:
            print(f"  {t}")
        print(f"  ... ({len(texts)} OCR items total)")
    else:
        print("  (empty - no text detected)")
    tmp.unlink()

doc.close()

# cleanup
import shutil
if TEMP.exists():
    shutil.rmtree(TEMP)
