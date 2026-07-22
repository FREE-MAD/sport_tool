import json

def validate_file(filepath, gender, start_score, phase1_count, phase2_transition_score, phase2_transition_value):
    print(f"{'='*60}")
    print(f"验证 {gender} 文件: {filepath.split(chr(92))[-1]}")
    print(f"{'='*60}")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    code = data['code']
    data_list = code['data']
    
    errors = []
    
    # 1. 检查总数
    total = int(code['total'])
    actual_count = len(data_list)
    if total != actual_count:
        errors.append(f"total字段({total})与实际数据条数({actual_count})不一致!")
    else:
        print(f"✓ 数据总数: {actual_count} 条")
    
    # 2. 检查 max_value (最小value值，即第1条)
    max_value = float(code['max_value'])
    actual_max = float(data_list[0]['value'])
    if max_value != actual_max:
        errors.append(f"max_value字段({max_value})与实际最大值({actual_max})不一致!")
    else:
        print(f"✓ max_value: {max_value} (第1条value)")
    
    # 3. 检查 min_value (最大value值，即最后1条)
    min_value = float(code['min_value'])
    actual_min = float(data_list[-1]['value'])
    if min_value != actual_min:
        errors.append(f"min_value字段({min_value})与实际最小值({actual_min})不一致!")
    else:
        print(f"✓ min_value: {min_value} (最后1条value)")
    
    # 4. 检查 number 连续性
    print(f"\n--- 检查 number 连续性 ---")
    for i, item in enumerate(data_list):
        expected_num = str(i + 1)
        if item['number'] != expected_num:
            errors.append(f"第{i+1}条的number字段错误: 期望{expected_num}, 实际{item['number']}")
            if len(errors) > 10:
                break
    if not any('number' in e for e in errors):
        print(f"✓ number字段连续正确 (1-{actual_count})")
    
    # 5. 分阶段检查 score 和 value 的步长
    print(f"\n--- 检查数据步长 (分阶段) ---")
    
    # Phase 1: 前 phase1_count 条
    print(f"\nPhase 1 (第1-{phase1_count}条): score步长-0.10, value步长+0.10")
    phase1_errors = 0
    for i in range(phase1_count):
        item = data_list[i]
        expected_score = round(start_score - i * 0.10, 2)
        expected_value = round(0.10 + i * 0.10, 2)
        actual_score = float(item['score'])
        actual_value = float(item['value'])
        
        if abs(actual_score - expected_score) > 0.001:
            if phase1_errors < 5:
                errors.append(f"Phase1第{i+1}条score错误: 期望{expected_score:.2f}, 实际{actual_score:.2f}")
            phase1_errors += 1
        if abs(actual_value - expected_value) > 0.001:
            if phase1_errors < 5:
                errors.append(f"Phase1第{i+1}条value错误: 期望{expected_value:.2f}, 实际{actual_value:.2f}")
            phase1_errors += 1
    
    if phase1_errors == 0:
        print(f"  ✓ Phase 1 数据正确")
        print(f"    第{phase1_count}条: score={data_list[phase1_count-1]['score']}, value={data_list[phase1_count-1]['value']}")
    else:
        print(f"  ✗ Phase 1 发现 {phase1_errors} 个错误")
    
    # Phase 过渡点检查 (phase1_count+1条)
    trans_idx = phase1_count  # 0-based
    print(f"\n过渡点 (第{phase1_count+1}条): score步长变-0.01, value步长变+0.02")
    trans_item = data_list[trans_idx]
    expected_trans_score = phase2_transition_score
    expected_trans_value = phase2_transition_value
    actual_trans_score = float(trans_item['score'])
    actual_trans_value = float(trans_item['value'])
    
    if abs(actual_trans_score - expected_trans_score) > 0.001:
        errors.append(f"过渡点score错误: 期望{expected_trans_score:.2f}, 实际{actual_trans_score:.2f}")
    if abs(actual_trans_value - expected_trans_value) > 0.001:
        errors.append(f"过渡点value错误: 期望{expected_trans_value:.2f}, 实际{actual_trans_value:.2f}")
    
    print(f"  过渡点: score={trans_item['score']}, value={trans_item['value']}")
    if abs(actual_trans_score - expected_trans_score) <= 0.001 and abs(actual_trans_value - expected_trans_value) <= 0.001:
        print(f"  ✓ 过渡点正确")
    
    # Phase 2: 过渡点之后的所有数据
    phase2_start = phase1_count + 1  # 1-based第phase1_count+2条
    phase2_count = actual_count - phase1_count - 1
    print(f"\nPhase 2 (第{phase2_start}-{actual_count}条, 共{phase2_count}条): score步长-0.01, value步长+0.02")
    phase2_errors = 0
    for step in range(1, phase2_count + 1):
        idx = phase1_count + step  # 0-based
        item = data_list[idx]
        expected_score = round(phase2_transition_score - step * 0.01, 2)
        expected_value = round(phase2_transition_value + step * 0.02, 2)
        actual_score = float(item['score'])
        actual_value = float(item['value'])
        
        if abs(actual_score - expected_score) > 0.001:
            if phase2_errors < 5:
                errors.append(f"Phase2第{phase2_start+step-1}条score错误: 期望{expected_score:.2f}, 实际{actual_score:.2f}")
            phase2_errors += 1
        if abs(actual_value - expected_value) > 0.001:
            if phase2_errors < 5:
                errors.append(f"Phase2第{phase2_start+step-1}条value错误: 期望{expected_value:.2f}, 实际{actual_value:.2f}")
            phase2_errors += 1
    
    if phase2_errors == 0:
        print(f"  ✓ Phase 2 数据正确")
        print(f"    最后1条(第{actual_count}条): score={data_list[-1]['score']}, value={data_list[-1]['value']}")
    else:
        print(f"  ✗ Phase 2 发现 {phase2_errors} 个错误")
    
    # 6. 最终最后1条验证
    last_score = float(data_list[-1]['score'])
    last_value = float(data_list[-1]['value'])
    expected_last_score = round(phase2_transition_score - phase2_count * 0.01, 2)
    expected_last_value = round(phase2_transition_value + phase2_count * 0.02, 2)
    
    print(f"\n--- 最终数据验证 ---")
    print(f"最后1条score: {last_score:.2f} (期望: {expected_last_score:.2f}) {'✓' if abs(last_score-expected_last_score)<=0.001 else '✗'}")
    print(f"最后1条value: {last_value:.2f} (期望: {expected_last_value:.2f}) {'✓' if abs(last_value-expected_last_value)<=0.001 else '✗'}")
    
    # 总结
    print(f"\n{'='*60}")
    if errors:
        print(f"✗ 发现 {len(errors)} 个错误:")
        for e in errors[:15]:
            print(f"  - {e}")
        if len(errors) > 15:
            print(f"  ... 还有 {len(errors)-15} 个错误未显示")
    else:
        print(f"✓ 所有验证通过! 文件数据正确。")
    print(f"{'='*60}\n")
    
    return len(errors) == 0


