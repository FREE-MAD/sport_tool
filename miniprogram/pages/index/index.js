// pages/index/index.js
const HERO_IMAGE_CLOUD_ID = 'cloud://cloud1-6gh7jgl8c5b16a83.636c-cloud1-6gh7jgl8c5b16a83-1398046944/sport_tool/pageview/index/物品处理-49ed9fb0-9c06-421e-9617-b923af5f7522-removebg-preview.png'

Page({
  data: {
    heroImageUrl: '',
    quickCards: [
      {
        title: '查分入口',
        desc: '直接进入查分页，开始选择项目与条件',
        icon: '查',
        iconBg: 'linear-gradient(135deg, #4d93ff 0%, #2f6ff7 100%)',
        iconColor: '#ffffff',
        path: '/pages/tool/tool_f/tool_f'
      },
      {
        title: '个人中心',
        desc: '查看头像、授权状态和常用入口',
        icon: '我',
        iconBg: 'linear-gradient(135deg, #53d9c2 0%, #26b89b 100%)',
        iconColor: '#ffffff',
        path: '/pages/mine/mine'
      }
    ]
  },

  onLoad() {
    this.loadHeroImage()
  },

  loadHeroImage() {
    if (!wx.cloud || !wx.cloud.getTempFileURL) {
      return
    }

    wx.cloud.getTempFileURL({
      fileList: [HERO_IMAGE_CLOUD_ID],
      success: (res) => {
        const file = res.fileList && res.fileList[0]
        if (file && file.tempFileURL) {
          this.setData({
            heroImageUrl: file.tempFileURL
          })
        }
      }
    })
  },

  switchTabPage(path) {
    wx.switchTab({
      url: path
    })
  },

  showExploreToast() {
    wx.showToast({
      title: '前方的区域<><<>>>以后再来探索吧!!!!!',
      icon: 'none'
    })
  },

  handleQuickCard(event) {
    const { path } = event.currentTarget.dataset
    if (!path) {
      return
    }
    this.switchTabPage(path)
  }
})
