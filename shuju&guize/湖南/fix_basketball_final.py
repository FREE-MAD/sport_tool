import json
import re

def load_json_with_comments(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    content = re.sub(r'//.*', '', content)
    return json.loads(content)

def fix_men_file():
    file_path = r"C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南\OCR可编辑分章Word\结构化导出\json\04_专项技术项目\04-02_篮球\hunan_2023_04-02_m_003_篮球专项往返运球单手低手投篮达标成绩评分标准(男子).json"
    
    data = load_json_with_comments(file_path)
    new_data = []
    
    # Phase 1: Number 1-69: s=46.10-(i-1)*0.10, v=0.10+(i-1)*0.10
    for i in range(1, 70):
        s = 46.10 - (i - 1) * 0.10
        v = 0.10 + (i - 1) * 0.10
        new_data.append({
            "score": f"{round(s,2):.2f}",
            "value": f"{round(v,2):.2f}",
            "number": str(i)
        })
    
    # Number 70: s=39.29, v=7.00 (s步长变0.01, v步长仍0.10)
    new_data.append({
        "score": "39.29",
        "value": "7.00",
        "number": "70"
    })
    
    # Phase 2b: Number 71-573 (共503条): s=39.29-(n-70)*0.01, v=7.00+(n-70)*0.02
    for n in range(71, 574):
        s = 39.29 - (n - 70) * 0.01
        v = 7.00 + (n - 70) * 0.02
        new_data.append({
            "score": f"{round(s,2):.2f}",
            "value": f"{round(v,2):.2f}",
            "number": str(n)
        })
    
    values = [float(item['value']) for item in new_data]
    scores = [float(item['score']) for item in new_data]
    max_value = min(values)
    min_value = max(values)
    total = len(new_data)
    
    data['code']['data'] = new_data
    data['code']['max_value'] = f"{max_value:.2f}"
    data['code']['min_value'] = f"{min_value:.2f}"
    data['code']['total'] = str(total)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"男子文件修复完成：")
    print(f"  总条数: {total}")
    print(f"  max_value: {max_value:.2f}, min_value: {min_value:.2f}")
    print(f"  score范围: {min(scores):.2f} ~ {max(scores):.2f}")
    print(f"  69: s={new_data[68]['score']},v={new_data[68]['value']}")
    print(f"  70: s={new_data[69]['score']},v={new_data[69]['value']}")
    print(f"  71: s={new_data[70]['score']},v={new_data[70]['value']}")
    print(f"  177: s={new_data[176]['score']},v={new_data[176]['value']}")
    print(f"  377: s={new_data[376]['score']},v={new_data[376]['value']}")
    print(f"  573: s={new_data[572]['score']},v={new_data[572]['value']}")
    
    return data

def fix_women_file():
    file_path = r"C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南\OCR可编辑分章Word\结构化导出\json\04_专项技术项目\04-02_篮球\hunan_2023_04-02_f_004_篮球专项往返运球单手低手投篮达标成绩评分标准(女子).json"
    
    data = load_json_with_comments(file_path)
    new_data = []
    
    # Phase 1: Number 1-70: s=51.20-(i-1)*0.10, v=0.10+(i-1)*0.10
    for i in range(1, 71):
        s = 51.20 - (i - 1) * 0.10
        v = 0.10 + (i - 1) * 0.10
        new_data.append({
            "score": f"{round(s,2):.2f}",
            "value": f"{round(v,2):.2f}",
            "number": str(i)
        })
    
    # Phase 2: Number 71-573 (共503条): s=44.29-(n-71)*0.01, v=7.02+(n-71)*0.02
    for n in range(71, 574):
        s = 44.29 - (n - 71) * 0.01
        v = 7.02 + (n - 71) * 0.02
        new_data.append({
            "score": f"{round(s,2):.2f}",
            "value": f"{round(v,2):.2f}",
            "number": str(n)
        })
    
    values = [float(item['value']) for item in new_data]
    scores = [float(item['score']) for item in new_data]
    max_value = min(values)
    min_value = max(values)
    total = len(new_data)
    
    data['code']['data'] = new_data
    data['code']['max_value'] = f"{max_value:.2f}"
    data['code']['min_value'] = f"{min_value:.2f}"
    data['code']['total'] = str(total)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"\n女子文件修复完成：")
    print(f"  总条数: {total}")
    print(f"  max_value: {max_value:.2f}, min_value: {min_value:.2f}")
    print(f"  score范围: {min(scores):.2f} ~ {max(scores):.2f}")
    print(f"  69: s={new_data[68]['score']},v={new_data[68]['value']}")
    print(f"  70: s={new_data[69]['score']},v={new_data[69]['value']}")
    print(f"  71: s={new_data[70]['score']},v={new_data[70]['value']}")
    print(f"  178: s={new_data[177]['score']},v={new_data[177]['value']}")
    print(f"  233: s={new_data[232]['score']},v={new_data[232]['value']}")
    print(f"  573: s={new_data[572]['score']},v={new_data[572]['value']}")
    
    return data

if __name__ == "__main__":
    fix_men_file()
    fix_women_file()
    print("\n修复完成！")
