# -*- coding: utf-8 -*-
"""
为湖南 all_tables.jsonl 中的每个条目添加标准编码 code 字段。
注意原文件结构：每个JSON对象外层key是"code"，内部嵌套的才是真正数据对象（里面还有old_code字符串字段）。
本脚本会：
  1. 拆去外层的 {"code": ...} 包装，让数据提升为顶层对象。
  2. 原内部的 code 字段改名为 old_code（保留原编码便于追溯）。
  3. 顶层新增 code 字段，写入按规则生成的新标准编码。
"""
import json
import os

BASE = r"C:\Users\32614\Desktop\sport_tool\dm\shuju&guize"
ALL_TABLES = os.path.join(BASE, r"湖南\OCR可编辑分章Word\结构化导出\all_tables.jsonl")
OUT = os.path.join(BASE, r"湖南\OCR可编辑分章Word\结构化导出\all_tables_with_code.jsonl")

# 湖南省编码前缀
P = "002"

# ============================================================
# 64条目 -> 标准编码 一一对应（按第1条到第64条的文件原始顺序）
# 所有不确定的地方，按最合理的规则补全成实际可用编码，不留TODO：
#  - 篮球专项达标（名太泛）→ 默认助跑摸高 0002
#  - 健美操无编码项目：俯卧撑 -> 扩展 3c004；难度动作 -> 3c003（成套动作）
#  - 跆拳道 -> 5eg 下自分配 3位子编码：001=横叉, 002=双飞踢, 003=组合靶
#  - 艺术体操 -> 5eh 下自分配 3位子编码：001=素质, 002=徒手规定, 003=球规定
#  - 游泳专项100米：默认按 25米池 001（后续如需改50米池把001改成002即可）
# ============================================================
CODE_MAPPING = {
    # ---- 1-4: 主项目 mainProject -> 1A 田径类 ----
    1:  f"{P}f1A001",     # 女子100米跑 (1A:001=100米跑)
    2:  f"{P}m1A001",     # 男子100米跑
    3:  f"{P}f1A004",     # 女子五米三向折回跑 (1A:004=五米三向折回跑)
    4:  f"{P}m1A004",     # 男子五米三向折回跑

    # ---- 5-11: 小小专项 auxiliaryProject ----
    # 大类编码：1aa = 球类辅项；2bb = 游泳辅项
    5:  f"{P}f1aa002",    # 篮球辅项 往返运球单手低手投篮(女子) -> 1aa:002=篮球运球
    6:  f"{P}m1aa002",    # 篮球辅项 往返运球单手低手投篮(男子)
    7:  f"{P}o1aa003",    # 排球辅项 对墙传球垫球 (不分性别) -> 1aa:003=排球传垫
    8:  f"{P}f1aa001",    # 足球辅项 运球绕杆射门(女子) -> 1aa:001=足球运球
    9:  f"{P}m1aa001",    # 足球辅项 运球绕杆射门(男子)
    10: f"{P}f2bb001",    # 游泳辅项(女子) -> 2bb:001=游泳
    11: f"{P}m2bb001",    # 游泳辅项(男子)

    # ---- 12-33: 专项4d 田径类 ----
    # 4de: 跑类 (4位子编码)； 4df: 跳类； 4dg: 投类
    12: f"{P}m4de0001",   # 男子200米跑专项  (4de:0001=200米)
    13: f"{P}f4de0001",   # 女子200米跑专项
    14: f"{P}m4de0002",   # 男子400米跑专项  (4de:0002=400米)
    15: f"{P}f4de0002",   # 女子400米跑专项
    16: f"{P}m4de0003",   # 男子800米跑专项  (4de:0003=800米)
    17: f"{P}f4de0003",   # 女子800米跑专项
    18: f"{P}m4de0004",   # 男子1500米跑专项 (4de:0004=1500米)
    19: f"{P}f4de0004",   # 女子1500米跑专项
    20: f"{P}m4de0005",   # 男子110米跨栏    (4de:0005=跨栏)
    21: f"{P}f4de0005",   # 女子100米跨栏
    22: f"{P}m4df0002",   # 男子跳高  (4df:0002=跳高)
    23: f"{P}f4df0002",   # 女子跳高
    24: f"{P}m4df0003",   # 男子跳远  (4df:0003=跳远)
    25: f"{P}f4df0003",   # 女子跳远
    26: f"{P}m4df0001",   # 男子三级跳远 (4df:0001=三级跳远)
    27: f"{P}f4df0001",   # 女子三级跳远
    28: f"{P}f4dg0001",   # 女子铅球 (4dg:0001=铅球)
    29: f"{P}m4dg0001",   # 男子铅球
    30: f"{P}f4dg0002",   # 女子铁饼 (4dg:0002=铁饼)
    31: f"{P}m4dg0002",   # 男子铁饼
    32: f"{P}m4dg0003",   # 男子标枪 (4dg:0003=标枪)
    33: f"{P}f4dg0003",   # 女子标枪

    # ---- 34-43: 专项1a 球类 ----
    # 篮球 002，skills 4位：0001=篮球运球, 0002=助跑摸高, 0003=往返运球单手低手投篮, 0004=一分钟投篮
    34: f"{P}f1a0020002", # 女子 篮球专项达标项目 → 按助跑摸高 skills 0002
    35: f"{P}f1a0020003", # 女子 篮球往返运球单手低手投篮 → skills 0003
    36: f"{P}m1a0020002", # 男子 篮球专项达标项目 → 按助跑摸高 skills 0002
    37: f"{P}m1a0020003", # 男子 篮球往返运球单手低手投篮 → skills 0003
    # 排球 003，skills 4位：0001=助跑摸高
    38: f"{P}o1a0030001", # 排球专项助跑摸高 (不分性别) → skills 0001
    # 足球 001，skills 3位：001=颠球, 002=绕杆射门, 003=定位球, 004=守门员跳远, 005=守门员扑接球
    39: f"{P}f1a001002",  # 女子 足球专项运球绕杆射门 → skills 002
    40: f"{P}m1a001002",  # 男子 足球专项运球绕杆射门 → skills 002
    41: f"{P}o1a001001",  # 足球专项颠球 (不分性别) → skills 001
    42: f"{P}o1a001005",  # 足球专项守门员加试扑接球 → skills 005
    43: f"{P}o1a001004",  # 足球专项守门员加试立定跳远 → skills 004

    # ---- 44-51: 专项2b 游泳（按25米池100米=001） ----
    # 游泳子项：001=100米(25米池)； skills 4位：0001=蝶泳, 0002=仰泳, 0003=自由泳, 0004=蛙泳
    44: f"{P}f2b0010003", # 女子100米自由泳 → 003=自由泳
    45: f"{P}f2b0010002", # 女子100米仰泳 → 0002=仰泳
    46: f"{P}f2b0010004", # 女子100米蛙泳 → 0004=蛙泳
    47: f"{P}f2b0010001", # 女子100米蝶泳 → 0001=蝶泳
    48: f"{P}m2b0010003", # 男子100米自由泳
    49: f"{P}m2b0010002", # 男子100米仰泳
    50: f"{P}m2b0010004", # 男子100米蛙泳
    51: f"{P}m2b0010001", # 男子100米蝶泳

    # ---- 52: 专项1a 乒乓球（无skills） ----
    52: f"{P}o1a004",     # 乒乓球专项达标成绩 (不分性别)

    # ---- 53-56: 专项3c 健美操 ----
    # 现有：001=左右纵劈叉, 002=控倒立, 003=成套动作。扩展：004=10秒俯卧撑。
    53: f"{P}f3c004",     # 女子 健美操10秒快速俯卧撑 (扩展编码 3c:004)
    54: f"{P}m3c004",     # 男子 健美操10秒快速俯卧撑 (扩展编码 3c:004)
    55: f"{P}o3c001",     # 健美操专项纵劈腿 (3c:001 左右纵劈叉)
    56: f"{P}o3c003",     # 健美操专项难度动作 → 视为 3c:003 健美操成套动作

    # ---- 57-61: 专项5eg 跆拳道（自分配3位子编码） ----
    # 001=横叉, 002=双飞踢, 003=组合靶技术
    57: f"{P}f5eg001",    # 女子 跆拳道专项素质 横叉 (001)
    58: f"{P}f5eg002",    # 女子 跆拳道专项技术 双飞踢 (002)
    59: f"{P}m5eg001",    # 男子 跆拳道专项素质 横叉 (001)
    60: f"{P}m5eg002",    # 男子 跆拳道专项技术 双飞踢 (002)
    61: f"{P}o5eg003",    # 跆拳道专项组合靶技术 (不分性别, 003)

    # ---- 62-64: 专项5eh 艺术体操（自分配3位子编码） ----
    # 001=素质, 002=徒手规定动作, 003=球规定动作
    62: f"{P}o5eh001",    # 艺术体操专项素质 (001)
    63: f"{P}o5eh002",    # 艺术体操专项技术徒手规定动作 (002)
    64: f"{P}o5eh003",    # 艺术体操专项球规定动作 (003)
}


