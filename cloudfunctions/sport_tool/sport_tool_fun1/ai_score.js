// /**
//  * AI 大模型评分模块（独立模块，按需调用）
//  * 当查表评分无法覆盖时，作为兜底方案使用大模型进行评分
//  */

// const cloud = require('wx-server-sdk');
// cloud.init({ env: 'cloud1-6gh7jgl8c5b16a83' });

// // ==================== 配置 ====================
// const AI_API_URL = 'https://api.lkeap.cloud.tencent.com/v1/chat/completions';
// const AI_API_KEY = 'YOUR_API_KEY'; // TODO: 替换为实际的API Key

// // ==================== 构建 prompt ====================
// function buildPrompt(scoreStandard, userData) {
//   return `你是一个体育考试评分专家。请根据以下评分标准，对考生的成绩进行评分。

// 【评分标准】
// ${scoreStandard}

// 【考生数据】
// 省份：${userData.province}
// 性别：${userData.gender}
// AB类别：${userData.ab}
// 100米成绩：${userData.run100 || '无'}秒
// 三级跳成绩：${userData.tripleJump || '无'}米
// 铅球成绩：${userData.shot || '无'}米
// 专项类别：${userData.sportType || '无'}
// 专项子项：${userData.sportSub || '无'}

// 请按照评分标准逐项计算分数，最后给出总分。返回格式为JSON：
// {
//   "run100Score": 数字,
//   "tripleJumpScore": 数字,
//   "shotScore": 数字,
//   "sportScore": 数字,
//   "totalScore": 数字,
//   "comment": "简短评语"
// }`;
// }

// // ==================== 调用大模型 API ====================
// async function callAIModel(scoreStandard, userData) {
//   console.log('[AI模块] ========== 调用大模型评分 ==========');
//   console.log('[AI模块] 评分标准长度:', scoreStandard.length);
//   console.log('[AI模块] 用户数据:', JSON.stringify(userData));

//   const prompt = buildPrompt(scoreStandard, userData);

//   const response = await cloud.openapi.cloudbase.requestMerchant({
//     action: 'post',
//     url: AI_API_URL,
//     data: {
//       model: 'hunyuan-lite',
//       messages: [
//         { role: 'system', content: '你是一个专业的体育考试评分助手。' },
//         { role: 'user', content: prompt },
//       ],
//       temperature: 0.3,
//     },
//     headers: {
//       'Authorization': `Bearer ${AI_API_KEY}`,
//       'Content-Type': 'application/json',
//     },
//   });

//   const aiContent = response.data.choices[0].message.content;
//   console.log('[AI模块] 大模型原始返回:', aiContent);

//   // 尝试从回复中提取JSON
//   const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
//   if (jsonMatch) {
//     const parsed = JSON.parse(jsonMatch[0]);
//     console.log('[AI模块] 解析结果:', JSON.stringify(parsed));
//     console.log('[AI模块] ====================================');
//     return parsed;
//   }

//   console.log('[AI模块] 无法解析JSON，返回原始内容');
//   console.log('[AI模块] ====================================');
//   return { raw: aiContent };
// }

// // ==================== 默认评分标准（兜底） ====================
// function getDefaultStandard(userData) {
//   const isMale = userData.gender === '男';
//   return `体育统考评分标准参考：

// 一、100米跑（满分25分）
// ${isMale
//     ? '男子：≤11.3秒=25分，11.4-11.8秒=20-24分，11.9-12.5秒=15-19分，12.6-13.5秒=10-14分，>13.5秒=5-9分'
//     : '女子：≤13.0秒=25分，13.1-13.8秒=20-24分，13.9-14.8秒=15-19分，14.9-16.0秒=10-14分，>16.0秒=5-9分'}

// 二、三级跳远（满分25分）
// ${isMale
//     ? '男子：≥13.5米=25分，12.8-13.4米=20-24分，12.0-12.7米=15-19分，11.0-11.9米=10-14分，<11.0米=5-9分'
//     : '女子：≥11.0米=25分，10.3-10.9米=20-24分，9.5-10.2米=15-19分，8.5-9.4米=10-14分，<8.5米=5-9分'}

// 三、铅球（满分25分）
// ${isMale
//     ? '男子：≥12.0米=25分，11.0-11.9米=20-24分，10.0-10.9米=15-19分，9.0-9.9米=10-14分，<9.0米=5-9分'
//     : '女子：≥9.5米=25分，8.5-9.4米=20-24分，7.5-8.4米=15-19分，6.5-7.4米=10-14分，<6.5米=5-9分'}

// 四、专项（满分25分）
// 根据专项类别和水平综合评定。`;
// }

// // ==================== RAG 知识库检索 ====================
// async function searchScoreStandard(userData) {
//   const query = `${userData.gender} ${userData.ab === 'A' ? 'A类' : 'B类'} ${userData.sportType || ''} ${userData.sportSub || ''} 评分标准 100米 三级跳 铅球`.trim();

//   console.log('[AI模块] ========== RAG检索 ==========');
//   console.log('[AI模块] 检索关键词:', query);

//   try {
//     const searchResult = await cloud.openapi.cloudbase.knowledgeSearch({
//       query: query,
//       topK: 5,
//     });

//     console.log('[AI模块] RAG检索结果条数:', searchResult.results?.length || 0);

//     if (searchResult.results && searchResult.results.length > 0) {
//       const standard = searchResult.results
//         .map((item, i) => `[标准${i + 1}] ${item.content || item.text}`)
//         .join('\n');
//       console.log('[AI模块] RAG检索成功');
//       return standard;
//     }
//   } catch (err) {
//     console.log('[AI模块] RAG检索失败，使用默认标准:', err.message);
//   }

//   console.log('[AI模块] 使用默认评分标准');
//   return getDefaultStandard(userData);
// }

// // ==================== 对外接口 ====================
// /**
//  * 使用大模型进行评分（查表失败时的兜底方案）
//  * @param {Object} userData - 用户数据 { province, gender, ab, run100, tripleJump, shot, sportType, sportSub }
//  * @returns {Object} 评分结果 { run100Score, tripleJumpScore, shotScore, sportScore, totalScore, comment }
//  */
// async function scoreByAI(userData) {
//   try {
//     // 1. RAG检索评分标准
//     const scoreStandard = await searchScoreStandard(userData);

//     // 2. 调用大模型评分
//     const scoreResult = await callAIModel(scoreStandard, userData);

//     return {
//       success: true,
//       ...scoreResult,
//     };
//   } catch (err) {
//     console.error('[AI模块] 评分失败:', err.message);
//     return {
//       success: false,
//       error: err.message,
//     };
//   }
// }

// module.exports = {
//   scoreByAI,
//   getDefaultStandard,
// };
