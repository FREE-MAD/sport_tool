"""Batch OCR scoring points - render all pages first, then OCR in parallel batches."""
import fitz, os, numpy as np, easyocr, re, time
from PIL import Image
import io

BASE = r'C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南\按目录切分_1-88\按节'
DPI = 150

print("Step 1: Loading easyocr...", flush=True)
t0 = time.time()
reader = easyocr.Reader(['ch_sim', 'en'], gpu=False)
print(f"Loaded in {time.time()-t0:.1f}s\n", flush=True)

def render_page(doc, pi):
    page = doc[pi]
    mat = fitz.Matrix(DPI/72, DPI/72)
    pix = page.get_pixmap(matrix=mat)
    return np.array(Image.open(io.BytesIO(pix.tobytes("png"))))

def ocr_image(arr):
    results = reader.readtext(arr, detail=0)
    return ' '.join(results)

def count_pairs(text):
    floats = re.findall(r'\d+\.\d+', text)
    return len(floats) // 2

files = sorted([f for f in os.listdir(BASE) if f.endswith('.pdf')])

print("=" * 70, flush=True)
results = []
grand_total = 0

for fn in files:
    path = os.path.join(BASE, fn)
    doc = fitz.open(path)
    npages = len(doc)
    parts = fn.replace('.pdf', '').split('_')
    event_name = parts[2]
    
    t_start = time.time()
    print(f"\n[{event_name}] {npages} pages, rendering...", flush=True)
    
    # Step A: render all pages
    rt0 = time.time()
    images = [render_page(doc, pi) for pi in range(npages)]
    print(f"  Rendered in {time.time()-rt0:.1f}s", flush=True)
    
    # Step B: OCR all pages
    total_pairs = 0
    for pi, arr in enumerate(images):
        ot0 = time.time()
        text = ocr_image(arr)
        pairs = count_pairs(text)
        total_pairs += pairs
        elapsed = time.time() - t_start
        print(f"  p{pi+1}/{npages}: {pairs:4d} pairs [{time.time()-ot0:.0f}s]", flush=True)
    
    grand_total += total_pairs
    results.append((event_name, total_pairs, npages))
    
    elapsed = time.time() - t_start
    print(f"  => {event_name}: {total_pairs} pts [{elapsed:.0f}s]", flush=True)
    doc.close()

print("\n" + "=" * 70, flush=True)
print(f"{'项目':<24} {'记分点数':>10}  {'页数':>5}", flush=True)
print("-" * 70, flush=True)
for name, pts, pages in results:
    print(f"  {name:<22} {pts:>10}  {pages:>5}", flush=True)
print("-" * 70, flush=True)
print(f"  {'合计':<22} {grand_total:>10}", flush=True)
print("DONE!", flush=True)
