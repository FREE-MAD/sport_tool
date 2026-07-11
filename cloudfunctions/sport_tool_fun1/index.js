// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({ env: "cloud1-6gh7jgl8c5b16a83" });
const db = cloud.database();

// ==================== 数据库查表评分 ====================

/**
 * 从数据库 score_table 集合中查询评分表条目
 * 数据库结构：
 *   - provinceCode: 省份编码，如 "001"
 *   - code: 项目编码，如 "001m1A001"
 *   - table_name, headers, max_value, min_value, total, data 等字段
 * @param {string} code - 项目编码，如 "001m1A001"
 * @returns {object|null} 评分表条目
 */
async function getScoreEntry(code) {
  try {
    const collection = db.collection('tool_code');

    let res = await collection
      .where({ code })
      .limit(1)
      .get();

    if (res.data && res.data.length > 0) {
      console.log('[查表] 按 code 命中:', code);
      return res.data[0];
    }

    // 兼容嵌套库存储：整个省份评分表存成一个大文档
    res = await collection.limit(20).get();
    if (res.data && res.data.length > 0) {
      for (const doc of res.data) {
        if (!doc || typeof doc !== 'object') continue;
        for (const key of Object.keys(doc)) {
          if (doc[key] && doc[key][code]) {
            console.log('[查表] 按嵌套结构命中:', key, code);
            return doc[key][code];
          }
        }
      }
    }

    console.warn('[查表] 未找到评分数据:', code, '(已尝试 code / nested)');
    return null;
  } catch (err) {
    console.error('[查表] 数据库查询失败:', code, err.message);
    return null;
  }
}

/**
 * 将成绩/阈值字符串转换为可比较的数值
 * 支持：
 *   - 纯数字：11.48 / 50
 *   - 时间：01:09.00 -> 69
 *   - 边界符号：≤5 / >= 7 -> 5 / 7
 * @param {string|number|null|undefined} raw
 * @returns {number}
 */
function normalizeComparableValue(raw) {
  if (raw === undefined || raw === null) return NaN;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;

  const text = String(raw).trim();
  if (!text) return NaN;

  const cleaned = text
    .replace(/[<>=≤≥]/g, '')
    .replace(/\s+/g, '');

  if (!cleaned) return NaN;

  if (cleaned.includes(':')) {
    const parts = cleaned.split(':').map(part => parseFloat(part));
    if (parts.some(part => Number.isNaN(part))) return NaN;

    return parts.reduce((total, part) => total * 60 + part, 0);
  }

  const numeric = parseFloat(cleaned);
  return Number.isNaN(numeric) ? NaN : numeric;
}

/**
 * 从分数字段中提取数值
 * 少量表存在 "≤7" 这类写法，这里按数值部分兜底处理
 * @param {string|number|null|undefined} raw
 * @returns {number}
 */
function normalizeScore(raw) {
  return normalizeComparableValue(raw);
}

/**
 * 兼容数据库中已错位的排球摸高评分表
 * 目前已确认以下 code 存在 score/value 列混乱：
 *   - 001m1a0030001
 *   - 001f1a0030001
 * 处理策略：
 *   - 从原始 score/value 两列中提取所有“像摸高成绩”的数值（2.x / 3.x 米）
 *   - 取最大的 N 个阈值，按从高到低重建 value 列
 *   - 以最大分为起点，重建连续递减的 score 列
 * @param {string} code
 * @param {object[]} data
 * @param {string} genderCode
 * @returns {{score:number, value:number}[]|null}
 */
