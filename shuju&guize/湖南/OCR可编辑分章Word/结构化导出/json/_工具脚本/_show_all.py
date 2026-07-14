import json, glob, os

json_dir = r"C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南\OCR可编辑分章Word\结构化导出\json"
files = sorted(glob.glob(os.path.join(json_dir, "*.json")))

print("\n所有已提取的评分表汇总:\n")
print(f"{'表名':<50s} {'total':>8s}  {'分数范围':>25s}  {'值范围':>25s}")
print("-" * 120)

total_all = 0
for f in files:
    d = json.load(open(f, encoding="utf-8"))
    c = d["code"]
    t = int(c["total"])
    total_all += t
    
    data = c["data"]
    first_score = data[0]["score"]
    last_score = data[-1]["score"]
    first_val = data[0]["value"]
    last_val = data[-1]["value"]
    
    score_range = f"{first_score} ~ {last_score}"
    val_range = f"{first_val} ~ {last_val}"
    
    print(f"{c['table_name']:<50s} {t:>8d}  {score_range:>25s}  {val_range:>25s}")

print("-" * 120)
print(f"共 {len(files)} 张表, 总评分点: {total_all}")
