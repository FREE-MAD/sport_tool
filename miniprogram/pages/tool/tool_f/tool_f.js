/**
 * ============================================================
 * 文件名称：tool_f.js
 * 文件定位：体育查分工具 - 交互层（页面主入口文件）
 * 主要职责：
 *   1. 作为微信小程序 Page 的入口，负责页面生命周期管理
 *   2. 处理所有用户交互事件（选择器切换、输入、按钮点击等）
 *   3. 调用规则层（tool_f_rules.js）返回标准化数据结构
 *   4. 通过 setData 将规则层数据映射到页面 data，驱动视图更新
 *   5. 不直接参与评分规则解析或提交组包，保持职责单一
 * 依赖模块：
 *   - tool_f_rules.js：规则层，提供数据构建、时间格式化、编码生成等能力
 *   - tool_f_submit.js：提交层，提供输入校验、表单提交、云函数调用等能力
 * ============================================================
 */

// 从全局提交工具中复用 openid 确保逻辑和运行环境识别逻辑
const { ensureOpenId, getRuntimeEnvVersion } = require('../../../utils/globalSubmit.js');

// 从规则层导入所需的工具函数和常量映射
const {
  SCOPE_DATA_KEY_MAP,        // 作用域（专项/辅助）到页面 data 字段的映射表
  buildMainProjectState,     // 构建主项状态（主项子列表 + 多选一组）
  buildProjectGroup,         // 构建专项/辅助项目的完整分组状态
  buildTypeList,             // 根据省份规则构建项目类型显示列表
  clampIndex,                // 数组下标越界保护（统一夹取到合法范围）
  clampTimePickerValue,      // 时间选择器索引数组的越界保护
  createEmptyProjectGroup,   // 创建一个空的项目分组（用于无数据时的兜底）
  createInitialPageData,     // 构建页面首屏默认 data（基于首个省份规则）
  formatTimeDisplay,         // 将时间选择器索引格式化为「xx分 xx秒 xx毫秒」展示字符串
  formatTimeValue,           // 将时间选择器索引格式化为「mm:ss.SSS」提交值字符串
  getDefaultMainCode,        // 获取当前省份的默认主项编码
  getEnabledProjects         // 获取指定省份指定作用域下已启用的项目列表
} = require('./tool_f_rules.js');

// 从提交层导入提交相关的方法集合（校验、提交、云函数调用等）
const submitMethods = require('./tool_f_submit.js');

/**
 * 交互层方法集合
 * 设计原则：所有事件处理器仅做三件事 ——
 *   1. 从事件对象（e）中提取用户输入
 *   2. 调用规则层函数计算新的 state
 *   3. 通过 setData 更新页面数据
 */
