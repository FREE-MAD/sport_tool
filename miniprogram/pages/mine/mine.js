// mine.js
Page({
  data: {
    userInfo: {},
    hasUserInfo: false,
    canIUseGetUserProfile: false,
    stats: [
      { value: '2', label: '常用入口' },
      { value: '1', label: '授权方式' },
      { value: '浅色', label: '页面风格' }
    ],
    quickMenus: [
      {
        title: '前往查分',
        desc: '回到查分页，继续选择地区、性别与项目条件。',
        badge: '核心',
        icon: '查',
        iconBg: 'linear-gradient(135deg, #4d93ff 0%, #2f6ff7 100%)',
        iconColor: '#ffffff',
        type: 'tab',
        path: '/pages/tool/tool_f/tool_f'
      },
      {
        title: '返回首页',
        desc: '回到首页查看主视觉、统一入口和页面说明。',
        badge: '导航',
        icon: '首',
        iconBg: 'linear-gradient(135deg, #53d9c2 0%, #26b89b 100%)',
        iconColor: '#ffffff',
        type: 'tab',
        path: '/pages/index/index'
      }
    ],
    serviceMenus: [
      {
        title: '授权状态更清楚',
        desc: '未授权时显示待授权状态和占位头像，授权后立即切换为真实头像昵称。'
      },
      {
        title: '视觉标准已统一',
        desc: '整体改成和首页、查分页一致的浅色卡片体系，信息层级会更稳定。'
      },
      {
        title: '逻辑保持原样',
        desc: '头像昵称授权、Tab 跳转能力都保留，主要重构的是页面结构与呈现。'
      }
    ]
  },

  onLoad() {
    if (wx.getUserProfile) {
      this.setData({
        canIUseGetUserProfile: true
      })
    }
  },

  applyUserInfo(userInfo) {
    if (!userInfo) {
      return
    }

    this.setData({
      userInfo,
      hasUserInfo: true
    })
  },

  getUserProfile() {
    wx.getUserProfile({
      desc: '展示用户信息',
      success: (res) => {
        this.applyUserInfo(res.userInfo)
      }
    })
  },

  getUserInfo(e) {
    this.applyUserInfo(e.detail.userInfo)
  },

  handleMenuTap(event) {
    const { type, path, message } = event.currentTarget.dataset

    if (type === 'tab' && path) {
      wx.switchTab({
        url: path
      })
      return
    }

    if (message) {
      wx.showToast({
        title: message,
        icon: 'none'
      })
    }
  }
})
