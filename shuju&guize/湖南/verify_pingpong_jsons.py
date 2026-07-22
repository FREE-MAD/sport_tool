import json
import os

base_dir = r'c:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南\OCR可编辑分章Word\结构化导出\json\04_专项技术项目\04-10_乒乓球'

# 原始参考数据
table1_ref = [
    (40, 36), (38, 35), (36, 34), (34, 33), (32, 32),
    (31, 31), (30, 30), (29, 29), (28, 28), (27, 27),
    (26, 26), (25, 25), (24, 24), (23, 23), (22, 22),
    (21, 21), (20, 20), (19, 19), (18, 18), (17, 17),
    (16, 16), (15, 15), (14, 14), (13, 13), (12, 12),
    (11, 11), (10, 10), (9, 9), (8, 8), (7, 7),
    (6, 6), (5, 5), (4, 4), (3, 3), (2, 2), (1, 1)
]

table2_ref = [
    (40, 30), (38, 29), (36, 28), (34, 27), (32, 26),
    (31, 25), (30, 25), (29, 24), (28, 24), (27, 23),
    (26, 23), (25, 22), (24, 22), (23, 21), (22, 21),
    (21, 20), (20, 20), (19, 19), (18, 18), (17, 17),
    (16, 16), (15, 15), (14, 14), (13, 13), (12, 12),
    (11, 11), (10, 10), (9, 9), (8, 8), (7, 7),
    (6, 6), (5, 5), (4, 4), (3, 3), (2, 2), (1, 1)
]

table3_ref = [
    (40, 10), (38, 9), (36, 9), (34, 8), (32, 8),
    (30, 7), (28, 7), (24, 6), (20, 5), (16, 4),
    (12, 3), (8, 2), (4, 1)
]

def validate_file(filepath, file_desc, ref_data):
    print(f"\n{'='*60}")
    print(f"验证: {file_desc}")
    print(f"文件: {os.path.basename(filepath)}")
    print(f"{'='*60}")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    code = data['code']
    data_list = code['data']
    errors = []
    
    # 1. 检查总数
    expected_total = len(ref_data)
    actual_total = int(code['total'])
    actual_count = len(data_list)
    if actual_total != expected_total:
        errors.append(f"total字段错误: 期望{expected_total}, 实际{actual_total}")
    if actual_count != expected_total:
        errors.append(f"data条数错误: 期望{expected_total}, 实际{actual_count}")
    print(f"数据条数: 期望{expected_total}, total={actual_total}, 实际data={actual_count} {'✓' if actual_total==expected_total==actual_count else '✗'}")
    
    # 2. 检查max_value (最大板数 = 最高分对应板数 = ref中value最大值)
    expected_max = max(v for _, v in ref_data)
    actual_max = float(code['max_value'])
    if actual_max != expected_max:
        errors.append(f"max_value错误: 期望{expected_max:.2f}, 实际{actual_max:.2f}")
    print(f"max_value (最大板数): 期望{expected_max:.2f}, 实际{actual_max:.2f} {'✓' if abs(actual_max-expected_max)<0.001 else '✗'}")
    
    # 3. 检查min_value (最小板数 = 最低分对应板数 = ref中value最小值)
    expected_min = min(v for _, v in ref_data)
    actual_min = float(code['min_value'])
    if actual_min != expected_min:
        errors.append(f"min_value错误: 期望{expected_min:.2f}, 实际{actual_min:.2f}")
    print(f"min_value (最小板数): 期望{expected_min:.2f}, 实际{actual_min:.2f} {'✓' if abs(actual_min-expected_min)<0.001 else '✗'}")
    
    # 4. 构建实际数据的score-value映射
    actual_pairs = []
    number_ok = True
    for i, item in enumerate(data_list):
        actual_pairs.append((float(item['score']), float(item['value'])))
        expected_num = str(i + 1)
        if item['number'] != expected_num:
            number_ok = False
            errors.append(f"number错误: 第{i+1}条期望{expected_num}, 实际{item['number']}")
    print(f"number连续性: {'✓ 正确' if number_ok else '✗ 有错误'}")
    
    # 5. 将实际数据按score降序排序后与参考数据对比 (参考是高分到低分)
    actual_sorted = sorted(actual_pairs, key=lambda x: -x[0])
    ref_set = set(ref_data)
    actual_set = set(actual_pairs)
    
    # 检查一一对应
    missing_in_actual = ref_set - actual_set
    extra_in_actual = actual_set - ref_set
    
    if missing_in_actual:
        errors.append(f"实际数据缺少 {len(missing_in_actual)} 条参考数据: {sorted(list(missing_in_actual))[:5]}")
    if extra_in_actual:
        errors.append(f"实际数据多出 {len(extra_in_actual)} 条不在参考中: {sorted(list(extra_in_actual))[:5]}")
    
    match_count = len(ref_set & actual_set)
    print(f"参考数据匹配数: {match_count}/{len(ref_set)} {'✓' if match_count==len(ref_set) else '✗'}")
    
    # 6. 显示参考数据首尾对比
    print(f"\n参考数据(score降序): 首条score={ref_data[0][0]},value={ref_data[0][1]} | 尾条score={ref_data[-1][0]},value={ref_data[-1][1]}")
    print(f"实际数据(score降序): 首条score={actual_sorted[0][0]},value={actual_sorted[0][1]} | 尾条score={actual_sorted[-1][0]},value={actual_sorted[-1][1]}")
    
    # 7. 特别检查表2和表3中一value多score的特殊情况
    if len(ref_data) != len(set(v for _, v in ref_data)):
        print(f"\n⚠ 存在重复value对应不同score的情况，已通过集合对比验证")
        # 详细列出重复value情况
        value_map = {}
        for s, v in ref_data:
            value_map.setdefault(v, []).append(s)
        dup_values = {v: ss for v, ss in value_map.items() if len(ss) > 1}
        if dup_values:
            print(f"  重复value映射: ", end="")
            for v, ss in sorted(dup_values.items()):
                print(f"板数{v}→分值{ss}, ", end="")
            print()
    
    # 总结
    print(f"\n--- 结果 ---")
    if errors:
        print(f"✗ 发现 {len(errors)} 个错误:")
        for e in errors[:10]:
            print(f"  - {e}")
    else:
        print(f"✓ 所有验证通过!")
    
    return len(errors) == 0


# 验证3个文件
path1 = os.path.join(base_dir, 'hunan_2023_04-10_001_乒乓球专项推攻两面攻达标成绩评分标准.json')
ok1 = validate_file(path1, "表1：推攻、两面攻", table1_ref)

path2 = os.path.join(base_dir, 'hunan_2023_04-10_002_乒乓球专项正反手削球达标成绩评分标准.json')
ok2 = validate_file(path2, "表2：正反手削球", table2_ref)

path3 = os.path.join(base_dir, 'hunan_2023_04-10_003_乒乓球专项搓中侧身突击达标成绩评分标准.json')
ok3 = validate_file(path3, "表3：搓中侧身突击", table3_ref)

print(f"\n\n{'#'*60}")
print(f"总体验证结果: 表1{'通过' if ok1 else '未通过'}, 表2{'通过' if ok2 else '未通过'}, 表3{'通过' if ok3 else '未通过'}")
print(f"{'#'*60}")
