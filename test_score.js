function testLookupScore() {
  const rows = [
    { value: 0, score: 17 },
    { value: -5, score: 19 },
    { value: -10, score: 21 },
    { value: -15, score: 23 },
    { value: -20, score: 25 }
  ];
  
  const better = 'larger';
  const n = rows.length;
  
  function lookupScore(userValue) {
    const isNegative = userValue < 0;
    
    if (userValue >= rows[0].value) return rows[0].score;
    if (userValue <= rows[n - 1].value) return rows[n - 1].score;
    for (let i = 0; i < n; i++) {
      if (rows[i].value <= userValue) {
        // 负数时向后减一位（返回前一个位置的分数）
        if (isNegative && i > 0) {
          return rows[i - 1].score;
        }
        return rows[i].score;
      }
    }
    return rows[n - 1].score;
  }
  
  console.log('测试 better="larger"（值越大越好），数据降序排列');
  console.log('数据:', JSON.stringify(rows));
  console.log('');
  
  const testCases = [
    { input: -4, expected: 17, desc: '-4cm（负数，查出来后减一位）' },
    { input: -5, expected: 17, desc: '-5cm（负数，查出来后减一位）' },
    { input: -6, expected: 19, desc: '-6cm（负数，查出来后减一位）' },
    { input: 0, expected: 17, desc: '0cm（正数，正常查）' },
    { input: 1, expected: 17, desc: '1cm（正数，正常查）' },
    { input: -10, expected: 19, desc: '-10cm（负数，查出来后减一位）' },
    { input: -20, expected: 25, desc: '-20cm（刚好达到最小，返回最大分）' },
    { input: -25, expected: 25, desc: '-25cm（负数，比-20好）' }
  ];
  
  testCases.forEach(({ input, expected, desc }) => {
    const result = lookupScore(input);
    console.log(`${desc}: 输入=${input}, 实际=${result}, 期望=${expected} [${result === expected ? '✓' : '✗'}]`);
  });
}

testLookupScore();