const interactionMethods = {

  /**
   * 页面生命周期：页面加载时触发
   * 作用：调试日志输出，确认页面初始化时各项目列表是否正确加载
   * 注意：各列表数据实际由 createInitialPageData() 在 Page 构造时已注入 data
   */
  onLoad() {
    // 用户偏好保存使用轻量防抖，避免频繁点击选择器时连续触发云函数
    this._preferenceSaveTimer = null;
    // 回填用户偏好时临时关闭自动保存，避免“刚读出偏好又立刻写回”的循环
    this._preferenceApplying = false;
    console.log('[tool_f] onLoad, provinceList:', this.data.provinceList);
    console.log('[tool_f] mainTypeList:', this.data.mainTypeList);
    console.log('[tool_f] specialTypeList:', this.data.specialTypeList);
    console.log('[tool_f] auxiliaryTypeList:', this.data.auxiliaryTypeList);
    // 页面加载后按当前 openid 读取该用户上次使用的省份和项目偏好
    this._loadUserPreference();
  },

  /**
   * 页面隐藏时触发
   * 作用：尽量把防抖中的偏好保存请求立即落库，减少切页丢失偏好的概率
   */
  onHide() {
    this._flushUserPreferenceSave();
  },

  /**
   * 页面卸载时触发
   * 作用：与 onHide 双保险，确保用户离开页面前尽量完成偏好保存
   */
  onUnload() {
    this._flushUserPreferenceSave();
  },

  /**
   * 获取当前选中省份的编码键（如 'guangdong'、'hunan' 等）
   * @returns {string} 省份编码键，未选中时返回空字符串
   */
  _getCurrentProvinceKey() {
    return this.data.provinceKeys[this.data.provinceIndex] || '';
  },

  /**
   * 根据作用域键获取对应的 data 字段映射配置
   * 作用：统一 specialProject 和 auxiliaryProject 在 data 中的字段访问路径
   * @param {string} scopeKey - 作用域键：'specialProject'（专项）| 'auxiliaryProject'（辅助）
   * @returns {Object} 包含 typeKeys / typeList / typeIndex / group 四个 data 字段名的映射对象
   */
  _getScopeMap(scopeKey) {
    return SCOPE_DATA_KEY_MAP[scopeKey] || SCOPE_DATA_KEY_MAP.specialProject;
  },

  /**
   * 构建专项/辅助某个作用域的偏好快照
   * 说明：这里只记录用户常用选择项，不记录成绩值，避免下次进来自动回填旧分数
   * @param {string} scopeKey - 'specialProject' | 'auxiliaryProject'
   * @returns {Object} 该作用域当前的偏好结构
   */
  _buildScopePreference(scopeKey) {
    const scopeMap = this._getScopeMap(scopeKey);
    const group = this.data[scopeMap.group] || createEmptyProjectGroup(scopeKey);
    const typeKeys = this.data[scopeMap.typeKeys] || [];
    const typeIndex = parseInt(this.data[scopeMap.typeIndex], 10) || 0;
    const currentSub = (group.subList || [])[group.subIndex] || null;
    const currentSkill = group.useSkillPicker ? group.currentSkillItem : null;

    return {
      typeKey: typeKeys[typeIndex] || group.typeKey || '',
      groupKey: group.groupKey || '',
      subCode: currentSub ? currentSub.code : '',
      skillCode: currentSkill ? currentSkill.code : '',
      skillChooseSelectedCodes: (group.skillChooseGroups || []).map((item) => item.selectedCode || '')
    };
  },

  /**
   * 构建当前页面整体偏好对象
   * 记录内容：
   *   1. 省份
   *   2. 性别
   *   3. 主项大类与多选一分组选项
   *   4. 专项当前选中的大类/分组/子项/技能
   *   5. 辅项当前选中的大类/分组/子项/技能
   * @returns {Object} 可直接写入云端用户记录的偏好对象
   */
  _buildUserPreference() {
    return {
      provinceKey: this._getCurrentProvinceKey(),
      genderIndex: this.data.genderIndex,
      main: {
        typeKey: this.data.mainTypeKeys[this.data.mainTypeIndex] || '',
        chooseSelectedCodes: (this.data.mainChooseGroups || []).map((group) => group.selectedCode || '')
      },
      special: this._buildScopePreference('specialProject'),
      auxiliary: this.data.auxiliaryEnabled ? this._buildScopePreference('auxiliaryProject') : null
    };
  },

  /**
   * 调度偏好保存
   * 设计原因：项目切换会触发频繁 setData，立即保存会造成大量无意义云函数请求
   */
  _scheduleSaveUserPreference() {
    if (this._preferenceApplying) return;

    if (this._preferenceSaveTimer) {
      clearTimeout(this._preferenceSaveTimer);
    }

    this._preferenceSaveTimer = setTimeout(() => {
      this._preferenceSaveTimer = null;
      this._persistUserPreference();
    }, 500);
  },

  /**
   * 立即执行待保存的偏好请求
   * 场景：页面切走 / 卸载前，把防抖里的最后一次偏好保存落库
   */
  _flushUserPreferenceSave() {
    if (!this._preferenceSaveTimer) return;
    clearTimeout(this._preferenceSaveTimer);
    this._preferenceSaveTimer = null;
    this._persistUserPreference();
  },

  /**
   * 将当前页面偏好保存到登录用户记录中
   * 存储方式：按 openid 写入 login 云函数对应的用户集合，做到不同用户偏好互不干扰
   */
  _persistUserPreference() {
    if (this._preferenceApplying) return Promise.resolve();

    const runtimeEnvVersion = getRuntimeEnvVersion();
    const preference = this._buildUserPreference();

    return ensureOpenId(runtimeEnvVersion)
      .then(() => new Promise((resolve) => {
        wx.cloud.callFunction({
          name: 'login',
          data: {
            action: 'saveToolPreference',
            runtimeEnvVersion,
            toolKey: 'tool_f',
            preference
          },
          success: () => {
            resolve();
          },
          fail: (err) => {
            console.error('[tool_f] 保存用户偏好失败:', err);
            resolve();
          }
        });
      }))
      .catch((err) => {
        console.error('[tool_f] 获取 openid 后保存偏好失败:', err);
      });
  },

  /**
   * 根据已保存偏好恢复某个作用域的分组状态
   * 说明：恢复顺序固定为 type -> group -> sub -> skill，确保层层依赖正确
   * @param {string} scopeKey - 'specialProject' | 'auxiliaryProject'
   * @param {Object|null} scopePreference - 该作用域的偏好数据
   * @returns {Object} 包含 typeIndex 与重建后的 group
   */
  _restoreScopeGroup(scopeKey, scopePreference) {
    const scopeMap = this._getScopeMap(scopeKey);
    const typeKeys = this.data[scopeMap.typeKeys] || [];
    const currentTypeIndex = parseInt(this.data[scopeMap.typeIndex], 10) || 0;
    const fallbackTypeIndex = clampIndex(currentTypeIndex, typeKeys.length || 1);
    const preferredTypeIndex = scopePreference && scopePreference.typeKey
      ? typeKeys.indexOf(scopePreference.typeKey)
      : -1;
    const typeIndex = preferredTypeIndex >= 0 ? preferredTypeIndex : fallbackTypeIndex;
    const typeKey = typeKeys[typeIndex] || '';

    if (!typeKey) {
      return {
        typeIndex: 0,
        group: createEmptyProjectGroup(scopeKey)
      };
    }

    const provinceKey = this._getCurrentProvinceKey();
    let group = buildProjectGroup(provinceKey, scopeKey, typeKey);

    if (scopePreference && scopePreference.groupKey && group.groupKeys.length > 0) {
      const preferredGroupIndex = group.groupKeys.indexOf(scopePreference.groupKey);
      if (preferredGroupIndex >= 0) {
        group = buildProjectGroup(provinceKey, scopeKey, typeKey, {
          groupIndex: preferredGroupIndex,
          previousGroup: group
        });
      }
    }

    if (scopePreference && scopePreference.subCode && group.subList.length > 0) {
      const preferredSubIndex = group.subList.findIndex((item) => item.code === scopePreference.subCode);
      if (preferredSubIndex >= 0) {
        group = buildProjectGroup(provinceKey, scopeKey, typeKey, {
          groupIndex: group.groupIndex,
          subIndex: preferredSubIndex,
          previousGroup: group
        });
      }
    }

    if (scopePreference && Array.isArray(scopePreference.skillChooseSelectedCodes) && group.skillChooseGroups.length > 0) {
      group = buildProjectGroup(provinceKey, scopeKey, typeKey, {
        groupIndex: group.groupIndex,
        subIndex: group.subIndex,
        skillIndex: group.skillIndex,
        previousGroup: group,
        skillChooseSelectedCodes: scopePreference.skillChooseSelectedCodes
      });
    }

    if (scopePreference && scopePreference.skillCode && group.skillItems.length > 0) {
      const preferredSkillIndex = group.skillItems.findIndex((item) => item.code === scopePreference.skillCode);
      if (preferredSkillIndex >= 0) {
        group = buildProjectGroup(provinceKey, scopeKey, typeKey, {
          groupIndex: group.groupIndex,
          subIndex: group.subIndex,
          skillIndex: preferredSkillIndex,
          previousGroup: group
        });
      }
    }

    return {
      typeIndex,
      group
    };
  },

  /**
   * 把云端读取到的偏好回填到页面
   * 注意：回填时只恢复“选择状态”，不恢复用户输入的成绩，避免误提交旧数据
   * @param {Object} preference - 云端返回的 tool_f 偏好对象
   */
  _applyUserPreference(preference) {
    if (!preference || typeof preference !== 'object') return;

    const preferredProvinceKey = this.data.provinceKeys.indexOf(preference.provinceKey) >= 0
      ? preference.provinceKey
      : this._getCurrentProvinceKey();

    this._preferenceApplying = true;
    this.loadProvinceOptions(preferredProvinceKey, {
      skipPreferenceSave: true,
      afterSetData: () => {
        const mainPreference = preference.main || {};
        const preferredMainTypeIndex = mainPreference.typeKey
          ? this.data.mainTypeKeys.indexOf(mainPreference.typeKey)
          : -1;
        const mainTypeIndex = preferredMainTypeIndex >= 0
          ? preferredMainTypeIndex
          : clampIndex(this.data.mainTypeIndex, this.data.mainTypeKeys.length || 1);
        const mainTypeKey = this.data.mainTypeKeys[mainTypeIndex] || '';
        const nextMainProjectState = buildMainProjectState(
          this._getCurrentProvinceKey(),
          mainTypeKey,
          this.data.mainChooseGroups
        );

        const chooseSelectedCodes = Array.isArray(mainPreference.chooseSelectedCodes)
          ? mainPreference.chooseSelectedCodes
          : [];
        const mainChooseGroups = nextMainProjectState.mainChooseGroups.map((group, groupIndex) => {
          const preferredCode = chooseSelectedCodes[groupIndex];
          const hasMatchedOption = (group.options || []).some((option) => option.code === preferredCode);
          return hasMatchedOption
            ? Object.assign({}, group, { selectedCode: preferredCode })
            : group;
        });

        const specialRestore = this._restoreScopeGroup('specialProject', preference.special || null);
        const auxiliaryRestore = this.data.auxiliaryEnabled
          ? this._restoreScopeGroup('auxiliaryProject', preference.auxiliary || null)
          : {
            typeIndex: 0,
            group: this.data.auxiliaryGroup
          };

        this.setData({
          genderIndex: Number.isInteger(preference.genderIndex)
            ? clampIndex(preference.genderIndex, this.data.genderList.length || 1)
            : this.data.genderIndex,
          mainTypeIndex,
          mainSubList: nextMainProjectState.mainSubList,
          mainChooseGroups,
          specialTypeIndex: specialRestore.typeIndex,
          specialGroup: specialRestore.group,
          auxiliaryTypeIndex: auxiliaryRestore.typeIndex,
          auxiliaryGroup: auxiliaryRestore.group
        }, () => {
          this._preferenceApplying = false;
        });
      }
    });
  },

  /**
   * 读取当前 openid 对应的 tool_f 偏好并回填页面
   * 说明：如果用户还没有历史偏好，则保持当前默认首屏状态不动
   */
  _loadUserPreference() {
    const runtimeEnvVersion = getRuntimeEnvVersion();
    ensureOpenId(runtimeEnvVersion)
      .then(() => new Promise((resolve) => {
        wx.cloud.callFunction({
          name: 'login',
          data: {
            action: 'getToolPreference',
            runtimeEnvVersion,
            toolKey: 'tool_f'
          },
          success: (res) => {
            const preference = res && res.result ? res.result.preference : null;
            if (preference) {
              this._applyUserPreference(preference);
            }
            resolve();
          },
          fail: (err) => {
            console.error('[tool_f] 获取用户偏好失败:', err);
            resolve();
          }
        });
      }))
      .catch((err) => {
        console.error('[tool_f] 获取 openid 后读取偏好失败:', err);
      });
  },

  /**
   * 事件：点击“保存为默认偏好”
   * 作用：把当前页面已选的省份和项目结构显式保存到当前 openid 对应的用户记录中
   */
  saveCurrentPreferenceAsDefault() {
    if (this.data.savingPreference || this.data.clearingPreference) return;

    this.setData({ savingPreference: true });
    this._persistUserPreference()
      .then(() => {
        wx.showToast({
          title: '已保存默认偏好',
          icon: 'success'
        });
      })
      .finally(() => {
        this.setData({ savingPreference: false });
      });
  },

  /**
   * 事件：点击“清空个人偏好”
   * 作用：只删除云端保存的默认偏好，不改动用户当前页面里已经选中的项
   */
  clearUserPreference() {
    if (this.data.savingPreference || this.data.clearingPreference) return;

    wx.showModal({
      title: '清空个人偏好',
      content: '清空后，下次进入页面将不再自动恢复当前默认项目选择，是否继续？',
      confirmText: '确认清空',
      success: (modalRes) => {
        if (!modalRes.confirm) return;

        const runtimeEnvVersion = getRuntimeEnvVersion();
        this.setData({ clearingPreference: true });

        ensureOpenId(runtimeEnvVersion)
          .then(() => new Promise((resolve) => {
            wx.cloud.callFunction({
              name: 'login',
              data: {
                action: 'clearToolPreference',
                runtimeEnvVersion,
                toolKey: 'tool_f'
              },
              success: () => {
                wx.showToast({
                  title: '已清空个人偏好',
                  icon: 'success'
                });
                resolve();
              },
              fail: (err) => {
                console.error('[tool_f] 清空用户偏好失败:', err);
                wx.showToast({
                  title: '清空失败，请重试',
                  icon: 'none'
                });
                resolve();
              }
            });
          }))
          .catch((err) => {
            console.error('[tool_f] 获取 openid 后清空偏好失败:', err);
            wx.showToast({
              title: '清空失败，请重试',
              icon: 'none'
            });
          })
          .finally(() => {
            this.setData({ clearingPreference: false });
          });
      }
    });
  },

  /**
   * 设置指定分组下的技能项选中索引，并同步更新当前技能项快照和单位
   * 场景：专项/辅助项目的技能选择器（picker）切换时调用
   * @param {string} groupKey - 分组在 data 中的键名：'specialGroup' | 'auxiliaryGroup'
   * @param {number} skillIndex - 技能项新的选中下标
   */
  _setGroupSkillIndex(groupKey, skillIndex) {
    // 获取分组对象，不存在则创建空的专项分组兜底
    const group = this.data[groupKey] || createEmptyProjectGroup('specialProject');
    // 根据下标取出当前技能项对象，越界则为 null
    const currentSkillItem = (group.skillItems || [])[skillIndex] || null;

    // 批量更新：技能选中下标 / 当前技能项快照 / 展示单位
    this.setData({
      [groupKey + '.skillIndex']: skillIndex,
      [groupKey + '.currentSkillItem']: currentSkillItem,
      [groupKey + '.currentUnit']: currentSkillItem ? currentSkillItem.unit : ''
    });
  },

  /**
   * 根据技能层互斥组生成当前真正生效的技能数组
   * 说明：group.skillItems 保留全量技能对象，activeSkillItems 才是当前要渲染/提交的技能
   * @param {Object} group - 当前专项/辅助分组
   * @param {Array<Object>} [skillChooseGroups] - 指定的技能互斥组，未传则取 group 上现有值
   * @returns {Array<Object>}
   */
  _buildActiveSkillItems(group, skillChooseGroups) {
    const allSkillItems = (group && group.skillItems) || [];
    const chooseGroups = Array.isArray(skillChooseGroups)
      ? skillChooseGroups
      : ((group && group.skillChooseGroups) || []);

    if (!chooseGroups.length) return allSkillItems.slice();

    const exclusiveCodeSet = new Set();
    chooseGroups.forEach((item) => {
      (item.options || []).forEach((option) => {
        ((option && option.codes) || []).forEach((code) => {
          if (code) exclusiveCodeSet.add(code);
        });
      });
    });

    const activeCodeSet = new Set();
    allSkillItems.forEach((item) => {
      if (item && item.code && !exclusiveCodeSet.has(item.code)) {
        activeCodeSet.add(item.code);
      }
    });
    chooseGroups.forEach((item) => {
      const selectedOption = (item && item.selectedCode)
        ? (item.options || []).find((option) => option.code === item.selectedCode)
        : null;
      ((selectedOption && selectedOption.codes) || []).forEach((code) => {
        if (code) activeCodeSet.add(code);
      });
    });

    return allSkillItems.filter((item) => item && activeCodeSet.has(item.code));
  },

  /**
   * 根据技能层互斥组拆分固定技能项与当前选中技能项
   * 说明：用于页面把固定项与“专项分离选项”的结果分别渲染到不同 view 中
   * @param {Object} group - 当前专项/辅助分组
   * @param {Array<Object>} [skillChooseGroups] - 指定的技能互斥组，未传则取 group 上现有值
   * @returns {{fixedSkillItems: Array<Object>, selectedSkillItems: Array<Object>}}
   */
  _buildDisplayedSkillSections(group, skillChooseGroups) {
    const allSkillItems = (group && group.skillItems) || [];
    const chooseGroups = Array.isArray(skillChooseGroups)
      ? skillChooseGroups
      : ((group && group.skillChooseGroups) || []);

    if (!chooseGroups.length) {
      return {
        fixedSkillItems: allSkillItems.slice(),
        selectedSkillItems: []
      };
    }

    const exclusiveCodeSet = new Set();
    const selectedCodeSet = new Set();
    chooseGroups.forEach((item) => {
      (item.options || []).forEach((option) => {
        ((option && option.codes) || []).forEach((code) => {
          if (code) exclusiveCodeSet.add(code);
        });
      });
      const selectedOption = (item && item.selectedCode)
        ? (item.options || []).find((option) => option.code === item.selectedCode)
        : null;
      ((selectedOption && selectedOption.codes) || []).forEach((code) => {
        if (code) selectedCodeSet.add(code);
      });
    });

    return {
      fixedSkillItems: allSkillItems.filter((item) => item && item.code && !exclusiveCodeSet.has(item.code)),
      selectedSkillItems: allSkillItems.filter((item) => item && item.code && selectedCodeSet.has(item.code))
    };
  },

  /**
   * 根据事件 dataset 解析技能在全量 skillItems 中的真实下标
   * 设计原因：局部二选一渲染时传的是 activeSkillItems 的 code，不能再直接依赖可见列表下标
   * @param {Object} group - 当前分组
   * @param {Object} dataset - 事件携带的 dataset
   * @returns {number}
   */
  _resolveSkillIndex(group, dataset) {
    const skillCode = dataset && dataset.skillCode;
    if (skillCode) {
      const matchedIndex = (group.skillItems || []).findIndex((item) => item.code === skillCode);
      if (matchedIndex >= 0) return matchedIndex;
    }
    return parseInt(dataset && dataset.ski, 10) || 0;
  },

  /**
   * 设置技能层互斥组选项
   * 场景：乒乓球结合技术、足球专项动作这类“局部二选一”点击按钮切换时调用
   * @param {string} groupKey - 'specialGroup' | 'auxiliaryGroup'
   * @param {number} chooseGroupIndex - 互斥组下标
   * @param {string} selectedCode - 新选中的技能编码
   */
  _setGroupSkillChooseOption(groupKey, chooseGroupIndex, selectedCode) {
    const group = this.data[groupKey] || createEmptyProjectGroup('specialProject');
    const currentChooseGroups = group.skillChooseGroups || [];
    const targetGroup = currentChooseGroups[chooseGroupIndex];
    if (!targetGroup || !selectedCode) return;

    const hasMatchedOption = (targetGroup.options || []).some((option) => option.code === selectedCode);
    if (!hasMatchedOption) return;

    const nextChooseGroups = currentChooseGroups.map((item, index) => (index === chooseGroupIndex
      ? Object.assign({}, item, { selectedCode })
      : item));
    const activeSkillItems = this._buildActiveSkillItems(group, nextChooseGroups);
    const displayedSkillSections = this._buildDisplayedSkillSections(group, nextChooseGroups);

    this.setData({
      [groupKey + '.skillChooseGroups']: nextChooseGroups,
      [groupKey + '.activeSkillItems']: activeSkillItems,
      [groupKey + '.fixedSkillItems']: displayedSkillSections.fixedSkillItems,
      [groupKey + '.selectedSkillItems']: displayedSkillSections.selectedSkillItems
    });
  },

  /**
   * 按作用域切换项目大类（type）
   * 场景：专项/辅助的项目大类选择器或标签切换时
   * 优化点：切换时尽量继承旧分组里已选的时间选择值，减少用户重复选择
   * @param {string} scopeKey - 作用域键：'specialProject' | 'auxiliaryProject'
   * @param {number} index - 新项目大类的下标
   */
  _setScopeTypeByIndex(scopeKey, index) {
    const scopeMap = this._getScopeMap(scopeKey);
    const typeKeys = this.data[scopeMap.typeKeys] || [];
    // 下标合法性校验：非整数 / 越界则直接忽略
    if (!Number.isInteger(index) || index < 0 || index >= typeKeys.length) return;

    const provinceKey = this._getCurrentProvinceKey();
    const typeKey = typeKeys[index];
    const oldGroup = this.data[scopeMap.group];

    // 调用规则层重建分组，传入旧分组用于时间值继承
    const nextGroup = buildProjectGroup(provinceKey, scopeKey, typeKey, {
      previousGroup: oldGroup
    });

    this.setData({
      [scopeMap.typeIndex]: index,
      [scopeMap.group]: nextGroup
    });
  },

  /**
   * 按作用域切换分组（group）——同一大类下可能有多个分组（如男子组/女子组）
   * 场景：专项/辅助的分组选择器切换时
   * @param {string} scopeKey - 作用域键
   * @param {number} index - 新的分组下标
   */
  _setScopeGroupByIndex(scopeKey, index) {
    const scopeMap = this._getScopeMap(scopeKey);
    const currentGroup = this.data[scopeMap.group];
    if (!currentGroup || !currentGroup.typeKey) return;

    const provinceKey = this._getCurrentProvinceKey();
    // 传入 groupIndex 指定分组，同时保留旧分组的时间值
    const nextGroup = buildProjectGroup(provinceKey, scopeKey, currentGroup.typeKey, {
      groupIndex: index,
      previousGroup: currentGroup
    });

    this.setData({
      [scopeMap.group]: nextGroup
    });
  },

  /**
   * 按作用域切换子项（sub）——同一分组下的具体项目（如 100米跑 / 跳远）
   * 场景：专项/辅助的子项选择器或标签切换时
   * @param {string} scopeKey - 作用域键
   * @param {number} index - 新的子项下标
   */
  _setScopeSubByIndex(scopeKey, index) {
    const scopeMap = this._getScopeMap(scopeKey);
    const currentGroup = this.data[scopeMap.group];
    if (!currentGroup || !currentGroup.typeKey) return;

    const provinceKey = this._getCurrentProvinceKey();
    // 传入 subIndex 指定子项，同时保留旧分组的时间值
    const nextGroup = buildProjectGroup(provinceKey, scopeKey, currentGroup.typeKey, {
      groupIndex: currentGroup.groupIndex,
      subIndex: index,
      previousGroup: currentGroup
    });

    this.setData({
      [scopeMap.group]: nextGroup
    });
  },

  /**
   * 事件：省份选择器（picker）变化时触发
   * 流程：解析选中下标 → 取得省份编码键 → 调用 loadProvinceOptions 整页刷新
   * @param {Object} e - 微信小程序 picker 事件对象
   */
  onProvinceChange(e) {
    const idx = parseInt(e.detail.value, 10) || 0;
    const provinceKey = this.data.provinceKeys[idx];
    if (!provinceKey) return;
    this.loadProvinceOptions(provinceKey);
  },

  /**
   * 根据省份编码键重新加载整页选项（省份切换后的核心刷新逻辑）
   * 作用：
   *   1. 基于新省份规则重新构建主项 / 专项 / 辅助三大块的类型列表
   *   2. 重新计算主项默认选中项和状态
   *   3. 为专项和辅助构建默认的第一个分组
   *   4. 批量 setData，完成整页视图切换
   * @param {string} provinceKey - 省份编码键（如 'guangdong'）
   */
  loadProvinceOptions(provinceKey, options) {
    const opts = options || {};
    // 步骤1：从省份配置中取出三大作用域下已启用的项目（已按 order 字段排序）
    const mainProjects = getEnabledProjects(provinceKey, 'mainProject');
    const specialProjects = getEnabledProjects(provinceKey, 'specialProject');
    const auxiliaryProjects = getEnabledProjects(provinceKey, 'auxiliaryProject');

    // 步骤2：为三大作用域构建类型编码列表和显示名称列表
    const nextMainTypeKeys = mainProjects.map((item) => item.code);
    const nextMainTypeList = buildTypeList(provinceKey, 'mainProject', mainProjects);
    const nextSpecialTypeKeys = specialProjects.map((item) => item.code);
    const nextSpecialTypeList = buildTypeList(provinceKey, 'specialProject', specialProjects);
    const nextAuxiliaryTypeKeys = auxiliaryProjects.map((item) => item.code);
    const nextAuxiliaryTypeList = buildTypeList(provinceKey, 'auxiliaryProject', auxiliaryProjects);

    // 步骤3：确定主项默认选中项，优先取配置了 default:true 的项，否则取第一项
    const nextMainDefaultCode = getDefaultMainCode(provinceKey);
    const nextMainTypeIndex = clampIndex(nextMainTypeKeys.indexOf(nextMainDefaultCode), nextMainTypeKeys.length || 1);
    const nextMainKey = nextMainTypeKeys[nextMainTypeIndex] || '';
    // 构建主项完整状态：主项子列表（必选）+ 多选一组（选其一）
    const nextMainProjectState = buildMainProjectState(provinceKey, nextMainKey);

    // 步骤4：构建专项的初始分组（选中第一个大类的第一个分组的第一个子项）
    const nextSpecialGroup = nextSpecialTypeKeys.length
      ? buildProjectGroup(provinceKey, 'specialProject', nextSpecialTypeKeys[0])
      : createEmptyProjectGroup('specialProject');

    // 步骤5：构建辅助的初始分组（结构同专项，仅作用域不同）
    const nextAuxiliaryGroup = nextAuxiliaryTypeKeys.length
      ? buildProjectGroup(provinceKey, 'auxiliaryProject', nextAuxiliaryTypeKeys[0])
      : createEmptyProjectGroup('auxiliaryProject');

    // 步骤6：一次性 setData 所有新数据，避免多次渲染
    this.setData({
      provinceIndex: this.data.provinceKeys.indexOf(provinceKey),
      mainTypeKeys: nextMainTypeKeys,
      mainTypeList: nextMainTypeList,
      mainTypeIndex: nextMainTypeIndex,
      showMainTypePicker: nextMainTypeKeys.length > 1, // 仅当主项>1时显示选择器
      mainSubList: nextMainProjectState.mainSubList,
      mainChooseGroups: nextMainProjectState.mainChooseGroups,
      mainScores: {}, // 切换省份时清空历史成绩输入
      specialTypeKeys: nextSpecialTypeKeys,
      specialTypeList: nextSpecialTypeList,
      specialTypeIndex: 0,
      specialGroup: nextSpecialGroup,
      auxiliaryEnabled: nextAuxiliaryTypeKeys.length > 0, // 辅助项目为0时整块隐藏
      auxiliaryTypeKeys: nextAuxiliaryTypeKeys,
      auxiliaryTypeList: nextAuxiliaryTypeList,
      auxiliaryTypeIndex: 0,
      auxiliaryGroup: nextAuxiliaryGroup
    }, () => {
      if (typeof opts.afterSetData === 'function') {
        opts.afterSetData();
      }
    });
  },

  /**
   * 事件：性别选择器变化时触发
   * 直接更新 genderIndex，不涉及其他状态（性别在提交阶段才参与编码计算）
   */
  onGenderChange(e) {
    this.setData({ genderIndex: parseInt(e.detail.value, 10) || 0 });
  },

  /**
   * 事件：主项大类选择器变化时触发
   * 流程：获取新主项编码 → 重建主项状态（子列表+多选组）→ 清空历史成绩
   */
  onMainTypeChange(e) {
    const idx = parseInt(e.detail.value, 10) || 0;
    const typeKey = this.data.mainTypeKeys[idx];
    const provinceKey = this._getCurrentProvinceKey();
    // 传入旧的 mainChooseGroups 用于继承选中项（如果新旧主项都有同一组则保留选择）
    const nextMainProjectState = buildMainProjectState(provinceKey, typeKey, this.data.mainChooseGroups);

    this.setData({
      mainTypeIndex: idx,
      mainScores: {}, // 切换主项时清空成绩
      mainSubList: nextMainProjectState.mainSubList,
      mainChooseGroups: nextMainProjectState.mainChooseGroups
    });
  },

  /**
   * 事件：主项成绩输入框变化
   * 通过 dataset.code 区分输入框对应的子项编码，按编码存入 mainScores 对象
   * 数据结构示例：mainScores = { '0001': '12.5', '0002': '5.68' }
   */
  onMainScoreInput(e) {
    const code = e.currentTarget.dataset.code;
    this.setData({ ['mainScores.' + code]: e.detail.value });
  },

  /**
   * 事件：主项「多选一」分组中的选项被点击（如立定跳远/跳绳二选一）
   * 流程：从 dataset 解析组下标和选项编码 → 校验合法性 → 更新该组的 selectedCode
   * @param {Object} e - 点击事件对象，dataset 携带 groupIndex 和 code
   */
  onMainChooseOptionTap(e) {
    const groupIndex = parseInt(e.currentTarget.dataset.groupIndex, 10);
    const code = e.currentTarget.dataset.code;
    if (!Number.isInteger(groupIndex) || !code) return;
    const group = (this.data.mainChooseGroups || [])[groupIndex];
    if (!group) return;

    this.setData({
      ['mainChooseGroups[' + groupIndex + '].selectedCode']: code
    });
  },

  /**
   * 事件：专项大类选择器（picker）变化
   */
  onSpecialTypeChange(e) {
    this._setScopeTypeByIndex('specialProject', parseInt(e.detail.value, 10) || 0);
  },

  /**
   * 事件：专项大类标签点击（tap）切换
   * 与 picker 的区别：picker 走 e.detail.value，tap 走 e.currentTarget.dataset.index
   */
  onSpecialTypeTap(e) {
    this._setScopeTypeByIndex('specialProject', parseInt(e.currentTarget.dataset.index, 10));
  },

  /**
   * 事件：专项分组选择器变化
   */
  onSpecialGroupChange(e) {
    this._setScopeGroupByIndex('specialProject', parseInt(e.detail.value, 10) || 0);
  },

  /**
   * 事件：专项子项选择器变化
   */
  onSpecialSubChange(e) {
    this._setScopeSubByIndex('specialProject', parseInt(e.detail.value, 10) || 0);
  },

  /**
   * 事件：专项子项标签点击切换
   */
  onSpecialSubTap(e) {
    this._setScopeSubByIndex('specialProject', parseInt(e.currentTarget.dataset.index, 10));
  },

  /**
   * 事件：辅助大类选择器变化
   */
  onAuxiliaryTypeChange(e) {
    this._setScopeTypeByIndex('auxiliaryProject', parseInt(e.detail.value, 10) || 0);
  },

  /**
   * 事件：辅助大类标签点击切换
   */
  onAuxiliaryTypeTap(e) {
    this._setScopeTypeByIndex('auxiliaryProject', parseInt(e.currentTarget.dataset.index, 10));
  },

  /**
   * 事件：辅助分组选择器变化
   */
  onAuxiliaryGroupChange(e) {
    this._setScopeGroupByIndex('auxiliaryProject', parseInt(e.detail.value, 10) || 0);
  },

  /**
   * 事件：辅助子项选择器变化
   */
  onAuxiliarySubChange(e) {
    this._setScopeSubByIndex('auxiliaryProject', parseInt(e.detail.value, 10) || 0);
  },

  /**
   * 事件：辅助子项标签点击切换
   */
  onAuxiliarySubTap(e) {
    this._setScopeSubByIndex('auxiliaryProject', parseInt(e.currentTarget.dataset.index, 10));
  },

  /**
   * 事件：专项技能选择器变化
   * 直接调用通用的 _setGroupSkillIndex 方法
   */
  onSkillChange(e) {
    this._setGroupSkillIndex('specialGroup', parseInt(e.detail.value, 10) || 0);
  },

  /**
   * 事件：辅助技能选择器变化
   */
  onAuxiliarySkillChange(e) {
    this._setGroupSkillIndex('auxiliaryGroup', parseInt(e.detail.value, 10) || 0);
  },

  /**
   * 事件：技能层互斥组选项点击
   * 说明：这里不重建整个 group，而是直接在现有 skillItems 上切换激活技能，避免用户已填值被清空
   */
  onSkillChooseOptionTap(e) {
    const groupKey = e.currentTarget.dataset.groupKey || 'specialGroup';
    const chooseGroupIndex = parseInt(e.currentTarget.dataset.groupIndex, 10);
    const skillCode = e.currentTarget.dataset.code;
    if (!Number.isInteger(chooseGroupIndex) || !skillCode) return;
    this._setGroupSkillChooseOption(groupKey, chooseGroupIndex, skillCode);
  },

  /**
   * 事件：专项/辅助技能的多个输入框之一内容变化
   * 通过 dataset 携带的 groupKey / ski / inputIndex 精确定位更新位置
   * 同时同步更新 currentSkillItem 快照（如果当前操作的正是选中的技能项）
   * @param {Object} e - input 事件对象，dataset 字段说明：
   *   - groupKey: 'specialGroup' | 'auxiliaryGroup'
   *   - ski: skillIndex，技能项下标
   *   - inputIndex: 该技能项第几个输入框（如助跑摸高有 2 个输入：第一次/第二次）
   */
  onSkillScoreInput(e) {
    const groupKey = e.currentTarget.dataset.groupKey || 'specialGroup';
    const group = this.data[groupKey] || createEmptyProjectGroup('specialProject');
    const skillIndex = this._resolveSkillIndex(group, e.currentTarget.dataset || {});
    const inputIndex = parseInt(e.currentTarget.dataset.inputIndex, 10) || 0;

    // 先更新 skillItems 数组中的对应值
    const updates = {
      [groupKey + '.skillItems[' + skillIndex + '].values[' + inputIndex + ']']: e.detail.value
    };

    // 如果修改的是当前选中的技能项，同步更新 currentSkillItem 快照（用于视图渲染）
    if (parseInt(group.skillIndex, 10) === skillIndex) {
      updates[groupKey + '.currentSkillItem.values[' + inputIndex + ']'] = e.detail.value;
    }

    this.setData(updates);
  },

  /**
   * 事件：专项/辅助技能项的附加评审分输入变化
   * 场景：湖南篮球等项目存在 techSkill，需要跟随主技能额外提交一条手填编码
   * @param {Object} e - input 事件对象，dataset 包含 groupKey / ski
   */
  onTechSkillScoreInput(e) {
    const groupKey = e.currentTarget.dataset.groupKey || 'specialGroup';
    const group = this.data[groupKey] || createEmptyProjectGroup('specialProject');
    const skillIndex = this._resolveSkillIndex(group, e.currentTarget.dataset || {});

    const updates = {
      [groupKey + '.skillItems[' + skillIndex + '].techSkillValue']: e.detail.value
    };

    if (parseInt(group.skillIndex, 10) === skillIndex) {
      updates[groupKey + '.currentSkillItem.techSkillValue'] = e.detail.value;
    }

    this.setData(updates);
  },

  /**
   * 事件：专项/辅助技能项的时间选择器变化
   * 流程：
   *   1. 解析事件参数获取分组和技能项定位
   *   2. 对原始 picker 值做越界 clamp（适配规则变化后的索引范围）
   *   3. 生成两种格式：timeDisplay（页面展示）和 timeValue（mm:ss.SSS 提交值）
   *   4. 同步更新 skillItems 和 currentSkillItem 快照
   * 设计要点：显示值和提交值分开保存，避免页面展示格式与后端提交格式耦合
   */
  onTimePickerChange(e) {
    const groupKey = e.currentTarget.dataset.groupKey || 'specialGroup';
    const group = this.data[groupKey] || createEmptyProjectGroup('specialProject');
    const skillIndex = this._resolveSkillIndex(group, e.currentTarget.dataset || {});
    const skillItem = (group.skillItems || [])[skillIndex] || null;
    const timeRange = skillItem && skillItem.timePickerRange;

    const rawPickerValue = e.detail.value || [0, 0, 0];
    // clamp 到当前规则允许的时间范围内
    const pickerValue = clampTimePickerValue(rawPickerValue, timeRange);
    // 转换为提交格式（mm:ss.SSS）
    const timeValue = formatTimeValue(pickerValue, timeRange);
    // 转换为展示格式（xx分 xx秒 xx毫秒）
    const timeDisplay = formatTimeDisplay(pickerValue, timeRange);

    const updates = {
      [groupKey + '.skillItems[' + skillIndex + '].timePickerValue']: pickerValue,
      [groupKey + '.skillItems[' + skillIndex + '].timeDisplay']: timeDisplay,
      [groupKey + '.skillItems[' + skillIndex + '].values[0]']: timeValue // values[0] 统一存放时间提交值
    };

    if (parseInt(group.skillIndex, 10) === skillIndex) {
      updates[groupKey + '.currentSkillItem.timePickerValue'] = pickerValue;
      updates[groupKey + '.currentSkillItem.timeDisplay'] = timeDisplay;
      updates[groupKey + '.currentSkillItem.values[0]'] = timeValue;
    }

    this.setData(updates);
  },

  /**
   * 事件：专项/辅助子项直接模式的时间选择器变化（无子技能，项目本身就是一个时间输入）
   * 与 onTimePickerChange 的区别：操作的是 group 级别的 currentTimePickerValue 和 score 字段，
   * 而非某个 skillItem 的值
   */
  onDirectTimePickerChange(e) {
    const groupKey = e.currentTarget.dataset.groupKey || 'specialGroup';
    const group = this.data[groupKey] || createEmptyProjectGroup('specialProject');
    const timeRange = group.currentTimePickerRange;

    const rawPickerValue = e.detail.value || [0, 0, 0];
    const pickerValue = clampTimePickerValue(rawPickerValue, timeRange);

    this.setData({
      [groupKey + '.currentTimePickerValue']: pickerValue,
      [groupKey + '.currentTimeDisplay']: formatTimeDisplay(pickerValue, timeRange),
      // score 字段同时作为展示和提交的载体
      [groupKey + '.score']: formatTimeValue(pickerValue, timeRange)
    });
  },

  /**
   * 事件：专项/辅助子项直接模式的成绩输入框变化
   * （非时间类项目直接走 input 输入，不走 picker）
   */
  onSpecialScoreInput(e) {
    const groupKey = e.currentTarget.dataset.groupKey || 'specialGroup';
    this.setData({
      [groupKey + '.score']: e.detail.value
    });
  },

  /**
   * 事件：重置表单按钮点击
   * 流程：切回第一个省份、性别为男 → 重新加载该省份选项
   */
  resetForm() {
    const provinceKey = this.data.provinceKeys[0];
    this.setData({
      provinceIndex: 0,
      genderIndex: 0
    });
    this.loadProvinceOptions(provinceKey);
  }
};

/**
 * 构造 Page 实例
 * 合并策略：
 *   1. data 字段由规则层 createInitialPageData() 统一生成（页面不自建初始数据）
 *   2. 方法集合 = 交互层方法 + 提交层方法
 *   3. 通过 Object.assign 扁平合并，避免嵌套冲突
 */
Page(Object.assign({
  data: Object.assign(createInitialPageData(), {
    savingPreference: false,
    clearingPreference: false
  })
}, interactionMethods, submitMethods));