function rebuildVolleyballHighJumpRows(code, data, genderCode) {
  const volleyballCodes = ['001m1a0030001', '001f1a0030001'];
  if (!volleyballCodes.includes(code) || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  const rowCount = data.length;
  const metricValues = [];
  const scoreCandidates = [];

  data.forEach((d) => {
    const scoreNum = normalizeScore(d.score);
    const valueNum = extractValue(d, genderCode);

    if (Number.isFinite(scoreNum)) {
      if (scoreNum > 1 && scoreNum < 5) metricValues.push(scoreNum);
      if (Number.isInteger(scoreNum) && scoreNum >= rowCount) scoreCandidates.push(scoreNum);
    }

    if (Number.isFinite(valueNum) && valueNum > 1 && valueNum < 5) {
      metricValues.push(valueNum);
    }
  });

  const rebuiltValues = [...new Set(metricValues)]
    .sort((a, b) => b - a)
    .slice(0, rowCount);

  const maxScore = scoreCandidates.length > 0 ? Math.max(...scoreCandidates) : rowCount;
  if (rebuiltValues.length !== rowCount) {
    console.warn('[查表] 排球摸高表重建失败，候选阈值数量不足:', code, rebuiltValues);
    return null;
  }

  const rebuiltRows = rebuiltValues.map((value, index) => ({
    score: maxScore - index,
    value
  }));

  console.warn('[查表] 排球摸高表存在脏数据，已按阈值重建:', code, rebuiltRows);
  return rebuiltRows;
}

/**
 * 从 data 行中提取 value 值
 * 兼容两种格式：
 *   - 标准格式：d.value 直接存储数值
 *   - 游泳格式：d.male / d.female 分别存储男女值
 * @param {object} d - data 行
 * @param {string} genderCode - 性别编码 'm'/'f'/'o'
 * @returns {number} 数值
 */
function extractValue(d, genderCode) {
  // 标准格式优先
  if (d.value !== undefined && d.value !== null) {
    return normalizeComparableValue(d.value);
  }
  // 游泳格式：根据性别取 male/female 字段
  if (genderCode === 'm' && d.male !== undefined) {
    return normalizeComparableValue(d.male);
  }
  if (genderCode === 'f' && d.female !== undefined) {
    return normalizeComparableValue(d.female);
  }
  // 不分性别项目：优先 male 再 female
  if (d.male !== undefined) return normalizeComparableValue(d.male);
  if (d.female !== undefined) return normalizeComparableValue(d.female);
  return NaN;
}

/**
 * 根据 better 方向查找评分（异步，从数据库查表）
 *
 * 评分表 data 中，value 始终从最优到最差排列：
 *   - better=smaller：value 从小到大排列（如 100 米跑：11.48 → 16.65）
 *   - better=larger：value 从大到小排列（如 摸高：3.15 → 2.66）
 *
 * @param {string} code - 项目编码，如 "001m1A001"
 * @param {number} userValue - 用户成绩数值
 * @param {string} better - "smaller" 或 "larger"
 * @param {string} genderCode - 性别编码，用于游泳等多列格式的数据提取
 * @returns {number} 得分
 */
async function lookupScore(code, userValue, better, genderCode) {
  const entry = await getScoreEntry(code);
  if (!entry || !entry.data || entry.data.length === 0) {
    console.warn('[查表] 未找到评分数据:', code);
    return 0;
  }

  let rows = entry.data
    .map(d => ({
      score: normalizeScore(d.score),
      value: extractValue(d, genderCode)
    }))
    .filter(row => Number.isFinite(row.score) && Number.isFinite(row.value));

  const rebuiltRows = rebuildVolleyballHighJumpRows(code, entry.data, genderCode);
  if (rebuiltRows) {
    rows = rebuiltRows;
  }

  rows = rows.sort((a, b) => {
    return better === 'smaller' ? a.value - b.value : b.value - a.value;
  });

  if (rows.length === 0) {
    console.warn('[查表] 评分表没有可用阈值:', code);
    return 0;
  }

  const n = rows.length;
  const isNegative = userValue < 0;

  if (better === 'smaller') {
    // 值越小越好，按阈值升序比较
    if (userValue <= rows[0].value) return rows[0].score;
    if (userValue >= rows[n - 1].value) return rows[n - 1].score;
    for (let i = 0; i < n; i++) {
      if (rows[i].value >= userValue) {
        // 负数时向后减一位（返回前一个位置的分数）
        if (isNegative && i > 0) {
          return rows[i - 1].score;
        }
        return rows[i].score;
      }
    }
    return rows[n - 1].score;
  } else {
    // 值越大越好，按阈值降序比较
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
}

/**
 * 单个项目评分（异步）
 */
async function scoreItem(item, genderCode) {
  // 先检查数据库中的 rule 字段
  if (item.rule === undefined) {
    const entry = await getScoreEntry(item.code);
    if (entry && (entry.rule === false || entry.rule === 'false')) {
      item.rule = false;
    }
  }

  // rule: false 时，直接使用用户输入的值作为分数，跳过查表
  if (item.rule === false || item.rule === 'false') {
    const directScore = normalizeScore(item.value);
    console.log(`[评分] ${item.name}(${item.code}) | rule=false | 直接得分=${directScore}`);
    return Number.isFinite(directScore) ? directScore : 0;
  }

  const value = normalizeComparableValue(item.value);
  if (!Number.isFinite(value)) {
    console.warn('[评分] 无效数值:', item.name, item.value);
    return 0;
  }

  const better = item.better || 'smaller';
  const score = await lookupScore(item.code, value, better, genderCode);

  console.log(`[评分] ${item.name}(${item.code}) | 值=${value}${item.unit} | better=${better} | 得分=${score}`);
  return score;
}

/**
 * 对所有项目进行评分
 */
async function scoreAll(mainData, specialDataList, genderCode) {
  const mainScores = await Promise.all(mainData.map(async (item) => ({
    name: item.name,
    code: item.code,
    score: await scoreItem(item, genderCode),
    value: item.value,
    unit: item.unit
  })));

  const specialScores = await Promise.all((specialDataList || []).map(async (item) => ({
    typeLabel: item.typeLabel,
    name: item.name,
    code: item.code,
    score: await scoreItem(item, genderCode),
    value: item.value,
    unit: item.unit
  })));

  const allScores = [...mainScores, ...specialScores];
  const totalScore = allScores.reduce((sum, s) => sum + (s.score || 0), 0);

  console.log('[评分] 总分:', totalScore, '| 基本素质:', mainScores.map(s => s.score), '| 专项:', specialScores.map(s => s.score));
  return { mainScores, specialScores, totalScore };
}

// ==================== 云函数入口 ====================

exports.main = async (event, context) => {
  const { province, provinceCode, gender, genderCode, mainType, mainTypeKey, mainData, specialType, specialTypeKey, specialDataList } = event;

  console.log('========== 前端传入数据 ==========');
  console.log('省份:', province, '(' + provinceCode + ')');
  console.log('性别:', gender, '(' + genderCode + ')');
  console.log('基本素质类别:', mainType, '(' + mainTypeKey + ')');
  console.log('基本素质数据:', JSON.stringify(mainData));
  console.log('专项类别:', specialType, '(' + specialTypeKey + ')');
  console.log('专项数据:', JSON.stringify(specialDataList));
  console.log('===================================');

  try {
    // ==================== 评分 ====================
    console.log('========== 开始评分 ==========');
    const score = await scoreAll(mainData, specialDataList || [], provinceCode, genderCode);
    console.log('评分结果:', JSON.stringify(score));
    console.log('====================================');

    // ==================== 存储到 tool_records ====================
    const result = await db.collection('tool_records').add({
      data: {
        province,
        provinceCode,
        gender,
        genderCode,
        mainType,
        mainTypeKey,
        mainData,
        specialType: specialType || '',
        specialTypeKey: specialTypeKey || '',
        specialDataList: specialDataList || [],
        mainScores: score.mainScores,
        specialScores: score.specialScores || [],
        totalScore: score.totalScore,
        createTime: db.serverDate(),
      },
    });

    console.log('========== 最终返回 ==========');
    console.log('数据库ID:', result._id);
    console.log('总分:', score.totalScore);
    console.log('==============================');

    return {
      success: true,
      message: '提交成功，评分已完成',
      id: result._id,
      score: {
        mainScores: score.mainScores,
        specialScores: score.specialScores || [],
        totalScore: score.totalScore,
      },
    };
  } catch (err) {
    console.error('========== 错误 ==========');
    console.error('错误信息:', err.message);
    console.error('错误堆栈:', err.stack);
    console.error('==========================');

    return {
      success: false,
      message: '提交失败',
      error: err.message,
    };
  }
};
