import fitz, os, numpy as np, easyocr
from PIL import Image
import io

BASE = r'C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南\按目录切分_1-88\按节'

# Initialize reader once
reader = easyocr.Reader(['ch_sim', 'en'], gpu=False)

# Test 100m page 2
path = os.path.join(BASE, '02-01_第二章_第一节_100米跑_印刷页002-008.pdf')
doc = fitz.open(path)

page = doc[1]  # page index 1 = printed page 2
print(f"Processing page 2/7 of 100m run...")

mat = fitz.Matrix(200/72, 200/72)
pix = page.get_pixmap(matrix=mat)
img_data = pix.tobytes("png")
img = Image.open(io.BytesIO(img_data))
arr = np.array(img)

results = reader.readtext(arr)
texts = [r[1] for r in results]
for t in texts[:30]:
    print(f"  {t}")
print(f"... ({len(texts)} text blocks total)")

doc.close()
