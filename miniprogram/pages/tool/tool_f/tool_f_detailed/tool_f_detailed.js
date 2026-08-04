// pages/tool/tool_f/tool_f_detailed/tool_f_detailed.js
const TOOL_F_HISTORY_DETAIL_STORAGE_KEY = 'toolFHistoryDetail';

Page({
  data: {
    province: '',
    gender: '',
    mainType: '',
    specialType: '',
    totalScore: 0,
    mainScores: [],
    specialScores: [],
    allScores: [],
    aiFallback: ''
  },

  onLoad(options) {
    console.log('[tool_f_detailed] onLoad');

    // 从“我的-查分历史”进入时，优先读取本地暂存的历史详情数据。
    if (options && options.from === 'history') {
      const historyPayload = wx.getStorageSync(TOOL_F_HISTORY_DETAIL_STORAGE_KEY);
      if (historyPayload) {
        console.log('[tool_f_detailed] 从历史记录读取评分数据:', JSON.stringify(historyPayload));
        this.setScoreData(historyPayload);
      }
    }

    const eventChannel = this.getOpenerEventChannel();
    if (eventChannel) {
      eventChannel.on('scoreResult', (data) => {
        console.log('[tool_f_detailed] 收到评分数据:', JSON.stringify(data));
        this.setScoreData(data);
      });
    }
  },

  setScoreData(data) {
    const mainScores = (data.mainScores || []).map((item) => ({
      name: item.name || '',
      code: item.code || '',
      score: item.score || 0,
      value: item.value || '',
      unit: item.unit || ''
    }));

    const specialScores = (data.specialScores || []).map((item) => ({
      name: item.name || '',
      code: item.code || '',
      score: item.score || 0,
      value: item.value || '',
      unit: item.unit || '',
      typeLabel: item.typeLabel || ''
    }));

    const aiInfo = data.aiFallback
      ? (data.aiFallback.comment || JSON.stringify(data.aiFallback))
      : '';

    this.setData({
      province: data.province || '',
      gender: data.gender || '',
      mainType: data.mainType || '',
      specialType: data.specialType || '',
      totalScore: data.totalScore || 0,
      mainScores,
      specialScores,
      allScores: [...mainScores, ...specialScores],
      aiFallback: aiInfo
    });
  },

  goBack() {
    wx.navigateBack();
  }
});
