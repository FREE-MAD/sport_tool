// pages/index/index.js
Page({
  data: {
    message: 'Hello, 小程序!',
  },

  onLoad() {
    // 页面加载时触发
  },

  onShow() {
    // 页面显示时触发
  },

  goToToolF() {
    wx.navigateTo({
      url: '/pages/tool/tool_f/tool_f',
    });
  },
});