# 男子文件参数:
# 起始score: 46.10
# Phase 1: 69条 (1-69), 步长 -0.10 / +0.10
# 过渡点第70条: score=39.29, value=7.00
men_file = r'c:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南\OCR可编辑分章Word\结构化导出\json\04_专项技术项目\04-02_篮球\hunan_2023_04-02_m_003_篮球专项往返运球单手低手投篮达标成绩评分标准(男子).json'
men_ok = validate_file(men_file, "男子", start_score=46.10, phase1_count=69, 
                       phase2_transition_score=39.29, phase2_transition_value=7.00)

# 女子文件参数:
# 起始score: 51.20
# Phase 1: 70条 (1-70), 步长 -0.10 / +0.10
# 过渡点第71条: score=44.29, value=7.02
women_file = r'c:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南\OCR可编辑分章Word\结构化导出\json\04_专项技术项目\04-02_篮球\hunan_2023_04-02_f_004_篮球专项往返运球单手低手投篮达标成绩评分标准(女子).json'
women_ok = validate_file(women_file, "女子", start_score=51.20, phase1_count=70, 
                         phase2_transition_score=44.29, phase2_transition_value=7.02)

print(f"\n\n{'#'*60}")
print(f"总体验证结果: 男子{'通过' if men_ok else '有错误'}, 女子{'通过' if women_ok else '有错误'}")
print(f"{'#'*60}")
