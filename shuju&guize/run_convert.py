import csv, re

INPUT = r'C:\Users\32614\Downloads\target_2845080061782321.csv'
OUTPUT = r'C:\Users\32614\Desktop\sport_tool\dm\target_split.csv'

with open(INPUT, 'r', encoding='utf-8') as f:
    rows = list(csv.reader(f))

def is_blank_row(row):
    return all(c.strip() == '' for c in row)

def is_continue_mark(row):
    t = ','.join(row)
    return '\u7eed\u4e0a\u8868' in t

def is_table_title(row):
    t = ','.join(row)
    return '\u8868 ' in t

def is_three_col_header(row):
    t = ','.join(row)
    return t.count('\u5206\u503c') >= 3 and t.count('\u6210\u7ee9') >= 2 and '\u8bc4\u5206\u6807\u51c6' not in t

def is_two_col_header(row):
    t = ','.join(row)
    sc = len(re.findall(r'\u8bc4\u5206\u6807\u51c6', t))
    fc = t.count('\u5206\u503c')
    return sc >= 2 and fc >= 2

def is_swim_4col_header(row):
    t = ','.join(row)
    nan = len(re.findall(r'\u7537', t))
    nv = len(re.findall(r'\u5973', t))
    return nan >= 4 and nv >= 4 and '\u5206\u503c' not in t and '\u8bc4\u5206' not in t

def is_normal_data(row):
    ne = [c for c in row if c.strip()]
    if len(ne) >= 2:
        try:
            float(ne[0].replace('\u2264','').replace('>',''))
            float(ne[1].replace('\u2264','').replace('>','').replace(':',''))
            return True
        except:
            pass
    return False

def is_swim_data(row):
    ne = [c for c in row if c.strip()]
    if len(ne) == 9:
        try:
            float(ne[0].replace(',','.'))
            return True
        except:
            pass
    return False

def is_two_value_header(row):
    t = ','.join(row)
    return t.count('\u5206\u503c') == 2 and t.count('\u6210\u7ee9') >= 2 and '\u8bc4\u5206\u6807\u51c6' not in t

def is_man_woman_3col_header(row):
    t = ','.join(row)
    nan = len(re.findall(r'\u7537\u5b50', t))
    nv = len(re.findall(r'\u5973\u5b50', t))
    return nan >= 3 and nv >= 3

out = []
i = 0
while i < len(rows):
    r = rows[i]
    
    if is_swim_4col_header(r):
        out.append(['score', 'male', 'female'])
        i += 1
        
        dr = []
        while i < len(rows):
            rr = rows[i]
            if is_swim_data(rr):
                dr.append(rr)
                i += 1
            elif is_blank_row(rr) or is_continue_mark(rr) or is_table_title(rr):
                out.append(rr)
                i += 1
                if is_continue_mark(rr) or is_table_title(rr):
                    break
            else:
                break
        
        cols = [[], [], [], []]
        for d in dr:
            ne = [c for c in d if c.strip()]
            score = ne[0]
            for col_idx in range(4):
                cols[col_idx].append([score, ne[col_idx*2+1], ne[col_idx*2+2]])
        
        for col_idx in range(4):
            for pair in cols[col_idx]:
                out.append(pair)
        continue
    
    if is_three_col_header(r):
        out.append(['score', 'value'])
        i += 1
        dr = []
        while i < len(rows) and is_normal_data(rows[i]):
            dr.append(rows[i])
            i += 1
        cols = [[], [], []]
        for d in dr:
            ne = [c for c in d if c.strip()]
            for col_idx in range(3):
                if col_idx * 2 + 1 < len(ne):
                    cols[col_idx].append([ne[col_idx*2], ne[col_idx*2+1]])
        for col_idx in range(3):
            for pair in cols[col_idx]:
                out.append(pair)
        continue
    
    if is_two_col_header(r):
        out.append(['score', 'value'])
        i += 1
        dr = []
        while i < len(rows) and is_normal_data(rows[i]):
            dr.append(rows[i])
            i += 1
        cols = [[], []]
        for d in dr:
            ne = [c for c in d if c.strip()]
            for col_idx in range(2):
                if col_idx * 2 + 1 < len(ne):
                    cols[col_idx].append([ne[col_idx*2], ne[col_idx*2+1]])
        for col_idx in range(2):
            for pair in cols[col_idx]:
                out.append(pair)
        continue
    
    if is_two_value_header(r):
        out.append(['score', 'value'])
        i += 1
        dr = []
        while i < len(rows) and is_normal_data(rows[i]):
            dr.append(rows[i])
            i += 1
        cols = [[], []]
        for d in dr:
            ne = [c for c in d if c.strip()]
            for col_idx in range(2):
                if col_idx * 2 + 1 < len(ne):
                    cols[col_idx].append([ne[col_idx*2], ne[col_idx*2+1]])
        for col_idx in range(2):
            for pair in cols[col_idx]:
                out.append(pair)
        continue
    
    if is_man_woman_3col_header(r):
        out.append(['score', 'male', 'female'])
        i += 1
        dr = []
        while i < len(rows) and is_normal_data(rows[i]):
            dr.append(rows[i])
            i += 1
        cols = [[], [], []]
        for d in dr:
            ne = [c for c in d if c.strip()]
            for col_idx in range(3):
                if col_idx * 2 + 1 < len(ne):
                    cols[col_idx].append([ne[col_idx*2], ne[col_idx*2+1]])
        for col_idx in range(3):
            for pair in cols[col_idx]:
                out.append(pair)
        continue
    
    out.append(r)
    i += 1

# ===== 第二轮处理：拆分表11的男/女合并数据 =====
def is_table11_slash_data(row):
    """检测行是否包含 男/女 格式的时间（如 16.00/17.00），共4个非空值"""
    ne = [(idx, c.strip()) for idx, c in enumerate(row) if c.strip()]
    if len(ne) != 4:
        return False
    slash_count = 0
    for _, val in ne:
        if '/' in val:
            parts = val.split('/')
            if len(parts) == 2:
                a = parts[0].replace('>', '').strip()
                b = parts[1].replace('>', '').strip()
                try:
                    float(a)
                    float(b)
                    slash_count += 1
                except:
                    pass
    return slash_count == 2

out2 = []
j = 0
while j < len(out):
    r = out[j]
    if is_table11_slash_data(r):
        ne = [(idx, c.strip()) for idx, c in enumerate(r) if c.strip()]
        t1 = ne[0][1]
        s1 = ne[1][1]
        t2 = ne[2][1]
        s2 = ne[3][1]
        male_t1, female_t1 = t1.split('/')
        male_t2, female_t2 = t2.split('/')
        out2.append([male_t1, s1])
        out2.append([female_t1, s1])
        out2.append([male_t2, s2])
        out2.append([female_t2, s2])
        j += 1
        continue
    out2.append(r)
    j += 1

with open(OUTPUT, 'w', encoding='utf-8', newline='') as f:
    csv.writer(f).writerows(out2)

with open(r'C:\Users\32614\Desktop\sport_tool\dm\debug_out.txt', 'w') as f:
    f.write('OK: {} -> {} -> {}'.format(len(rows), len(out), len(out2)))
