import json
import os

def fix_and_recalculate_men():
    path = r'C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南\OCR可编辑分章Word\结构化导出\json\04_专项技术项目\04-02_篮球\hunan_2023_04-02_m_003_篮球专项往返运球单手低手投篮达标成绩评分标准(男子).json'
    
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    lines = content.split('\n')
    comment_lines = []
    json_lines = []
    for line in lines:
        if line.strip().startswith('//'):
            comment_lines.append(line)
        else:
            json_lines.append(line)
    json_content = '\n'.join(json_lines)
    
    data = json.loads(json_content)
    
    print("=== 男子原始数据分析 ===")
    print(f"原始 total: {data['code']['total']}")
    print(f"原始 max_value: {data['code']['max_value']}")
    print(f"原始 min_value: {data['code']['min_value']}")
    print(f"原始 data 长度: {len(data['code']['data'])}")
    
    first_69 = data['code']['data'][:69]
    print(f"\n前69条 - 第1条: {first_69[0]}")
    print(f"前69条 - 第69条: {first_69[68]}")
    
    item_69 = data['code']['data'][68]
    item_70 = data['code']['data'][69]
    print(f"\n第69条: {item_69}")
    print(f"第70条: {item_70}")
    
    item_177 = data['code']['data'][176]
    item_178 = data['code']['data'][177]
    item_179 = data['code']['data'][178]
    print(f"\n第177条: {item_177}")
    print(f"第178条: {item_178}")
    print(f"第179条: {item_179}")
    
    item_376 = data['code']['data'][375]
    item_377 = data['code']['data'][376]
    item_549 = data['code']['data'][548]
    item_550 = data['code']['data'][549] if len(data['code']['data']) > 549 else None
    print(f"\n第376条: {item_376}")
    print(f"第377条: {item_377}")
    print(f"第549条: {item_549}")
    if item_550:
        print(f"第550条: {item_550}")
    
    last_item = data['code']['data'][-1]
    print(f"\n最后一条: {last_item}")
    
    new_data = []
    
    for i in range(69):
        item = data['code']['data'][i].copy()
        item['number'] = str(i + 1)
        new_data.append(item)
    
    base_score = 39.29
    base_value = 7.00
    for i in range(108):
        offset = i + 1
        score = base_score - 0.01 * offset
        value = base_value + 0.02 * offset
        new_data.append({
            "score": f"{score:.2f}",
            "value": f"{value:.2f}",
            "number": str(70 + i)
        })
    
    second_section_start = 1067
    print(f"\n验证: 第177条(70+107)应为 score={39.29-0.01*107:.2f}, value={7.00+0.02*107:.2f}")
    
    third_section_start = 38.22
    base_score_3 = 38.22
    base_value_3 = 34.00
    for i in range(173):
        offset = i
        score = base_score_3 - 0.01 * offset
        value = base_value_3 + 0.01 * offset
        new_data.append({
            "score": f"{score:.2f}",
            "value": f"{value:.2f}",
            "number": str(178 + i)
        })
    
    fourth_section_start_score = 46.20
    fourth_section_start_value = 34.00
    fourth_section_base_score = 17.66
    fourth_section_base_value = 38.96
    fourth_section_total = 173
    for i in range(fourth_section_total):
        score = fourth_section_base_score - 0.01 * i
        value = fourth_section_base_value + 0.01 * i
        new_data.append({
            "score": f"{score:.2f}",
            "value": f"{value:.2f}",
            "number": str(178 + 173 + i)
        })
    
    print(f"\n计算后新数据总条数: {len(new_data)}")
    print(f"第1条: {new_data[0]}")
    print(f"第69条: {new_data[68]}")
    print(f"第70条: {new_data[69]}")
    print(f"第177条: {new_data[176]}")
    print(f"第178条: {new_data[177]}")
    print(f"第350条: {new_data[349]}")
    print(f"第351条: {new_data[350]}")
    print(f"最后一条: {new_data[-1]}")
    
    max_value = new_data[0]['value']
    min_value = new_data[-1]['value']
    total = str(len(new_data))
    
    print(f"\n重新统计:")
    print(f"  max_value (最快时间/最小value): {max_value}")
    print(f"  min_value (最慢时间/最大value): {min_value}")
    print(f"  total (数据条数): {total}")
    
    data['code']['max_value'] = max_value
    data['code']['min_value'] = min_value
    data['code']['total'] = total
    data['code']['data'] = new_data
    
    output_content = ''
    if comment_lines:
        output_content = '\n'.join(comment_lines) + '\n'
    output_content += json.dumps(data, ensure_ascii=False, indent=2)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(output_content)
    
    print(f"\n男子文件已保存到: {path}")
    return path


