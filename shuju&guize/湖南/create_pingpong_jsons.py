import os
import json

base_dir = r'c:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南\OCR可编辑分章Word\结构化导出\json\04_专项技术项目\04-10_乒乓球'

# ============== 表1：推攻、两面攻 ==============
# 原始数据：(score, value) 按高分到多板顺序给出
table1_raw = [
    (40, 36), (38, 35), (36, 34), (34, 33), (32, 32),
    (31, 31), (30, 30), (29, 29), (28, 28), (27, 27),
    (26, 26), (25, 25), (24, 24), (23, 23), (22, 22),
    (21, 21), (20, 20), (19, 19), (18, 18), (17, 17),
    (16, 16), (15, 15), (14, 14), (13, 13), (12, 12),
    (11, 11), (10, 10), (9, 9), (8, 8), (7, 7),
    (6, 6), (5, 5), (4, 4), (3, 3), (2, 2), (1, 1)
]
# 按value从小到大重新排序（板数少到多，对应分数低到高）
table1_sorted = sorted(table1_raw, key=lambda x: x[1])

table1_data = []
for i, (score, value) in enumerate(table1_sorted, 1):
    table1_data.append({
        "score": f"{score:.2f}",
        "value": f"{value:.2f}",
        "number": str(i)
    })

table1 = {
    "code": {
        "table_name": "表58 乒乓球专项达标成绩——推攻、两面攻",
        "headers": ["score", "value"],
        "code": "hunan_2023_04-10_001",
        "max_value": f"{max(v for _, v in table1_raw):.2f}",
        "min_value": f"{min(v for _, v in table1_raw):.2f}",
        "total": str(len(table1_raw)),
        "data": table1_data
    }
}

path1 = os.path.join(base_dir, 'hunan_2023_04-10_001_乒乓球专项推攻两面攻达标成绩评分标准.json')
with open(path1, 'w', encoding='utf-8') as f:
    json.dump(table1, f, ensure_ascii=False, indent=2)
print(f"✓ 已创建: {path1}")
print(f"  max_value={table1['code']['max_value']}, min_value={table1['code']['min_value']}, total={table1['code']['total']}")

# ============== 表2：正反手削球 ==============
table2_raw = [
    (40, 30), (38, 29), (36, 28), (34, 27), (32, 26),
    (31, 25), (30, 25), (29, 24), (28, 24), (27, 23),
    (26, 23), (25, 22), (24, 22), (23, 21), (22, 21),
    (21, 20), (20, 20), (19, 19), (18, 18), (17, 17),
    (16, 16), (15, 15), (14, 14), (13, 13), (12, 12),
    (11, 11), (10, 10), (9, 9), (8, 8), (7, 7),
    (6, 6), (5, 5), (4, 4), (3, 3), (2, 2), (1, 1)
]
table2_sorted = sorted(table2_raw, key=lambda x: x[1])

table2_data = []
for i, (score, value) in enumerate(table2_sorted, 1):
    table2_data.append({
        "score": f"{score:.2f}",
        "value": f"{value:.2f}",
        "number": str(i)
    })

table2 = {
    "code": {
        "table_name": "表58 乒乓球专项达标成绩——正反手削球",
        "headers": ["score", "value"],
        "code": "hunan_2023_04-10_002",
        "max_value": f"{max(v for _, v in table2_raw):.2f}",
        "min_value": f"{min(v for _, v in table2_raw):.2f}",
        "total": str(len(table2_raw)),
        "data": table2_data
    }
}

path2 = os.path.join(base_dir, 'hunan_2023_04-10_002_乒乓球专项正反手削球达标成绩评分标准.json')
with open(path2, 'w', encoding='utf-8') as f:
    json.dump(table2, f, ensure_ascii=False, indent=2)
print(f"\n✓ 已创建: {path2}")
print(f"  max_value={table2['code']['max_value']}, min_value={table2['code']['min_value']}, total={table2['code']['total']}")

# ============== 表3：搓中侧身突击 ==============
table3_raw = [
    (40, 10), (38, 9), (36, 9), (34, 8), (32, 8),
    (30, 7), (28, 7), (24, 6), (20, 5), (16, 4),
    (12, 3), (8, 2), (4, 1)
]
table3_sorted = sorted(table3_raw, key=lambda x: x[1])

table3_data = []
for i, (score, value) in enumerate(table3_sorted, 1):
    table3_data.append({
        "score": f"{score:.2f}",
        "value": f"{value:.2f}",
        "number": str(i)
    })

table3 = {
    "code": {
        "table_name": "表58 乒乓球专项达标成绩——搓中侧身突击",
        "headers": ["score", "value"],
        "code": "hunan_2023_04-10_003",
        "max_value": f"{max(v for _, v in table3_raw):.2f}",
        "min_value": f"{min(v for _, v in table3_raw):.2f}",
        "total": str(len(table3_raw)),
        "data": table3_data
    }
}

path3 = os.path.join(base_dir, 'hunan_2023_04-10_003_乒乓球专项搓中侧身突击达标成绩评分标准.json')
with open(path3, 'w', encoding='utf-8') as f:
    json.dump(table3, f, ensure_ascii=False, indent=2)
print(f"\n✓ 已创建: {path3}")
print(f"  max_value={table3['code']['max_value']}, min_value={table3['code']['min_value']}, total={table3['code']['total']}")

print("\n" + "="*60)
print("全部3个乒乓球JSON文件创建完成!")
print("="*60)
