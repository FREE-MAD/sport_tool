import json
import re

def load_json(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    content = re.sub(r'//.*', '', content)
    return json.loads(content)

def verify_data(data, label):
    print(f"\n{'='*60}")
    print(f"验证: {label}")
    print(f"{'='*60}")
    
    code = data['code']
    print(f"table_name: {code['table_name']}")
    print(f"code: {code['code']}")
    print(f"max_value: {code['max_value']}")
    print(f"min_value: {code['min_value']}")
    print(f"total: {code['total']}")
    print(f"data实际条数: {len(code['data'])}")
    
    assert len(code['data']) == int(code['total']), "total与实际条数不一致!"
    
    values = []
    scores = []
    prev_score = None
    prev_value = None
    errors = []
    
    for i, item in enumerate(code['data']):
        num = int(item['number'])
        score = float(item['score'])
        value = float(item['value'])
        
        values.append(value)
        scores.append(score)
        
        if num != i + 1:
            errors.append(f"第{i}条number错误: 期望{i+1}, 实际{num}")
        
        if prev_score is not None:
            if i < 69:
                expected_score_diff = 0.10
                expected_value_diff = 0.10
            else:
                expected_score_diff = 0.01
                expected_value_diff = 0.02
            
            actual_score_diff = round(prev_score - score, 4)
            actual_value_diff = round(value - prev_value, 4)
            
            if actual_score_diff != expected_score_diff:
                errors.append(f"第{i+1}条({num})score步长错误: 期望-{expected_score_diff}, 实际-{actual_score_diff} (prev={prev_score},curr={score})")
                if len(errors) > 5:
                    errors.append("...(更多错误省略)")
                    break
            
            if actual_value_diff != expected_value_diff:
                errors.append(f"第{i+1}条({num})value步长错误: 期望+{expected_value_diff}, 实际+{actual_value_diff} (prev={prev_value},curr={value})")
                if len(errors) > 5:
                    errors.append("...(更多错误省略)")
                    break
        
        prev_score = score
        prev_value = value
    
    calc_max_value = min(values)
    calc_min_value = max(values)
    
    print(f"\n计算验证:")
    print(f"  计算max_value(最小value): {calc_max_value:.2f}, JSON中max_value: {code['max_value']}, 匹配: {f'{calc_max_value:.2f}' == code['max_value']}")
    print(f"  计算min_value(最大value): {calc_min_value:.2f}, JSON中min_value: {code['min_value']}, 匹配: {f'{calc_min_value:.2f}' == code['min_value']}")
    print(f"  value范围: {min(values):.2f} ~ {max(values):.2f}")
    print(f"  score范围: {min(scores):.2f} ~ {max(scores):.2f}")
    
    if errors:
        print(f"\n发现错误 ({len(errors)}条):")
        for e in errors[:10]:
            print(f"  ❌ {e}")
    else:
        print(f"\n✅ 数据验证通过！所有步长正确，number连续正确")
    
    return len(errors) == 0

if __name__ == "__main__":
    men_path = r"C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南\OCR可编辑分章Word\结构化导出\json\04_专项技术项目\04-02_篮球\hunan_2023_04-02_m_003_篮球专项往返运球单手低手投篮达标成绩评分标准(男子).json"
    women_path = r"C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南\OCR可编辑分章Word\结构化导出\json\04_专项技术项目\04-02_篮球\hunan_2023_04-02_f_004_篮球专项往返运球单手低手投篮达标成绩评分标准(女子).json"
    
    men_data = load_json(men_path)
    ok1 = verify_data(men_data, "男子 篮球专项往返运球单手低手投篮")
    
    women_data = load_json(women_path)
    ok2 = verify_data(women_data, "女子 篮球专项往返运球单手低手投篮")
    
    print(f"\n{'='*60}")
    if ok1 and ok2:
        print("✅ 两个文件全部验证通过！")
    else:
        print("❌ 存在错误需要修复")