# ============ 解析文件 ============
with open(ALL_TABLES, "r", encoding="utf-8") as f:
    text = f.read()

decoder = json.JSONDecoder()
entries = []
idx = 0
while idx < len(text):
    while idx < len(text) and text[idx].isspace():
        idx += 1
    if idx >= len(text):
        break
    try:
        obj, end_idx = decoder.raw_decode(text, idx)
        entries.append(obj)
        idx = end_idx
    except json.JSONDecodeError:
        idx += 1

print(f"[1] 共解析出 {len(entries)} 个JSON对象")
assert len(entries) == 64, f"期望64条，实际{len(entries)}条"

# 提取内层对象并改造
flattened = []
for outer in entries:
    # 外层key一般就是"code"，值就是内层对象
    if isinstance(outer, dict) and len(outer) == 1 and "code" in outer and isinstance(outer["code"], dict):
        inner = outer["code"]
    elif isinstance(outer, dict) and "table_name" in outer:
        inner = outer
    else:
        # 兜底：如果结构变了就先保留原样
        inner = outer
    flattened.append(inner)

# ============ 改造并写出 ============
written = 0
with open(OUT, "w", encoding="utf-8") as fout:
    for i, inner in enumerate(flattened, start=1):
        new_code = CODE_MAPPING[i]
        new_obj = {}
        # 先把 code 放最前面
        new_obj["code"] = new_code
        old_code_val = None
        for k, v in inner.items():
            if k == "code":
                # 原内部的code字段是旧编码字符串，改名为old_code
                old_code_val = v
                new_obj["old_code"] = v
            else:
                new_obj[k] = v
        if old_code_val is None:
            # 兜底：万一内层没有code字段，写个占位old_code
            new_obj["old_code"] = None
        fout.write(json.dumps(new_obj, ensure_ascii=False) + "\n")
        written += 1

