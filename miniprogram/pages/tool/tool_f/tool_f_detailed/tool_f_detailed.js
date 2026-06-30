// pages/tool/tool_f/tool_f_detailed/tool_f_detailed.js
Page({
  data: {
    province: '',
    gender: '',
    mainType: '',
    specialType: '',
    totalScore: 0,
    mainScores: [],
    specialScores: [],
    aiFallback: ''
  },

  onLoad(options) {
    console.log('[tool_f_detailed] onLoad');

    const eventChannel = this.getOpenerEventChannel();
    if (eventChannel) {
      eventChannel.on('scoreResult', (data) => {
        console.log('[tool_f_detailed] 收到评分数据:', JSON.stringify(data));
        this.setScoreData(data);
      });
    }
  },

  setScoreData(data) {
    const mainScores = (data.mainScores || []).map(item => ({
      name: item.name || '',
      code: item.code || '',
      score: item.score || 0,
      value: item.value || '',
      unit: item.unit || ''
    }));

    const specialScores = (data.specialScores || []).map(item => ({
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
      aiFallback: aiInfo
    });
  },

  goBack() {
    wx.navigateBack();
  }
});
