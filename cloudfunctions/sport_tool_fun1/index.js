// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({ env: "cloud1-6gh7jgl8c5b16a83"});
const db = cloud.database();

// 大模型API配置
const AI_API_URL = 'https://api.lkeap.cloud.tencent.com/v1/chat/completions';
const AI_API_KEY = 'YOUR_API_KEY'; // TODO: 替换为实际的API Key

/**
 * 调用大模型根据评分标准计算分数
 */
async function callAI(scoreStandard, userData) {
  const prompt = `你是一个体育考试评分专家。请根据以下评分标准，对考生的成绩进行评分。

【评分标准】
${scoreStandard}

【考生数据】
省份：${userData.province}
性别：${userData.gender}
AB类别：${userData.ab}
100米成绩：${userData.run100 || '无'}秒
三级跳成绩：${userData.tripleJump || '无'}米
铅球成绩：${userData.shot || '无'}米
专项类别：${userData.sportType || '无'}
专项子项：${userData.sportSub || '无'}

请按照评分标准逐项计算分数，最后给出总分。返回格式为JSON：
{
  "run100Score": 数字,
  "tripleJumpScore": 数字,
  "shotScore": 数字,
  "sportScore": 数字,
  "totalScore": 数字,
  "comment": "简短评语"
}`;

  const response = await cloud.openapi.cloudbase.requestMerchant({
    action: 'post',
    url: AI_API_URL,
    data: {
      model: 'hunyuan-lite',
      messages: [
        { role: 'system', content: '你是一个专业的体育考试评分助手。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    },
    headers: {
      'Authorization': `Bearer ${AI_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  const aiContent = response.data.choices[0].message.content;
  // 尝试从回复中提取JSON
  const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  return { raw: aiContent };
}

/**
 * 从RAG知识库检索评分标准
 */
async function searchScoreStandard(userData) {
  // 根据性别、AB类别、专项构建检索关键词
  const query = `${userData.gender} ${userData.ab === 'A' ? 'A类' : 'B类'} ${userData.sportType || ''} ${userData.sportSub || ''} 评分标准 100米 三级跳 铅球`.trim();

  console.log('========== RAG检索 ==========');
  console.log('检索关键词:', query);

  try {
    // 使用微信云开发的知识库检索（需要先在云开发控制台配置知识库）
    const searchResult = await cloud.openapi.cloudbase.knowledgeSearch({
      query: query,
      topK: 5,
    });

    console.log('RAG检索结果条数:', searchResult.results?.length || 0);

    if (searchResult.results && searchResult.results.length > 0) {
      // 拼接所有检索到的内容作为评分标准
      const standard = searchResult.results
        .map((item, i) => `[标准${i + 1}] ${item.content || item.text}`)
        .join('\n');
      return standard;
    }
  } catch (err) {
    console.log('RAG检索失败，使用默认标准:', err.message);
  }

  // RAG检索失败时，使用内置默认评分标准
  return getDefaultStandard(userData);
}

/**
 * 默认评分标准（RAG不可用时的兜底）
 */
function getDefaultStandard(userData) {
  const isMale = userData.gender === '男';
  return `体育统考评分标准参考：

一、100米跑（满分25分）
${isMale
    ? '男子：≤11.3秒=25分，11.4-11.8秒=20-24分，11.9-12.5秒=15-19分，12.6-13.5秒=10-14分，>13.5秒=5-9分'
    : '女子：≤13.0秒=25分，13.1-13.8秒=20-24分，13.9-14.8秒=15-19分，14.9-16.0秒=10-14分，>16.0秒=5-9分'}

二、三级跳远（满分25分）
${isMale
    ? '男子：≥13.5米=25分，12.8-13.4米=20-24分，12.0-12.7米=15-19分，11.0-11.9米=10-14分，<11.0米=5-9分'
    : '女子：≥11.0米=25分，10.3-10.9米=20-24分，9.5-10.2米=15-19分，8.5-9.4米=10-14分，<8.5米=5-9分'}

三、铅球（满分25分）
${isMale
    ? '男子：≥12.0米=25分，11.0-11.9米=20-24分，10.0-10.9米=15-19分，9.0-9.9米=10-14分，<9.0米=5-9分'
    : '女子：≥9.5米=25分，8.5-9.4米=20-24分，7.5-8.4米=15-19分，6.5-7.4米=10-14分，<6.5米=5-9分'}

四、专项（满分25分）
根据专项类别和水平综合评定。`;
}

// 云函数入口函数
exports.main = async (event, context) => {
  const { province, gender, ab, run100, tripleJump, shot, sportType, sportSub } = event;

  // ==================== 1. 打印前端传来的数据 ====================
  console.log('========== 前端传入数据 ==========');
  console.log('省份:', province);
  console.log('性别:', gender);
  console.log('AB:', ab);
  console.log('100米成绩:', run100, '秒');
  console.log('三级跳成绩:', tripleJump, '米');
  console.log('铅球成绩:', shot, '米');
  console.log('专项类别:', sportType);
  console.log('专项子项:', sportSub);
  console.log('===================================');

  const userData = { province, gender, ab, run100, tripleJump, shot, sportType, sportSub };

  try {
    // ==================== 2. 调用RAG检索评分标准 ====================
    console.log('========== 开始RAG检索评分标准 ==========');
    const scoreStandard = await searchScoreStandard(userData);
    console.log('评分标准内容长度:', scoreStandard.length);
    console.log('========================================');

    // ==================== 3. 调用大模型评分 ====================
    console.log('========== 调用大模型评分 ==========');
    const scoreResult = await callAI(scoreStandard, userData);
    console.log('大模型返回结果:', JSON.stringify(scoreResult));
    console.log('====================================');

    // ==================== 4. 存储数据并返回 ====================
    const result = await db.collection('sport_records').add({
      data: {
        province,
        gender,
        ab: ab || '',
        run100: run100 || '',
        tripleJump: tripleJump || '',
        shot: shot || '',
        sportType: sportType || '',
        sportSub: sportSub || '',
        // 评分结果
        run100Score: scoreResult.run100Score || 0,
        tripleJumpScore: scoreResult.tripleJumpScore || 0,
        shotScore: scoreResult.shotScore || 0,
        sportScore: scoreResult.sportScore || 0,
        totalScore: scoreResult.totalScore || 0,
        comment: scoreResult.comment || '',
        scoreRaw: JSON.stringify(scoreResult),
        createTime: db.serverDate(),
      },
    });

    console.log('========== 最终返回 ==========');
    console.log('数据库ID:', result._id);
    console.log('总分:', scoreResult.totalScore);
    console.log('评语:', scoreResult.comment);
    console.log('==============================');

    return {
      success: true,
      message: '提交成功，评分已完成',
      id: result._id,
      score: {
        run100Score: scoreResult.run100Score || 0,
        tripleJumpScore: scoreResult.tripleJumpScore || 0,
        shotScore: scoreResult.shotScore || 0,
        sportScore: scoreResult.sportScore || 0,
        totalScore: scoreResult.totalScore || 0,
        comment: scoreResult.comment || '',
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
