# -*- coding: utf-8 -*-
import csv, re, sys, traceback

try:
    with open(r'C:\Users\32614\Downloads\target_2845080061782321.csv', 'r', encoding='utf-8') as f:
        rows = list(csv.reader(f))

    def is_blank_row(row):
        return all(c.strip() == '' for c in row)

    def is_continue_mark(row):
        t = ','.join(row)
        return '\u7eed\u4e0a\u8868' in t  # 续上表

    def is_table_title(row):
        t = ','.join(row)
        return '\u8868 ' in t  # 表 

    def is_three_col_header(row):
        t = ','.join(row)
        return t.count('\u5206\u503c') >= 3 and t.count('\u6210\u7ee9') >= 2 and '\u8bc4\u5206\u6807\u51c6' not in t

    def is_two_col_header(row):
        t = ','.join(row)
        standard_count = len(re.findall(r'\u8bc4\u5206\u6807\u51c6', t))
        score_count = t.count('\u5206\u503c')
        return standard_count >= 2 and score_count >= 2

    def is_swim_4col_header(row):
        t = ','.join(row)
        nan_count = len(re.findall(r'\u7537', t))
        nv_count = len(re.findall(r'\u5973', t))
        return nan_count >= 4 and nv_count >= 4 and '\u5206\u503c' not in t and '\u8bc4\u5206' not in t

    def is_normal_data(row):
        ne = [c for c in row if c.strip()]
        if len(ne) >= 2:
            try:
                float(ne[0].replace('\u2264','').replace('>',''))
                float(ne[1].replace('\u2264','').replace('>','').replace(':',''))
                return True
            except: pass
        return False

    def is_swim_data(row):
        ne = [c for c in row if c.strip()]
        if len(ne) == 9:
            try:
                float(ne[0].replace(',','.'))
                return True
            except: pass
        return False

    def is_two_value_header(row):
        t = ','.join(row)
        return t.count('\u5206\u503c') == 2 and t.count('\u6210\u7ee9') >= 2 and '\u8bc4\u5206\u6807\u51c6' not in t

    def is_man_woman_3col_header(row):
        t = ','.join(row)
        nan_count = len(re.findall(r'\u7537\u5b50', t))
        nv_count = len(re.findall(r'\u5973\u5b50', t))
        return nan_count >= 3 and nv_count >= 3

    out = []
    i = 0
    swim_count = 0
    while i < len(rows):
        r = rows[i]
        
        if is_swim_4col_header(r):
            swim_count += 1
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
                    male_idx = col_idx * 2 + 1
                    female_idx = col_idx * 2 + 2
                    cols[col_idx].append([score, ne[male_idx], ne[female_idx]])
            
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
                        cols[col_idx].append([ne[col_idx * 2], ne[col_idx * 2 + 1]])
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
                        cols[col_idx].append([ne[col_idx * 2], ne[col_idx * 2 + 1]])
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
                        cols[col_idx].append([ne[col_idx * 2], ne[col_idx * 2 + 1]])
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
                        cols[col_idx].append([ne[col_idx * 2], ne[col_idx * 2 + 1]])
            for col_idx in range(3):
                for pair in cols[col_idx]:
                    out.append(pair)
            continue
        
        out.append(r)
        i += 1

    with open(r'C:\Users\32614\Desktop\sport_tool\dm\target_split.csv', 'w', encoding='utf-8', newline='') as f:
        csv.writer(f).writerows(out)
    
    with open(r'C:\Users\32614\Desktop\sport_tool\dm\debug_out.txt', 'w', encoding='utf-8') as f:
        f.write(f'{len(rows)} -> {len(out)}\n')
        f.write(f'swim_4col_header matched: {swim_count} times\n')

except Exception as e:
    with open(r'C:\Users\32614\Desktop\sport_tool\dm\debug_out.txt', 'w', encoding='utf-8') as f:
        f.write(f'ERROR: {e}\n')
        f.write(traceback.format_exc())
