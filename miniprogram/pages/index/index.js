// pages/index/index.js
const { ensureOpenId, getRuntimeEnvVersion } = require('../../utils/globalSubmit.js')

const HERO_IMAGE_CLOUD_ID = 'cloud://cloud1-6gh7jgl8c5b16a83.636c-cloud1-6gh7jgl8c5b16a83-1398046944/sport_tool/pageview/index/物品处理-49ed9fb0-9c06-421e-9617-b923af5f7522-removebg-preview.png'
const INDEX_COLLECT_FORM_STORAGE_KEY = 'indexCollectForm'
const INDEX_COLLECT_TOOL_KEY = 'index_collect_form'
const GENDER_OPTIONS = ['男', '女', '保密']
const ROLE_OPTIONS = ['学生', '家长', '教练', '其他']

function createEmptyCollectForm() {
  return {
    name: '',
    gender: '',
    age: '',
    phone: '',
    region: [],
    addressDetail: '',
    role: '',
    schoolName: '',
    remark: ''
  }
}

function formatDateTime(timestamp) {
  const date = new Date(timestamp || Date.now())
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return year + '-' + month + '-' + day + ' ' + hour + ':' + minute
}

Page({
  data: {
    heroImageUrl: '',
    genderOptions: GENDER_OPTIONS,
    roleOptions: ROLE_OPTIONS,
    collectForm: createEmptyCollectForm(),
    collectRegionText: '请选择所在地区',
    collectSubmitting: false,
    collectSavedAtText: '',
    // 首页轮播入口配置：第一张进入查分，第二张进入知识库 AI 问答。
    actionBanners: [
      {
        key: 'score',
        // visible 不配置时默认展示，便于后续继续按配置控制轮播卡片显隐。
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
        // 这里先关闭第二张轮播卡片渲染，后续需要恢复时改为 true 或直接移除该字段即可。
        visible: false,
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
    this.loadCollectForm()
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

  // 首页资料采集表单先从本地回填，再尝试读取云端记录，确保用户再次进入时能继续编辑。
  loadCollectForm() {
    const cachedForm = wx.getStorageSync(INDEX_COLLECT_FORM_STORAGE_KEY)
    if (cachedForm) {
      this.applyCollectForm(cachedForm)
    }

    this.callLoginAction('getToolPreference', {
      toolKey: INDEX_COLLECT_TOOL_KEY
    })
      .then((result) => {
        const preference = result && result.preference ? result.preference : null
        if (!preference) {
          return
        }

        this.applyCollectForm(preference, {
          collectSavedAtText: result.updatedAt ? '最近保存：' + formatDateTime(result.updatedAt) : ''
        })
      })
      .catch((err) => {
        console.warn('[index] 读取首页采集表单失败，继续使用本地缓存:', err && err.message ? err.message : err)
      })
  },

  // 统一封装 login 云函数动作调用，首页后续继续扩展别的用户偏好时可以直接复用。
  callLoginAction(action, extraData) {
    const runtimeEnvVersion = getRuntimeEnvVersion()
    return ensureOpenId(runtimeEnvVersion)
      .then(() => new Promise((resolve, reject) => {
        wx.cloud.callFunction({
          name: 'login',
          data: Object.assign({
            action,
            runtimeEnvVersion
          }, extraData || {}),
          success: (res) => {
            const result = res && res.result ? res.result : {}
            if (result.success === false) {
              reject(new Error(result.message || '请求失败'))
              return
            }

            resolve(result)
          },
          fail: reject
        })
      }))
  },

  // 所有字段都先归一化后再写入 data，避免 region 非数组等情况影响页面渲染。
  applyCollectForm(form, extraData) {
    const normalizedForm = this.normalizeCollectForm(form)

    this.setData(Object.assign({
      collectForm: normalizedForm,
      collectRegionText: this.buildCollectRegionText(normalizedForm.region)
    }, extraData || {}))
  },

  normalizeCollectForm(form) {
    const source = form || {}
    const region = Array.isArray(source.region) ? source.region.filter(Boolean).slice(0, 3) : []

    return {
      name: (source.name || '').trim(),
      gender: (source.gender || '').trim(),
      age: source.age === 0 ? '0' : String(source.age || '').trim(),
      phone: String(source.phone || '').replace(/\s+/g, ''),
      region,
      addressDetail: (source.addressDetail || '').trim(),
      role: (source.role || '').trim(),
      schoolName: (source.schoolName || '').trim(),
      remark: (source.remark || '').trim()
    }
  },

  buildCollectRegionText(region) {
    if (!Array.isArray(region) || !region.length) {
      return '请选择所在地区'
    }

    return region.join(' / ')
  },

  handleCollectInput(event) {
    const field = event.currentTarget.dataset.field
    let value = event.detail && event.detail.value ? event.detail.value : ''

    if (!field) {
      return
    }

    if (field === 'phone') {
      value = value.replace(/[^\d]/g, '').slice(0, 11)
    }

    if (field === 'age') {
      value = value.replace(/[^\d]/g, '').slice(0, 2)
    }

    this.setData({
      ['collectForm.' + field]: value
    })
  },

  handleGenderSelect(event) {
    const value = event.currentTarget.dataset.value || ''
    this.setData({
      'collectForm.gender': value
    })
  },

  handleRoleSelect(event) {
    const value = event.currentTarget.dataset.value || ''
    this.setData({
      'collectForm.role': value
    })
  },

  handleRegionChange(event) {
    const region = event.detail && Array.isArray(event.detail.value) ? event.detail.value : []
    this.setData({
      'collectForm.region': region,
      collectRegionText: this.buildCollectRegionText(region)
    })
  },

  validateCollectForm(form) {
    const normalizedForm = this.normalizeCollectForm(form)

    if (!normalizedForm.name) {
      return '请先填写姓名'
    }

    if (!normalizedForm.gender) {
      return '请先选择性别'
    }

    if (!normalizedForm.age) {
      return '请先填写年龄'
    }

    const ageNumber = Number(normalizedForm.age)
    if (!Number.isFinite(ageNumber) || ageNumber < 1 || ageNumber > 99) {
      return '年龄请填写 1-99'
    }

    if (!/^1\d{10}$/.test(normalizedForm.phone)) {
      return '请输入正确的11位手机号'
    }

    if (!normalizedForm.region.length) {
      return '请先选择所在地区'
    }

    if (!normalizedForm.addressDetail) {
      return '请先填写详细地址'
    }

    if (!normalizedForm.role) {
      return '请先选择身份'
    }

    return ''
  },

  // 点击提交后会先保存在本地，再同步到当前 openid 的用户偏好里，方便后续继续做名单管理。
  submitCollectForm() {
    if (this.data.collectSubmitting) {
      return
    }

    const normalizedForm = this.normalizeCollectForm(this.data.collectForm)
    const errorMessage = this.validateCollectForm(normalizedForm)

    if (errorMessage) {
      wx.showToast({
        title: errorMessage,
        icon: 'none'
      })
      return
    }

    wx.setStorageSync(INDEX_COLLECT_FORM_STORAGE_KEY, normalizedForm)

    this.setData({
      collectSubmitting: true
    })

    this.callLoginAction('saveToolPreference', {
      toolKey: INDEX_COLLECT_TOOL_KEY,
      preference: normalizedForm
    })
      .then((result) => {
        this.applyCollectForm(normalizedForm, {
          collectSubmitting: false,
          collectSavedAtText: '最近保存：' + (result.updatedAt ? formatDateTime(result.updatedAt) : formatDateTime(Date.now()))
        })

        wx.showToast({
          title: '资料已提交',
          icon: 'success'
        })
      })
      .catch((err) => {
        console.error('[index] 保存首页采集表单失败:', err)
        this.setData({
          collectSubmitting: false,
          collectSavedAtText: '已保存到本机，云端同步稍后重试'
        })

        wx.showToast({
          title: '已保存到本机',
          icon: 'none'
        })
      })
  },

  handleCollectReset() {
    const page = this

    wx.showModal({
      title: '清空当前表单',
      content: '清空后需要重新填写本页采集内容，是否继续？',
      success(res) {
        if (!res.confirm) {
          return
        }

        wx.removeStorageSync(INDEX_COLLECT_FORM_STORAGE_KEY)
        page.applyCollectForm(createEmptyCollectForm(), {
          collectSavedAtText: ''
        })

        page.callLoginAction('clearToolPreference', {
          toolKey: INDEX_COLLECT_TOOL_KEY
        }).catch((err) => {
          console.warn('[index] 清空首页采集表单云端记录失败:', err && err.message ? err.message : err)
        })

        wx.showToast({
          title: '表单已清空',
          icon: 'success'
        })
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

  handleAICardTap() {
    wx.showToast({
      title: '前方的区域以后再来探索吧',
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
