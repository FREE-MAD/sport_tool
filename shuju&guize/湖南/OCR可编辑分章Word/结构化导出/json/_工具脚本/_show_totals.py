import json, glob, os
d = os.path.dirname(os.path.abspath(__file__))
files = sorted(glob.glob(os.path.join(d, "*.json")))
total_all = 0
for f in files:
    data = json.load(open(f, encoding="utf-8"))
    c = data["code"]
    t = int(c["total"])
    total_all += t
    print(f"  {c['table_name']:50s}  total={c['total']:>6s}  pages={c.get('page_range','?')}")
print(f"\n  共 {len(files)} 张表, 总评分点: {total_all}")
