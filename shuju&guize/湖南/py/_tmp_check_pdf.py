import pdfplumber, os

base = r'C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南\按目录切分_1-88\按节'
files = sorted([f for f in os.listdir(base) if f.endswith('.pdf')])
for fn in files:
    path = os.path.join(base, fn)
    with pdfplumber.open(path) as pdf:
        text = pdf.pages[0].extract_text() if pdf.pages else ''
        has_text = bool(text and text.strip())
        sample = repr(text[:80]) if text else "NONE"
        print(f'{fn}: {len(pdf.pages)} pages, has_text={has_text}')
        print(f'  sample={sample}')
