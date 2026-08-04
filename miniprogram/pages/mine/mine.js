// mine.js
const { ensureOpenId, getRuntimeEnvVersion } = require('../../utils/globalSubmit.js');
const { createInitialPageData, getEnabledProjects, buildTypeList } = require('../tool/tool_f/tool_f_rules.js');

const MINE_USER_INFO_STORAGE_KEY = 'mineUserInfo';
const TOOL_F_HISTORY_DETAIL_STORAGE_KEY = 'toolFHistoryDetail';
const TOOL_F_PROVINCE_META = createInitialPageData();

// 预先缓存省份键值映射，方便“我的偏好”把编码转换为中文名称展示。
const PROVINCE_NAME_MAP = TOOL_F_PROVINCE_META.provinceKeys.reduce((result, provinceKey, index) => {
  result[provinceKey] = TOOL_F_PROVINCE_META.provinceList[index] || provinceKey;
  return result;
}, {});

Page({
  data: {
    userInfo: {},
    hasUserInfo: false,
    canIUseGetUserProfile: false,
    stats: [
      { value: '--', label: '历史记录' },
      { value: '--', label: '默认省份' },
      { value: '--', label: '最近总分' }
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
      },
      {
        title: 'AI 问答',
        desc: '进入工具 S，继续提问评分规则、训练方案和报考问题。',
        badge: '新增',
        icon: 'AI',
        iconBg: 'linear-gradient(135deg, #8b6bff 0%, #5f63ff 100%)',
        iconColor: '#ffffff',
        type: 'navigate',
        path: '/pages/tool/tool_s/tool_s'
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
    ],
    preferenceSummaryRows: [],
    preferenceUpdatedAtText: '',
    hasPreference: false,
    historyLoading: false,
    scoreHistoryList: [],
    historyEmptyText: '你还没有查分记录，去查分页提交一次成绩后，这里就会自动展示。'
  },

  onLoad() {
    if (wx.getUserProfile) {
      this.setData({
        canIUseGetUserProfile: true
      });
    }

    // 本地缓存头像昵称，避免每次进入“我的”都重新授权。
    this._loadCachedUserInfo();
  },

  onShow() {
    this.loadMinePageData();
  },

  // 读取本地缓存的头像昵称，让个人中心首屏更稳定。
  _loadCachedUserInfo() {
    const cachedUserInfo = wx.getStorageSync(MINE_USER_INFO_STORAGE_KEY);
    if (!cachedUserInfo) return;

    this.setData({
      userInfo: cachedUserInfo,
      hasUserInfo: true
    });
  },

  // 统一封装 login 云函数动作调用，避免页面里重复写 callFunction 样板代码。
  _callLoginAction(action, extraData) {
    const runtimeEnvVersion = getRuntimeEnvVersion();
    return ensureOpenId(runtimeEnvVersion)
      .then(() => new Promise((resolve, reject) => {
        wx.cloud.callFunction({
          name: 'login',
          data: Object.assign({
            action,
            runtimeEnvVersion
          }, extraData || {}),
          success: (res) => {
            const result = res && res.result ? res.result : {};
            if (result.success === false) {
              reject(new Error(result.message || '请求失败'));
              return;
            }
            resolve(result);
          },
          fail: reject
        });
      }));
  },

  // 统一拉取“我的偏好”和“查分历史”，让 mine 页每次显示的都是当前用户最新数据。
  loadMinePageData() {
    this.setData({
      historyLoading: true
    });

    Promise.all([
      this._callLoginAction('getToolPreference', {
        toolKey: 'tool_f'
      }),
      this._callLoginAction('getScoreHistory', {
        limit: 10
      })
    ])
      .then(([preferenceResult, historyResult]) => {
        const preference = preferenceResult.preference || null;
        const historyList = this._normalizeHistoryList(historyResult.list || []);

        this.setData({
          preferenceSummaryRows: this._buildPreferenceSummaryRows(preference),
          preferenceUpdatedAtText: preferenceResult.updatedAt ? this._formatDateTime(preferenceResult.updatedAt) : '',
          hasPreference: !!preference,
          scoreHistoryList: historyList,
          historyLoading: false,
          stats: this._buildStats(historyList, preference)
        });
      })
      .catch((err) => {
        console.error('[mine] 加载个人中心数据失败:', err);
        this.setData({
          historyLoading: false,
          scoreHistoryList: []
        });
        wx.showToast({
          title: '个人中心加载失败',
          icon: 'none'
        });
      });
  },

  // 查分历史卡片补齐展示字段，页面层直接渲染即可。
  _normalizeHistoryList(list) {
    return (list || []).map((item) => ({
      id: item.id || '',
      totalScoreText: this._formatScore(item.totalScore),
      projectTitle: [item.province, item.gender, item.mainType].filter(Boolean).join(' · '),
      projectSubtitle: item.specialType || '未区分专项分类',
      submitTimeText: item.submitTimeText || this._formatDateTime(item.submitTimestamp),
      projectCountText: '共 ' + (item.projectCount || 0) + ' 项',
      scorePreviewText: item.scorePreviewText || '点击查看本次查分明细',
      detailPayload: item.detailPayload || {}
    }));
  },

  // “我的偏好”把 tool_f 已保存的默认选择翻译成用户能直接看懂的中文摘要。
  _buildPreferenceSummaryRows(preference) {
    if (!preference) {
      return [];
    }

    const provinceKey = preference.provinceKey || '';
    const genderText = Number.isInteger(preference.genderIndex)
      ? (preference.genderIndex === 0 ? '男' : '女')
      : '未设置';

    return [
      {
        label: '默认省份',
        value: this._getProvinceName(provinceKey)
      },
      {
        label: '默认性别',
        value: genderText
      },
      {
        label: '主项大类',
        value: this._getProjectTypeLabel(provinceKey, 'mainProject', preference.main && preference.main.typeKey)
      },
      {
        label: '专项大类',
        value: this._getProjectTypeLabel(provinceKey, 'specialProject', preference.special && preference.special.typeKey)
      },
      {
        label: '辅项大类',
        value: preference.auxiliary
          ? this._getProjectTypeLabel(provinceKey, 'auxiliaryProject', preference.auxiliary.typeKey)
          : '当前省份未启用'
      }
    ];
  },

  // 顶部三个统计卡同步展示：历史数量、默认省份、最近总分。
  _buildStats(historyList, preference) {
    const firstHistory = (historyList || [])[0] || null;
    const defaultProvince = preference ? this._getProvinceName(preference.provinceKey) : '未设置';

    return [
      { value: String((historyList || []).length), label: '历史记录' },
      { value: defaultProvince, label: '默认省份' },
      { value: firstHistory ? firstHistory.totalScoreText : '--', label: '最近总分' }
    ];
  },

  // 根据省份编码和作用域编码获取中文项目类型名称。
  _getProjectTypeLabel(provinceKey, scopeKey, typeKey) {
    if (!provinceKey || !scopeKey || !typeKey) {
      return '未设置';
    }

    const projectList = getEnabledProjects(provinceKey, scopeKey);
    const typeKeys = projectList.map((item) => item.code);
    const typeLabels = buildTypeList(provinceKey, scopeKey, projectList);
    const matchedIndex = typeKeys.indexOf(typeKey);
    return matchedIndex >= 0 ? (typeLabels[matchedIndex] || '未设置') : '未设置';
  },

  _getProvinceName(provinceKey) {
    return PROVINCE_NAME_MAP[provinceKey] || '未设置';
  },

  _formatDateTime(timestamp) {
    const date = new Date(timestamp || Date.now());
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return year + '-' + month + '-' + day + ' ' + hour + ':' + minute;
  },

  _formatScore(score) {
    const numeric = Number(score);
    if (!Number.isFinite(numeric)) {
      return '--';
    }
    return String(Math.round(numeric * 100) / 100);
  },

  applyUserInfo(userInfo) {
    if (!userInfo) {
      return;
    }

    wx.setStorageSync(MINE_USER_INFO_STORAGE_KEY, userInfo);

    this.setData({
      userInfo,
      hasUserInfo: true
    });
  },

  getUserProfile() {
    wx.getUserProfile({
      desc: '展示用户信息',
      success: (res) => {
        this.applyUserInfo(res.userInfo);
      }
    });
  },

  getUserInfo(e) {
    this.applyUserInfo(e.detail.userInfo);
  },

  // 常用入口同时兼容 tabBar 页面和普通页面，避免跳转方式不匹配。
  handleMenuTap(event) {
    const { type, path, message } = event.currentTarget.dataset;

    if (type === 'tab' && path) {
      wx.switchTab({
        url: path
      });
      return;
    }

    if (type === 'navigate' && path) {
      wx.navigateTo({
        url: path
      });
      return;
    }

    if (message) {
      wx.showToast({
        title: message,
        icon: 'none'
      });
    }
  },

  // 点击历史卡片后，把完整明细暂存到本地，再跳结果页复用现有展示 UI。
  openHistoryDetail(event) {
    const historyId = event.currentTarget.dataset.historyId;
    const targetItem = (this.data.scoreHistoryList || []).find((item) => item.id === historyId);
    if (!targetItem || !targetItem.detailPayload) {
      wx.showToast({
        title: '历史详情不存在',
        icon: 'none'
      });
      return;
    }

    wx.setStorageSync(TOOL_F_HISTORY_DETAIL_STORAGE_KEY, targetItem.detailPayload);
    wx.navigateTo({
      url: '/pages/tool/tool_f/tool_f_detailed/tool_f_detailed?from=history'
    });
  }
});
