// pages/index/index.js
const HERO_IMAGE_CLOUD_ID = 'cloud://cloud1-6gh7jgl8c5b16a83.636c-cloud1-6gh7jgl8c5b16a83-1398046944/sport_tool/pageview/index/物品处理-49ed9fb0-9c06-421e-9617-b923af5f7522-removebg-preview.png'

Page({
  data: {
    heroImageUrl: '',
    // 首页轮播入口配置：第一张进入查分，第二张进入知识库 AI 问答。
    actionBanners: [
      {
        key: 'score',
        tag: '+查分',
        title: '查分入口',
        desc: '提高流程效率，一键保存用户偏好与记录',
        summary: '按省份、项目和成绩快速查看参考分值',
        mainValue: '28',
        mainUnit: '省',
        metricList: [
          { value: '3类', label: '项目分类' },
          { value: '1步', label: '直达查询' },
          { value: 'AI', label: '辅助说明' }
        ],
        footerList: [
          { value: '23+', label: '热门规则' },
          { value: '19', unit: '项', label: '常用项目' },
          { value: '64%', label: '首页直达' }
        ],
        waveList: [
          { height: 18, tone: 'soft' },
          { height: 24, tone: 'soft' },
          { height: 20, tone: 'soft' },
          { height: 30, tone: 'dark' },
          { height: 46, tone: 'soft' },
          { height: 72, tone: 'dark' },
          { height: 96, tone: 'strong' },
          { height: 78, tone: 'dark' },
          { height: 52, tone: 'soft' },
          { height: 122, tone: 'strong' },
          { height: 168, tone: 'dark' },
          { height: 108, tone: 'soft' },
          { height: 66, tone: 'dark' },
          { height: 144, tone: 'strong' },
          { height: 110, tone: 'soft' },
          { height: 84, tone: 'dark' },
          { height: 42, tone: 'soft' },
          { height: 28, tone: 'soft' }
        ],
        path: '/pages/tool/tool_f/tool_f',
        themeClass: 'is-score'
      },
      {
        key: 'ai',
        tag: '+知识库',
        title: '体育专项AI智库',
        desc: '输入运动目标，点击进行提问',
        summary: '累计知识库调用量,点击进行提问 ',
        highlightValue: '7860',
        // 第二张顶部卡片的功能入口，按示意图展示为三块能力卡片。
        featureList: [
          { icon: '问', title: 'AI问答' },
          { icon: '训', title: '训练计划' },
          { icon: '复', title: '恢复建议' }
        ],
        // 第二张顶部卡片底部统计条，按三列数据展示。
        bottomStats: [
          { value: '59638', label: '累计调用' },
          { value: '7860', label: '智能问答' },
          { value: '+15%', label: '环比增长' }
        ],
        // 中部趋势图使用独立数据，便于后续单独调整图形节奏。
        trendBars: [
          { height: 18, tone: 'light' },
          { height: 34, tone: 'mid' },
          { height: 62, tone: 'light' },
          { height: 94, tone: 'mid' },
          { height: 126, tone: 'light' },
          { height: 160, tone: 'mid' },
          { height: 206, tone: 'focus' },
          { height: 132, tone: 'light' },
          { height: 86, tone: 'light' }
        ],
        indicatorList: [
          { height: 36, tone: 'light', label: '' },
          { height: 58, tone: 'light', label: ''},
          { height: 104, tone: 'mid', label: '' },
          { height: 84, tone: 'mid', label: '' },
          { height: 126, tone: 'light', label: '' },
          { height: 168, tone: 'mid', label: '' },
          { height: 218, tone: 'light', label: '' },
          { height: 188, tone: 'mid', label: '' },
          { height: 236, tone: 'light', label: '' },
          { height: 292, tone: 'focus', label: '' },
          { height: 168, tone: 'mid', label: '' },
          { height: 126, tone: 'light', label: '' }
         
        ],
        totalValue: '59,638',
        totalTag: '+15%',
        buttonText: '',
        quickTitle: '快速开始',
        quickDesc: '一步进行智能咨询',
        quickButtonText: '立即前往',
        path: '/pages/tool/tool_s/tool_s',
        themeClass: 'is-ai'
      }
    ],
    // 工具 S 独立展示在 action-card2 中，不参与快捷入口列表渲染。
    toolSCard: {
      title: '工具 S',
      desc: '进入 tool_s 页面，查看后续扩展功能',
      tag: '独立入口',
      path: '/pages/tool/tool_s/tool_s'
    },
    // 首页快捷入口配置，新增的工具页只需要在这里补充卡片即可。
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

  // 非 tabBar 页面使用 navigateTo，避免新增工具页无法跳转。
  navigatePage(path) {
    wx.navigateTo({
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

    // tabBar 页面和普通页面的跳转方式不同，这里统一做一次分流。
    const tabBarPages = [
      '/pages/index/index',
      '/pages/tool/tool_f/tool_f',
      '/pages/mine/mine'
    ]

    if (tabBarPages.includes(path)) {
      this.switchTabPage(path)
      return
    }

    this.navigatePage(path)
  },

  onShareAppMessage() {
    return {
      title: '代码肌，一个体育生给体育生做的工具',
      path: '/pages/index/index'
    }
  },

  onShareTimeline() {
    return {
      title: '代码肌，一个体育生给体育生做的工具',
      query: ''
    }
  }
})
