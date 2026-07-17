"""Count scoring points from scanned PDFs using easyocr.
NO CSV/JSON used - pure OCR from PDF images."""
import fitz, os, numpy as np, easyocr, re
from PIL import Image
import io, time

BASE = r'C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南\按目录切分_1-88\按节'
DPI = 150

print("Loading easyocr (chi_sim+en, CPU)...", flush=True)
t0 = time.time()
reader = easyocr.Reader(['ch_sim', 'en'], gpu=False)
print(f"Loaded in {time.time()-t0:.1f}s\n", flush=True)

def ocr_page(doc, page_idx):
    page = doc[page_idx]
    mat = fitz.Matrix(DPI/72, DPI/72)
    pix = page.get_pixmap(matrix=mat)
    img_data = pix.tobytes("png")
    img = Image.open(io.BytesIO(img_data))
    arr = np.array(img)
    results = reader.readtext(arr, detail=0)
    return ' '.join(results)

def count_pairs(text):
    """Count (score, result) pairs = number of floats / 2"""
    floats = re.findall(r'\d+\.\d+', text)
    return len(floats) // 2

def detect_genders(text):
    """Return set of genders found in text"""
    genders = set()
    if '男子' in text or '男' in text:
        genders.add('M')
    if '女子' in text or '女' in text:
        genders.add('F')
    if '男、女' in text or '男女' in text:
        genders.update(['M', 'F'])
    return genders

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
    
    # Gather all text page by page
    all_text_parts = []
    for pi in range(npages):
        print(f"  [{fn[:30]}...] OCR page {pi+1}/{npages}...", end=' ', flush=True)
        pt0 = time.time()
        text = ocr_page(doc, pi)
        all_text_parts.append(text)
        pairs = count_pairs(text)
        g = detect_genders(text)
        pt_elapsed = time.time() - pt0
        elapsed = time.time() - t_start
        eta = (elapsed / (pi+1)) * (npages - pi - 1)
        print(f"{pairs:4d} pairs, gender={g or '?'}  [{pt_elapsed:.0f}s, ETA {eta:.0f}s]", flush=True)
    
    # Determine overall genders for this PDF
    full_text = ' '.join(all_text_parts)
    has_m = '男子' in full_text or re.search(r'(?<![女])男(?!子)', full_text)
    has_f = '女子' in full_text
    
    # Count pairs from all pages (simple total)
    total_pairs = sum(count_pairs(t) for t in all_text_parts)
    grand_total += total_pairs
    
    gender_str = ''
    if has_m and has_f:
        gender_str = '(男女)'
    elif has_m:
        gender_str = '(男)'
    elif has_f:
        gender_str = '(女)'
    
    results.append((event_name, total_pairs, npages, gender_str))
    
    elapsed = time.time() - t_start
    print(f"  => {event_name}: TOTAL={total_pairs} pts  [{npages}p, {elapsed:.0f}s]", flush=True)
    print(flush=True)
    doc.close()

# Final summary
print()
print("=" * 70, flush=True)
print(f"{'项目':<24} {'记分点数':>10}  {'页数':>5}  性别", flush=True)
print("-" * 70, flush=True)
for name, pts, pages, g in results:
    print(f"  {name:<22} {pts:>10}  {pages:>5}  {g}", flush=True)
print("-" * 70, flush=True)
print(f"  {'合计':<22} {grand_total:>10}", flush=True)
print()
print("DONE!", flush=True)