def fix_and_recalculate_women():
    path = r'C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南\OCR可编辑分章Word\结构化导出\json\04_专项技术项目\04-02_篮球\hunan_2023_04-02_f_004_篮球专项往返运球单手低手投篮达标成绩评分标准(女子).json'
    
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    lines = content.split('\n')
    comment_lines = []
    json_lines = []
    for line in lines:
        if line.strip().startswith('//'):
            comment_lines.append(line)
        else:
            json_lines.append(line)
    json_content = '\n'.join(json_lines)
    
    data = json.loads(json_content)
    
    print("\n=== 女子原始数据分析 ===")
    print(f"原始 total: {data['code']['total']}")
    print(f"原始 max_value: {data['code']['max_value']}")
    print(f"原始 min_value: {data['code']['min_value']}")
    print(f"原始 data 长度: {len(data['code']['data'])}")
    
    first_70 = data['code']['data'][:70]
    print(f"\n前70条 - 第1条: {first_70[0]}")
    print(f"前70条 - 第70条: {first_70[69]}")
    
    item_70 = data['code']['data'][69]
    item_71 = data['code']['data'][70] if len(data['code']['data']) > 70 else None
    print(f"\n第70条: {item_70}")
    if item_71:
        print(f"第71条: {item_71}")
    
    item_232 = data['code']['data'][231]
    item_233 = data['code']['data'][232] if len(data['code']['data']) > 232 else None
    item_234 = data['code']['data'][233] if len(data['code']['data']) > 233 else None
    print(f"\n第232条: {item_232}")
    if item_233:
        print(f"第233条: {item_233}")
    if item_234:
        print(f"第234条: {item_234}")
    
    last_item = data['code']['data'][-1]
    print(f"\n最后一条(原始): {last_item}")
    
    new_data = []
    
    for i in range(70):
        item = data['code']['data'][i].copy()
        item['number'] = str(i + 1)
        new_data.append(item)
    
    base_score = 44.30
    base_value = 7.00
    for i in range(162):
        offset = i + 1
        score = base_score - 0.01 * offset
        value = base_value + 0.02 * offset
        new_data.append({
            "score": f"{score:.2f}",
            "value": f"{value:.2f}",
            "number": str(71 + i)
        })
    
    print(f"\n验证: 第232条(71+161)应为 score={44.30-0.01*161:.2f}, value={7.00+0.02*161:.2f}")
    
    third_section_base_score = 20.06
    third_section_base_value = 37.76
    third_section_count = len(data['code']['data']) - 232
    print(f"第三部分应有: {third_section_count} 条")
    
    for i in range(third_section_count):
        score = third_section_base_score - 0.01 * i
        value = third_section_base_value + 0.01 * i
        new_data.append({
            "score": f"{score:.2f}",
            "value": f"{value:.2f}",
            "number": str(233 + i)
        })
    
    print(f"\n计算后新数据总条数: {len(new_data)}")
    print(f"第1条: {new_data[0]}")
    print(f"第70条: {new_data[69]}")
    print(f"第71条: {new_data[70]}")
    print(f"第232条: {new_data[231]}")
    print(f"第233条: {new_data[232]}")
    print(f"最后一条: {new_data[-1]}")
    
    max_value = new_data[0]['value']
    min_value = new_data[-1]['value']
    total = str(len(new_data))
    
    print(f"\n重新统计:")
    print(f"  max_value (最快时间/最小value): {max_value}")
    print(f"  min_value (最慢时间/最大value): {min_value}")
    print(f"  total (数据条数): {total}")
    
    data['code']['max_value'] = max_value
    data['code']['min_value'] = min_value
    data['code']['total'] = total
    data['code']['data'] = new_data
    
    output_content = ''
    if comment_lines:
        output_content = '\n'.join(comment_lines) + '\n'
    output_content += json.dumps(data, ensure_ascii=False, indent=2)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(output_content)
    
    print(f"\n女子文件已保存到: {path}")
    return path


if __name__ == '__main__':
    men_path = fix_and_recalculate_men()
    women_path = fix_and_recalculate_women()
    print("\n=== 完成 ===")
    print(f"男子文件: {men_path}")
    print(f"女子文件: {women_path}")
