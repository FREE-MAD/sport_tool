import json
import os
import re

path = r"C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南\OCR可编辑分章Word\结构化导出\all_tables.jsonl"

text = open(path, 'r', encoding='utf-8-sig').read()

decoder = json.JSONDecoder()
entries = []
idx = 0
line_num = 1

while idx < len(text):
    while idx < len(text) and text[idx] in ' \t\r\n':
        if text[idx] == '\n':
            line_num += 1
        idx += 1
    if idx >= len(text):
        break
    try:
        start_line = line_num
        obj, end = decoder.raw_decode(text, idx)
        entries.append((start_line, obj))
        for ch in text[idx:end]:
            if ch == '\n':
                line_num += 1
        idx = end
    except json.JSONDecodeError as e:
        print(f"Decode error near line {line_num}, idx {idx}: {e}")
        print(f"Context: ...{text[max(0,idx-20):idx+50]}...")
        break

print(f"成功解析条目数: {len(entries)}")
print()
for i, (ln, obj) in enumerate(entries, 1):
    table_name = ""
    old_code = ""
    if isinstance(obj, dict):
        # 外层如果有一个字符串key是code，值是dict的情况
        keys = list(obj.keys())
        if len(keys) == 1 and isinstance(obj[keys[0]], dict):
            inner = obj[keys[0]]
            table_name = inner.get('table_name', '')
            old_code = inner.get('code', '')
        elif 'table_name' in obj:
            table_name = obj.get('table_name', '')
            old_code = obj.get('code', '')
    print(f"{i:3d}. 起始行{ln:4d} | old_code: {old_code:30s} | {table_name}")
