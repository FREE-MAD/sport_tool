"""Ultra-fast OCR - DPI=72."""
import sys, fitz, numpy as np, easyocr, re, time
from PIL import Image
import io

DPI = 72

reader = easyocr.Reader(['ch_sim', 'en'], gpu=False)
print(f"ready", flush=True)

path = sys.argv[1]
doc = fitz.open(path)
total = 0
t0 = time.time()

for pi in range(len(doc)):
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
