import sys
sys.path.insert(0, r'c:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南\py')
from extract_hunan_table_textlayer import process_pdf, write_table_outputs
from pathlib import Path
pdf = Path(r'c:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南\按目录切分_1-88\按节\03-04_第三章_第四节_游泳_印刷页038-084.pdf')
payloads, logs = process_pdf(pdf)
for p in payloads:
    print('table_name:', p['code']['table_name'])
    print('total:', p['code']['total'])
    print('max_value:', p['code']['max_value'])
    print('min_value:', p['code']['min_value'])
    print('first 5:', p['code']['data'][:5])
    print('last 5:', p['code']['data'][-5:])
