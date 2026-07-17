"""Process all remaining PDFs one by one, save results incrementally."""
import fitz, os, numpy as np, easyocr, re, time, json
from PIL import Image
import io

BASE = r'C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南\按目录切分_1-88\按节'
DPI = 150
RESULT_FILE = r'C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南\_tmp_ocr_results.json'

# Load existing results if any
if os.path.exists(RESULT_FILE):
    with open(RESULT_FILE, 'r', encoding='utf-8') as f:
        results = json.load(f)
else:
    results = {}

# Files to process
files = sorted([f for f in os.listdir(BASE) if f.endswith('.pdf')])
parts_map = {f.split('_')[2]: f for f in files}

print("Loading easyocr...", flush=True)
reader = easyocr.Reader(['ch_sim', 'en'], gpu=False)
print("Loaded.", flush=True)

def process_pdf(path):
    doc = fitz.open(path)
    total = 0
    for pi in range(len(doc)):
        page = doc[pi]
        mat = fitz.Matrix(DPI/72, DPI/72)
        pix = page.get_pixmap(matrix=mat)
        arr = np.array(Image.open(io.BytesIO(pix.tobytes("png"))))
        text = ' '.join(reader.readtext(arr, detail=0))
        pairs = len(re.findall(r'\d+\.\d+', text)) // 2
        total += pairs
        print(f"  p{pi+1}/{len(doc)}: {pairs} pairs", flush=True)
    doc.close()
    return total

for fn in files:
    event = fn.split('_')[2]
    if event in results:
        print(f"[SKIP] {event} - already done", flush=True)
        continue
    
    path = os.path.join(BASE, fn)
    print(f"\n[{event}] Processing ({len(fitz.open(path))} pages)...", flush=True)
    t0 = time.time()
    pts = process_pdf(path)
    elapsed = time.time() - t0
    results[event] = pts
    print(f"  => {event}: {pts} pts [{elapsed:.0f}s]", flush=True)
    
    # Save after each file
    with open(RESULT_FILE, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

# Final summary
print("\n" + "=" * 70, flush=True)
grand = 0
for event in sorted(results.keys()):
    pts = results[event]
    grand += pts
    print(f"  {event:<20} {pts:>8}", flush=True)
print("-" * 70, flush=True)
print(f"  {'合计':<20} {grand:>8}", flush=True)
