from rapidocr_onnxruntime import RapidOCR
ocr = RapidOCR()
img = r'c:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南\OCR可编辑分章Word\结构化导出\_rendered_pages\03-04_第三章_第四节_游泳_印刷页038-084\page_003.png'
result, _ = ocr(img)
print('OCR result count:', len(result) if result else 0)
for box, text, score in result[:30]:
    x = sum(p[0] for p in box)/4
    y = sum(p[1] for p in box)/4
    print(f'{x:.0f},{y:.0f}: {text}')
