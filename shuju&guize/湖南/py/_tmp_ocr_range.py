"""OCR specific page range. Usage: python _tmp_ocr_range.py <pdf> <start_page> <end_page>"""
import sys, fitz, numpy as np, easyocr, re, time
from PIL import Image
import io

DPI = 100
path = sys.argv[1]
start = int(sys.argv[2]) - 1  # 1-based to 0-based
end = int(sys.argv[3])  # 1-based inclusive

reader = easyocr.Reader(['ch_sim', 'en'], gpu=False)
print(f"ready [{start+1}-{end}]", flush=True)

doc = fitz.open(path)
total = 0
t0 = time.time()

for pi in range(start, min(end, len(doc))):
    page = doc[pi]
    mat = fitz.Matrix(DPI/72, DPI/72)
    pix = page.get_pixmap(matrix=mat)
    arr = np.array(Image.open(io.BytesIO(pix.tobytes("png"))))
    text = ' '.join(reader.readtext(arr, detail=0))
    pairs = len(re.findall(r'\d+\.\d+', text)) // 2
    total += pairs
    print(f"p{pi+1}/{len(doc)}: {pairs} [{time.time()-t0:.0f}s]", flush=True)

print(f"TOTAL={total}", flush=True)
doc.close()