print(f"[2] 写入 {written} 条到：{OUT}")

# ============ 打印完整64条项目列表 ============
def gender_label(c):
    return {"m": "男", "f": "女", "o": "不分性别"}.get(c, c)

print("\n" + "=" * 130)
print(f"{'#':>3} | {'新标准编码':<22} | {'原old_code':<32} | {'性':<2} | 项目名")
print("-" * 130)

for i, inner in enumerate(flattened, start=1):
    new_code = CODE_MAPPING[i]
    old_code = inner.get("code", "") or ""
    name = inner.get("table_name", "") or ""
    # 从编码提取性别位（第4个字符，索引3）
    g = new_code[3] if len(new_code) > 3 else "?"
    g_lbl = gender_label(g)
    print(f"{i:>3} | {new_code:<22} | {old_code:<32} | {g_lbl:<2} | {name}")

print("=" * 130)
print(f"\n✅ 共 {len(flattened)} 条项目已全部补充 code 字段（无TODO）")

# 编码格式分组统计：
print("\n【编码大类统计】")
cats = {}
for i, code in CODE_MAPPING.items():
    # 大类 = 第5-7或8个字符之间的类别标识
    if   "1A" in code[4:6]:  cat = "主项-1A 田径类"
    elif "2B" in code[4:6]:  cat = "主项-2B 健美操类"
    elif code[4:7] == "1aa": cat = "小小专项-1aa 球类辅项"
    elif code[4:7] == "2bb": cat = "小小专项-2bb 游泳辅项"
    elif code[4:6] == "1a":  cat = "专项-1a 球类"
    elif code[4:6] == "2b":  cat = "专项-2b 游泳类"
    elif code[4:6] == "3c":  cat = "专项-3c 健美操类"
    elif code[4:7] == "4de": cat = "专项-4de 田径(跑)"
    elif code[4:7] == "4df": cat = "专项-4df 田径(跳)"
    elif code[4:7] == "4dg": cat = "专项-4dg 田径(投)"
    elif code[4:7] == "5eg": cat = "专项-5eg 跆拳道"
    elif code[4:7] == "5eh": cat = "专项-5eh 艺术体操"
    else:                    cat = "其他-未分类"
    cats.setdefault(cat, [0, set()])
    cats[cat][0] += 1
    cats[cat][1].add(gender_label(new_code[3]))

for k, (cnt, genders) in sorted(cats.items()):
    print(f"  {k:<28} : {cnt:>2} 项   (性别: {'/'.join(sorted(genders))})")
