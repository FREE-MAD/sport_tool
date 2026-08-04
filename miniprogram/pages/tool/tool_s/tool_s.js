// pages/tool/tool_s/tool_s.js

// 当前页面关联的 AI 聊天云函数名称。
const CHAT_CLOUD_FUNCTION_NAME = 'sport_tool_fun2';

// 页面首屏快捷提问，方便用户快速体验聊天能力。
const QUICK_QUESTIONS = [
  '你能帮我做什么？',
  '体育成绩怎么评估？',
  '我该怎么提升训练效率？'
];

/**
 * 创建一条标准消息结构，统一前端消息列表渲染格式。
 * @param {string} role - 消息角色：assistant | user
 * @param {string} content - 消息文本
 * @param {Object} extra - 额外字段
 * @returns {Object} 标准消息对象
 */
function padNumber(value) {
  return value < 10 ? `0${value}` : String(value);
}

function createMessage(role, content, extra) {
  const now = new Date();
  const hour = padNumber(now.getHours());
  const minute = padNumber(now.getMinutes());

  return Object.assign({
    id: `${role}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    role,
    roleLabel: role === 'user' ? '我' : 'AI 助手',
    content,
    timeLabel: `${hour}:${minute}`,
    isError: false
  }, extra || {});
}

Page({
  data: {
    inputValue: '',
    sending: false,
    loading: false,
    scrollIntoView: '',
    quickQuestions: QUICK_QUESTIONS,
    messageList: []
  },

  onLoad: function () {
    // 预留生命周期，后续可在这里补充 tool_s 页面的初始化逻辑。
    this._initChatMessages();
  },

  /**
   * 初始化聊天首屏内容，给用户一个明确的使用入口。
   */
  _initChatMessages: function () {
    const welcomeMessage = createMessage(
      'assistant',
      '你好，我是工具 S 的 AI 助手。你可以问我体育成绩、训练建议，或者当前小程序功能怎么使用。'
    );

    this.setData({
      messageList: [welcomeMessage],
      scrollIntoView: welcomeMessage.id
    });
  },

  /**
   * 输入框内容变更时同步 data，保持按钮状态和发送内容一致。
   * @param {Object} event - 输入事件对象
   */
  handleInput: function (event) {
    this.setData({
      inputValue: event.detail.value || ''
    });
  },

  /**
   * 点击快捷问题时直接把问题带入输入框并发送，减少首次使用门槛。
   * @param {Object} event - 点击事件对象
   */
  handleQuickQuestion: function (event) {
    const value = event.currentTarget.dataset.value || '';
    if (!value || this.data.sending) return;
    const page = this;

    this.setData({
      inputValue: value
    }, function () {
      page.handleSend();
    });
  },

  /**
   * 点击发送或键盘确认时，调用云函数获取 AI 回复。
   */
  handleSend: function () {
    const message = (this.data.inputValue || '').trim();
    const page = this;
    if (!message || this.data.sending) {
      if (!message) {
        wx.showToast({
          title: '请输入内容',
          icon: 'none'
        });
      }
      return;
    }

    const userMessage = createMessage('user', message);
    const nextMessageList = this.data.messageList.concat(userMessage);

    this.setData({
      inputValue: '',
      sending: true,
      loading: true,
      messageList: nextMessageList,
      scrollIntoView: 'chat-loading-anchor'
    });

    wx.cloud.callFunction({
      name: CHAT_CLOUD_FUNCTION_NAME,
      data: {
        action: 'chat',
        message,
        history: this._buildChatHistory(nextMessageList)
      },
      success: function (res) {
        const result = (res && res.result) || {};
        const replyText = result.success === false
          ? (result.message || '这次请求没有成功，请稍后重试。')
          : (result.reply || '我暂时还没有组织好回复，请稍后再试一次。');
        const assistantMessage = createMessage('assistant', replyText);

        page.setData({
          sending: false,
          loading: false,
          messageList: page.data.messageList.concat(assistantMessage),
          scrollIntoView: assistantMessage.id
        });
      },
      fail: function (err) {
        console.error('[tool_s] 调用 AI 聊天云函数失败:', err);
        const assistantErrorMessage = createMessage(
          'assistant',
          '当前网络或云函数有点忙，我先记下你的问题了。请稍后再试一次。',
          { isError: true }
        );

        page.setData({
          sending: false,
          loading: false,
          messageList: page.data.messageList.concat(assistantErrorMessage),
          scrollIntoView: assistantErrorMessage.id
        });
      }
    });
  },

  /**
   * 根据当前聊天列表构造传给云函数的历史消息，避免请求体无限增大。
   * @param {Array} messageList - 当前页面消息列表
   * @returns {Array} 轻量历史消息
   */
  _buildChatHistory: function (messageList) {
    return (messageList || [])
      .slice(-12)
      .map((item) => ({
        role: item.role,
        content: item.content
      }));
  }
});
