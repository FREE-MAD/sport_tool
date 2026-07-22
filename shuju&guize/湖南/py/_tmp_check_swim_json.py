import json
with open(r'c:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南\OCR可编辑分章Word\结构化导出\json\hunan_2023_03-04_m_001_游泳辅项成绩评分标准(男子).json','r',encoding='utf-8') as f:
    d=json.load(f)
print('table_name:', d['code']['table_name'])
print('total:', d['code']['total'])
print('max_value:', d['code']['max_value'])
print('min_value:', d['code']['min_value'])
print('len data:', len(d['code']['data']))
for i in range(5):
    print('  ', d['code']['data'][i])
print('...')
for i in range(-5,0):
    print('  ', d['code']['data'][i])
