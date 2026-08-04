// 云函数入口文件
const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); // 使用当前云环境

// CloudBase AI 的基础地址。该地址本身已包含 /v1/ai/cloudbase，聊天请求只需继续追加 /chat/completions。
const CLOUDBASE_AI_BASE_URL = 'https://cloud1-6gh7jgl8c5b16a83.api.tcloudbasegateway.com/v1/ai/cloudbase';

// 默认模型使用 CloudBase 文档中常见的 hy3，可按需通过前端传参覆盖。
const DEFAULT_MODEL = 'hy3';

/**
 * 清洗文本输入，避免空白字符导致无效对话请求。
 * @param {string} text - 原始文本
 * @returns {string} 清洗后的文本
 */
function sanitizeText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .trim();
}

/**
 * 规范化历史消息，只保留最近若干条有效上下文。
 * @param {Array} history - 前端传入的历史消息
 * @returns {Array} 规范化后的历史记录
 */
function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant'))
    .map((item) => ({
      role: item.role,
      content: sanitizeText(item.content)
    }))
    .filter((item) => item.content)
    .slice(-12);
}

/**
 * 将最近几轮上下文压缩成摘要，便于在回复中保持连续性。
 * @param {Array} history - 历史消息
 * @returns {string} 简短上下文摘要
 */
function buildHistorySummary(history) {
  const recentUserMessages = history
    .filter((item) => item.role === 'user')
    .slice(-2)
    .map((item) => item.content);

  if (!recentUserMessages.length) {
    return '';
  }

  return `你刚刚提到过：${recentUserMessages.join('；')}。`;
}

/**
 * 构造给大模型的 system prompt，约束回复风格与领域范围。
 * @returns {string} system prompt
 */
function buildSystemPrompt() {
  return [
    '你是一个微信小程序里的体育工具 AI 助手。',
    '请使用中文回复。',
    '优先回答体育成绩分析、训练建议、备考建议和小程序使用问题。',
    '回复要简洁、清晰、可执行，不要编造不存在的功能。',
    '当用户信息不足时，先指出还缺什么关键信息。'
  ].join('\n');
}

/**
 * 将前端消息历史转成 OpenAI Chat Completions 兼容格式。
 * @param {Array} history - 历史消息
 * @returns {Array} 模型 messages
 */
function buildModelMessages(history) {
  return [
    {
      role: 'system',
      content: buildSystemPrompt()
    }
  ].concat(
    (history || []).map((item) => ({
      role: item.role,
      content: item.content
    }))
  );
}

/**
 * 以 Promise 形式发起 HTTPS POST 请求，避免额外引入第三方依赖。
 * @param {string} url - 请求地址
 * @param {Object} headers - 请求头
 * @param {Object} data - 请求体
 * @returns {Promise<Object>} 响应对象
 */
function postJson(url, headers, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data || {});
    const request = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers
      }
    }, (response) => {
      const chunks = [];

      response.on('data', (chunk) => {
        chunks.push(chunk);
      });

      response.on('end', () => {
        const rawText = Buffer.concat(chunks).toString('utf8');
        let parsedBody = null;

        try {
          parsedBody = rawText ? JSON.parse(rawText) : {};
        } catch (err) {
          reject(new Error(`AI 接口返回了无法解析的内容：${rawText}`));
          return;
        }

        resolve({
          statusCode: response.statusCode,
          headers: response.headers,
          data: parsedBody
        });
      });
    });

    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

/**
 * 从 CloudBase AI 返回结果中提取文本回复。
 * @param {Object} responseData - 接口响应体
 * @returns {string} 解析出的文本
 */
function extractAssistantReply(responseData) {
  const choices = responseData && responseData.choices;
  const firstChoice = Array.isArray(choices) ? choices[0] : null;
  const message = firstChoice && firstChoice.message;
  const content = message && message.content;

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        return item && item.text ? item.text : '';
      })
      .filter(Boolean)
      .join('\n');
  }

  return sanitizeText(content);
}

/**
 * 调用 CloudBase AI 聊天接口，获取真实模型回复。
 * @param {Array} history - 聊天历史
 * @param {string} model - 模型名称
 * @returns {Promise<Object>} 模型回复结果
 */
async function requestCloudBaseAI(history, model) {
  const apiKey = sanitizeText(process.env.CLOUDBASE_APIKEY);
  // Base URL 已经带有 /v1，避免重复拼接导致最终请求地址返回 404。
  const chatUrl = `${CLOUDBASE_AI_BASE_URL}/chat/completions`;

  if (!apiKey) {
    throw new Error('云函数未配置 CLOUDBASE_API_KEY，暂时无法调用 CloudBase AI。');
  }

  const messages = buildModelMessages(history);
  const response = await postJson(chatUrl, {
    Authorization: `Bearer ${apiKey}`
  }, {
    model: sanitizeText(model) || DEFAULT_MODEL,
    messages,
    temperature: 0.7,
    stream: false
  });

  const responseData = response.data || {};
  const errorMessage = responseData.error && (responseData.error.message || responseData.error.code);
  const assistantReply = extractAssistantReply(responseData);

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(errorMessage || `AI 接口请求失败，HTTP 状态码：${response.statusCode}`);
  }

  if (!assistantReply) {
    throw new Error(errorMessage || 'AI 接口已返回，但没有拿到有效回复内容。');
  }

  return {
    reply: assistantReply,
    model: responseData.model || sanitizeText(model) || DEFAULT_MODEL,
    usage: responseData.usage || null,
    requestId: response.headers && (response.headers['x-request-id'] || response.headers['X-Request-Id']) || ''
  };
}

/**
 * 处理聊天请求，返回统一的对话结果结构。
 * @param {Object} event - 云函数入参
 * @returns {Object} 聊天结果
 */
async function handleChat(event) {
  const message = sanitizeText(event.message);
  const history = normalizeHistory(event.history);
  const model = sanitizeText(event.model) || DEFAULT_MODEL;

  if (!message) {
    return {
      success: false,
      message: '消息内容不能为空'
    };
  }

  const historyWithUserMessage = history.concat({
    role: 'user',
    content: message
  }).slice(-12);

  const historySummary = buildHistorySummary(historyWithUserMessage);

  try {
    const aiResult = await requestCloudBaseAI(historyWithUserMessage, model);

    return {
      success: true,
      reply: aiResult.reply,
      historyCount: historyWithUserMessage.length,
      model: aiResult.model,
      usage: aiResult.usage,
      requestId: aiResult.requestId,
      historySummary
    };
  } catch (err) {
    console.error('[sport_tool_fun2] CloudBase AI 调用失败:', err);
    return {
      success: false,
      message: err && err.message ? err.message : 'AI 服务调用失败',
      historyCount: historyWithUserMessage.length,
      model
    };
  }
}

// 云函数入口函数
exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const action = event && event.action;

  if (action === 'chat') {
    const result = await handleChat(event || {});
    return {
      ...result,
      openid: wxContext.OPENID,
      appid: wxContext.APPID,
      unionid: wxContext.UNIONID
    };
  }

  return {
    success: true,
    message: 'sport_tool_fun2 云函数已可用，请通过 action=chat 调用聊天能力。',
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID
  };
};
