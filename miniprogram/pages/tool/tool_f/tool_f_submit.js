/**
 * ============================================================
 * 文件名称：tool_f_submit.js
 * 文件定位：体育查分工具 - 提交层（输入校验 + 参数组装 + 云函数调用）
 * ============================================================
 *
 * 【整体职责】
 * 本文件是「提交按钮」点击后的完整流程处理，分四阶段：
 *
 *   阶段① 输入校验（validate 系列函数）
 *     ── 对主项成绩、专项成绩、辅助成绩逐个检查
 *        空值跳过不报错；非空值必须是合法数字或合法时间格式
 *        任何一项不合法 → wx.showToast 提示用户 → 终止提交
 *
 *   阶段② 提交数据组装（_buildXxxSubmitData 系列函数）
 *     ── 分别组装：
 *        主项数据 mainData[]：每个子项一条记录
 *        专项数据 specialDataList[]：按「直接型 / 技能型 / 顶层技能型」三种形态组装
 *        辅助数据 auxiliaryDataList[]：结构与专项完全相同
 *        每条记录都包含：code（项目编码）、name（显示名）、unit、value、
 *                        better（更好的方向：high/low）、match、rule
 *
 *   阶段③ 调用云函数 sport_tool_fun1（submitCloudForm 封装）
 *     ── 提交锁防止重复点击、去重窗口防重复提交、loading 动画
 *        callData 中一并带齐：省份规则元（计算/总分/特殊案例规则对象）、
 *        环境版本、全部成绩数据
 *
 *   阶段④ 结果处理（then / catch）
 *     ── 成功：取返回的总分、各分项分数，通过 eventChannel 传给
 *        结果页 tool_f_detailed 展示
 *        失败：根据错误码（重复提交 / 网络错误 / 业务错误）分别提示
 *
 * 【与其他两层的协作关系】
 *   交互层（tool_f.js）：提供 data 里的成绩输入值、选中状态、省份等
 *   规则层（tool_f_rules.js）：提供编码生成、规则读取、输入值标准化等工具
 *   本文件：消费 data + 调用工具 → 产出最终提交参数 → 调用云函数
 *
 * 【外部依赖关键文件】
 *   - ../../../utils/globalSubmit.js
 *       getRuntimeEnvVersion：获取小程序运行环境（开发版/体验版/正式版）
 *       submitCloudForm：统一的云函数提交封装（含防抖、重试、去重）
 *
 * 【提交调用链】
 *   submitForm()
 *     ├─ validate() ──┐
 *     │                ├─ _validateProjectGroup(specialGroup)
 *     │                │   └─ getCurrentSkillItem / _getSkillSubmitEntries
 *     │                │
 *     │                ├─ _validateProjectGroup(auxiliaryGroup)
 *     │                │
 *     │                └─ mainScores 遍历
 *     │
 *     ├─ 组装 mainData
 *     │   └─ getMainActiveItems / getTypeRule / buildMainItemCode
 *     │
 *     ├─ 组装 specialDataList / auxiliaryDataList
 *     │   └─ _buildProjectSubmitData(scopeKey, group, ...)
 *     │        ├─ TopSkill 分支（遍历 skillItems）
 *     │        ├─ Sub+Skill 分支（子项下 skillItems）
 *     │        └─ Direct 分支（直接一条）
 *     │        各分支都：buildSpecialItemCode + buildSpecialCodeLog 打印
 *     │
 *     ├─ 组装 callData
 *     │   ├─ 省份规则元（computationRule / totalScoreRule / specialCaseRules 深拷贝）
 *     │   ├─ 环境版本 runtimeEnvVersion
 *     │   └─ mainData / specialDataList（已合并辅助）
 *     │
 *     ├─ submitCloudForm({ name:'sport_tool_fun1', ... })
 *     │
 *     └─ 结果跳转 tool_f_detailed 页
 *
 * 【校验失败错误类型一览】
 *   - 主项/专项/辅助直接型非空值非数字
 *   - 时间格式（分:秒.毫秒）解析为 NaN
 *   - 全表没有填写任何成绩（至少填一项才允许提交）
 *
 * 【防重复提交机制】
 *   ① submitting 标志位锁：submitForm 入口和 loading 关闭前拒绝再次进入
 *   ② submitCloudForm DUPLICATE_SUBMIT：同一 lockKey 在 duplicateWindowMs 内只允许一次
 *
 * ============================================================
 */

// 从全局提交工具导入：运行环境版本获取、统一云函数提交封装
const { getRuntimeEnvVersion, submitCloudForm } = require('../../../utils/globalSubmit.js');

// 从规则层导入本文件需要的工具函数
const {
  buildMainCodeLog,         // 主项编码日志结构（调试打印用）
  buildMainItemCode,       // 主项编码生成
  buildSpecialCodeLog,     // 专项/辅助编码日志结构（调试打印用）
  buildSpecialItemCode,    // 专项/辅助编码生成
  cloneRuleMeta,            // 规则元对象深拷贝（防污染原规则）
  getCurrentSkillItem,      // 从分组中取当前选中的技能项快照
  getItemRule,              // 取子项规则细节
  getMainActiveItems,       // 汇总主项激活的子项数组
  getProvinceRuleMeta,      // 取省份 addRuleMeta（计算/总分/特殊案例规则编码+对象）
  getTypeRule,              // 取某省某作用域某大类的规则
  hasTopLevelSkills,        // 判断大类是否为顶层技能型结构
  normalizeComparableValue  // 各种输入值 → 可比较数字（含时间转秒）
} = require('./tool_f_rules.js');

/**
 * 提交层方法集合（最终通过 Object.assign 合并进 Page 实例）
 */
module.exports = {

  /**
   * 安全去除字符串首尾空白
   * undefined / null 统一转成空串，避免后续 trim 报错
   * 仅输出空串，不抛异常
   * @param {*} val - 任意原始值
   * @returns {string} 去空白后的字符串，空值返回 ''
   */
  _safeTrim(val) {
    return (val !== undefined && val !== null) ? String(val).trim() : '';
  },

  /**
   * 获取一个技能项所有非空输入条目
   * 处理 parallel 多输入框情况（如跳远两次试跳）：
   *   values = ['5.68', '5.72', '']
   *   inputLabels = ['跳远1', '跳远2', '跳远3']
   *   返回 = [{label:'跳远1', value:'5.68'}, {label:'跳远2', value:'5.72'}]
   * 空值过滤掉，最终提交阶段每条都会生成一条成绩记录
   * @param {Object} skillItem - 标准化技能项对象
   * @returns {Array<{label: string, value: string}>} 非空输入条目
   */
  _getSkillSubmitEntries(skillItem) {
    const values = (skillItem && skillItem.values) || [];
    const inputLabels = (skillItem && skillItem.inputLabels) || [];

    return values
      .map((rawValue, index) => ({
        label: inputLabels[index] || skillItem.name,
        value: this._safeTrim(rawValue)
      }))
      .filter((item) => !!item.value);
  },

  /**
   * 校验一个专项/辅助分组（整组）的输入合法性
   * 分组分两种形态分别处理：
   *
   *   形态A showSkill=true（技能型）：
   *     - useSkillPicker=true → 只校验当前选中的那一个技能（getCurrentSkillItem）
   *     - useSkillPicker=false（choose>1）→ 逐个校验所有 skillItems
   *     每个技能里多个 values 输入框：空跳过，非空必须合法
   *
   *   形态B showSkill=false（直接输入型）：
   *     只校验 group.score 这一个字段
   *     时间型走 normalizeComparableValue 验证，数值型走 !isNaN(Number(val))
   *
   * 返回值 { valid, hasValue }：
   *   valid     - 整组是否合法（false 则校验整体失败直接终止提交）
   *   hasValue  - 整组有没有至少一个非空输入（顶层 validate 判断是否全空）
   *
   * @param {Object} group - 分组对象（specialGroup 或 auxiliaryGroup）
   * @returns {{valid: boolean, hasValue: boolean}}
   */
  _validateProjectGroup(group) {
    // 分组还没 typeKey（空分组兜底）视为合法但无值
    if (!group || !group.typeKey) {
      return { valid: true, hasValue: false };
    }

    /* ---------- 形态A：技能型（showSkill=true） ---------- */
    if (group.showSkill) {
      // 当前选中技能项（useSkillPicker 时只会有这一个）
      const currentSkillItem = getCurrentSkillItem(group);
      const skillItems = group.useSkillPicker
        ? (currentSkillItem ? [currentSkillItem] : [])
        : (group.skillItems || []);

      // 逐个技能校验
      for (let skillIdx = 0; skillIdx < skillItems.length; skillIdx++) {
        const skillItem = skillItems[skillIdx];
        const inputLabels = skillItem.inputLabels || [skillItem.name];
        const values = skillItem.values || [];

        // 每个输入框校验
        for (let inputIndex = 0; inputIndex < values.length; inputIndex++) {
          const val = this._safeTrim(values[inputIndex]);
          if (!val) continue; // 空值跳过不报错

          // 时间型 → 用 normalizeComparableValue 解析（时间格式会换算成秒）
          // 数值型 → 用原生 Number() 转换
          const isValid = skillItem.isTimePicker
            ? Number.isFinite(normalizeComparableValue(val))
            : !isNaN(Number(val));

          if (!isValid) {
            const label = inputLabels[inputIndex] || skillItem.name;
            wx.showToast({
              title: skillItem.isTimePicker ? (label + '时间格式无效') : (label + '成绩必须为数字'),
              icon: 'none'
            });
            return { valid: false, hasValue: false };
          }
        }
      }

      return {
        valid: true,
        // 是否至少有一个技能至少有一个非空输入
        hasValue: skillItems.some((skillItem) => this._getSkillSubmitEntries(skillItem).length > 0)
      };
    }

    /* ---------- 形态B：直接输入型（score 单字段） ---------- */
    const val = this._safeTrim(group.score);
    if (val) {
      const isValid = group.currentIsTimePicker
        ? Number.isFinite(normalizeComparableValue(val))
        : !isNaN(Number(val));

      if (!isValid) {
        wx.showToast({
          title: group.currentIsTimePicker ? (group.currentSubName + '时间格式无效') : (group.currentSubName + '成绩必须为数字'),
          icon: 'none'
        });
        return { valid: false, hasValue: false };
      }
    }

    return { valid: true, hasValue: !!val };
  },

  /**
   * 整个表单的顶层校验入口（submitForm 第一步调用）
   * 校验顺序：
   *   1. 所有激活的主项成绩（mainScores）
   *   2. 专项分组
   *   3. 辅助分组（若 auxiliaryEnabled=true）
   *   4. 最后判断：主项有没有填 OR 专项有没有填 OR 辅助有没有填
   *      三者都空不允许提交（必须至少填一项）
   * @returns {boolean} true=校验通过，允许提交
   */
  validate() {
    const { mainScores, mainSubList, mainChooseGroups, specialGroup, auxiliaryEnabled, auxiliaryGroup } = this.data;
    // 激活主项 = 普通主项 + 各多选组选中项
    const activeMainItems = getMainActiveItems(mainSubList, mainChooseGroups);

    // 主项逐个校验：空值跳过，非空必须是合法数字
    for (const sub of activeMainItems) {
      const val = this._safeTrim(mainScores[sub.code]);
      if (val && isNaN(Number(val))) {
        wx.showToast({ title: sub.name + '成绩必须为数字', icon: 'none' });
        return false;
      }
    }

    // 专项分组校验
    const specialResult = this._validateProjectGroup(specialGroup);
    if (!specialResult.valid) return false;

    // 辅助分组校验（仅当该省启用了辅助项目时校验）
    const auxiliaryResult = auxiliaryEnabled
      ? this._validateProjectGroup(auxiliaryGroup)
      : { valid: true, hasValue: false };
    if (!auxiliaryResult.valid) return false;

    // 判断是否至少填了一项（主/专项/辅助任一有值即可）
    const hasMain = activeMainItems.some((sub) => this._safeTrim(mainScores[sub.code]));
    if (!hasMain && !specialResult.hasValue && !auxiliaryResult.hasValue) {
      wx.showToast({ title: '请至少填写一项成绩', icon: 'none' });
      return false;
    }

    return true;
  },

  /**
   * 组装一个作用域（专项 specialProject / 辅助 auxiliaryProject）下的提交数据数组
   * 根据分组结构分三大分支：
   *   分支① TopSkill 型：大类直接挂 skills，没有 sub
   *   分支② Sub+Skill 型：子项 hasSkill=true，下挂多个技能
   *   分支③ Direct 型：子项 hasSkill=false，直接一条成绩
   *
   * 无论哪条分支，每条最终记录都包含以下字段：
   *   code       项目完整编码（province+gender+type[+group]+sub+skill）
   *   typeKey    大类编码
   *   typeLabel  大类中文名
   *   scopeKey   作用域（specialProject / auxiliaryProject）
   *   name       显示名称（技能多输入时含序号标签，如"100米跑-第一次"）
   *   unit       单位
   *   value      实际提交的值（数字或时间格式字符串）
   *   better     更好方向（high=越高分越好 / low=越低分越好）
   *   match      匹配规则标识（后端用）
   *   rule       该项目规则对象（后端直接拿计算用，省一次查库）
   *
   * 每条记录生成时同时 console.log 编码日志（[code-project-top-skill/skill/direct]）
   * 方便控制台调试编码是否正确
   *
   * @param {string} scopeKey - 作用域键 'specialProject' | 'auxiliaryProject'
   * @param {Object} group - 分组对象（specialGroup / auxiliaryGroup）
   * @param {string} provinceCode - 省份编码（'002'等）
   * @param {string} genderCode - 性别编码 'm' | 'f'
   * @returns {Array<Object>} 提交记录数组（可能 0 条 到 多条）
   */
  _buildProjectSubmitData(scopeKey, group, provinceCode, genderCode) {
    if (!group || !group.typeKey) return [];

    const provinceKey = this._getCurrentProvinceKey();
    const typeRule = getTypeRule(provinceKey, scopeKey, group.typeKey);
    if (!typeRule) return [];

    const result = [];
    const isTopSkill = hasTopLevelSkills(typeRule);

    /* -------------------- 分支①：顶层技能型（TopSkill） -------------------- */
    if (isTopSkill) {
      const currentSkillItem = getCurrentSkillItem(group);
      // useSkillPicker 仅取当前选中技能；否则取所有 skillItems
      const skillItems = group.useSkillPicker
        ? (currentSkillItem ? [currentSkillItem] : [])
        : (group.skillItems || []);

      skillItems.forEach((skillItem) => {
        // 从 typeRule.skills 里拿到原始 skillRule（含 better/match/rule/unit 等字段）
        const skillRule = (typeRule.skills || {})[skillItem.code];
        if (!skillRule) return;

        // 本技能所有非空输入 → 每条对应一条提交记录
        const entries = this._getSkillSubmitEntries(skillItem);
        const itemCode = buildSpecialItemCode(
          provinceCode,
          genderCode,
          group.typeKey,
          '',              // TopSkill 无子项概念
          {},              // 无子项规则
          skillItem.code,
          skillRule,
          group.groupKey
        );

        // 打印编码日志（便于调试编码错误）
        console.log('[code-project-top-skill]', JSON.stringify(buildSpecialCodeLog(
          provinceCode,
          genderCode,
          group.typeKey,
          '',
          {},
          skillItem.code,
          skillRule,
          itemCode,
          scopeKey,
          group.groupKey
        )));

        // 每个非空输入都生成一条记录
        entries.forEach((entry) => {
          result.push({
            code: itemCode,
            typeKey: group.typeKey,
            typeLabel: group.typeLabel,
            scopeKey,
            name: entry.label,
            unit: skillRule.unit || '',
            value: entry.value,
            better: skillRule.better || '',
            match: skillRule.match || '',
            rule: skillRule.rule !== undefined ? skillRule.rule : ''
          });
        });
      });

      return result;
    }

    /* -------------------- 非 TopSkill 分支：先定位到当前选中子项 -------------------- */
    const sub = (group.subList || [])[group.subIndex];
    if (!sub) return result;

    // 取子项的原始规则（better/match/rule 等字段可能直接在 itemConfig 上）
    const itemConfig = getItemRule(typeRule, group.groupKey, sub.code);

    /* -------------------- 分支②：子项下挂技能（showSkill && skillKeys） -------------------- */
    if (group.showSkill && group.skillKeys.length > 0) {
      const currentSkillItem = getCurrentSkillItem(group);
      const skillItems = group.useSkillPicker
        ? (currentSkillItem ? [currentSkillItem] : [])
        : (group.skillItems || []);

      skillItems.forEach((skillItem) => {
        const skillRule = (itemConfig.skills || {})[skillItem.code];
        if (!skillRule) return;

        const entries = this._getSkillSubmitEntries(skillItem);
        const itemCode = buildSpecialItemCode(
          provinceCode,
          genderCode,
          group.typeKey,
          sub.code,
          itemConfig,
          skillItem.code,
          skillRule,
          group.groupKey
        );

        console.log('[code-project-skill]', JSON.stringify(buildSpecialCodeLog(
          provinceCode,
          genderCode,
          group.typeKey,
          sub.code,
          itemConfig,
          skillItem.code,
          skillRule,
          itemCode,
          scopeKey,
          group.groupKey
        )));

        entries.forEach((entry) => {
          result.push({
            code: itemCode,
            typeKey: group.typeKey,
            typeLabel: group.typeLabel,
            scopeKey,
            name: sub.name + '-' + entry.label,   // "跳远-第一次" 显示格式
            unit: skillRule.unit || '',
            value: entry.value,
            better: skillRule.better || '',
            match: skillRule.match || '',
            rule: skillRule.rule !== undefined ? skillRule.rule : ''
          });
        });
      });

      return result;
    }

    /* -------------------- 分支③：直接输入型（无子技能，只有 score 单值） -------------------- */
    const scoreVal = this._safeTrim(group.score);
    if (!scoreVal) return result;

    const code = buildSpecialItemCode(
      provinceCode,
      genderCode,
      group.typeKey,
      sub.code,
      itemConfig,
      '',          // 直接型无技能编码
      null,
      group.groupKey
    );

    console.log('[code-project-direct]', JSON.stringify(buildSpecialCodeLog(
      provinceCode,
      genderCode,
      group.typeKey,
      sub.code,
      itemConfig,
      '',
      null,
      code,
      scopeKey,
      group.groupKey
    )));

    result.push({
      code,
      typeKey: group.typeKey,
      typeLabel: group.typeLabel,
      scopeKey,
      name: sub.name,
      unit: sub.unit || '',
      value: scoreVal,
      better: itemConfig.better || '',
      match: itemConfig.match || '',
      rule: itemConfig.rule !== undefined ? itemConfig.rule : ''
    });

    return result;
  },

  /**
   * ============================================================
   * 「查询分数」按钮点击后的完整主流程
   * ============================================================
   *
   * 执行顺序：
   *  [1] 前置守卫：validate() 不通过 → 直接 return
   *            data.submitting 为 true → 直接 return（防重复点击）
   *
   *  [2] 提交锁 + loading：submitting=true，wx.showLoading
   *
   *  [3] 从 data 解包所有需要的字段（解构赋值）
   *
   *  [4] 派生基础字段：
   *        provinceCode = provinceKeys[provinceIndex]（'002'等）
   *        genderCode   = 0→'m' 1→'f'
   *        mainTypeKey  = 主项选中的大类编码
   *        provinceRuleMeta = 省份 addRuleMeta（计算规则编码/对象等）
   *        activeMainItems  = 激活主项数组
   *
   *  [5] 组装 mainData[]：遍历激活主项，非空值生成记录
   *
   *  [6] 组装 specialDataList（专项）和 auxiliaryDataList（辅助）
   *      两者结构完全一致，区别仅在作用域键和传入的分组对象
   *      之后把辅助并入 specialDataList 一起给后端（mergedSpecialDataList）
   *
   *  [7] 组装 callData = 云函数 sport_tool_fun1 的入参
   *      ├─ 省份相关：province / provinceCode
   *      ├─ 规则元相关：computationRuleCode / totalScoreCode / specialCaseCodes
   *      │            以及对应完整规则对象（深拷贝后传给云函数，后端直接用不必查库）
   *      ├─ 性别：gender / genderCode
   *      ├─ 主项：mainType / mainTypeKey / mainData[]
   *      ├─ 专项：specialType / specialTypeKey / specialDataList[]
   *      ├─ 辅助：auxiliaryDataList[]
   *      └─ 环境版本 runtimeEnvVersion（云函数判断发版环境）
   *
   *  [8] 打印 [code-summary] 总览日志：所有 main/special 编码+名称+值的汇总（调试大全）
   *
   *  [9] 调用 submitCloudForm，传入：
   *        name: 'sport_tool_fun1'          云函数名
   *        data: callData                   云函数入参
   *        lockKey: 'tool_f_submit'         去重锁键
   *        duplicateWindowMs: 5000          5秒内相同 lockKey 视为重复提交
   *        businessName: '体育查分表单提交' （错误提示用）
   *        returnPageRoute: tool_f_detailed （错误后回退页面）
   *
   * [10] 成功分支：
   *        res.result.success = true
   *        通过 eventChannel.emit('scoreResult', scoreData) 把总分和各分项
   *        分数传递给结果页 tool_f_detailed 展示
   *
   * [11] 失败分支：
   *        业务失败（success=false） → 展示 result.message
   *        重复提交（DUPLICATE_SUBMIT 码） → 展示 请勿重复提交
   *        其他错误 → 展示 网络错误，请重试
   */
  submitForm() {
    // [1] 前置守卫
    if (!this.validate()) return;
    if (this.data.submitting) return;

    // [2] 提交锁 + loading 动画
    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中...' });

    // [3] 解构 data 字段
    const {
      provinceList,
      provinceIndex,
      provinceKeys,
      genderList,
      genderIndex,
      mainTypeList,
      mainTypeIndex,
      mainTypeKeys,
      mainSubList,
      mainChooseGroups,
      mainScores,
      specialGroup,
      specialTypeKeys,
      specialTypeList,
      specialTypeIndex,
      auxiliaryEnabled,
      auxiliaryGroup
    } = this.data;

    // [4] 派生基础字段
    const provinceCode = provinceKeys[provinceIndex];
    const genderCode = genderIndex === 0 ? 'm' : 'f';
    const mainTypeKey = mainTypeKeys[mainTypeIndex];
    const provinceKey = this._getCurrentProvinceKey();
    const provinceRuleMeta = getProvinceRuleMeta(provinceKey);
    const activeMainItems = getMainActiveItems(mainSubList, mainChooseGroups);

    // [5] 组装主项数据 mainData
    const mainData = activeMainItems
      .filter((sub) => this._safeTrim(mainScores[sub.code]))
      .map((sub) => {
        // 重新获取该子项原始规则（better / match 字段可能在里面）
        const itemRule = (getTypeRule(provinceKey, 'mainProject', mainTypeKey).items || {})[sub.code] || {};
        const value = this._safeTrim(mainScores[sub.code]);
        const code = buildMainItemCode(provinceCode, genderCode, mainTypeKey, sub.code);

        // 主项编码调试日志
        console.log('[code-main]', JSON.stringify(buildMainCodeLog(
          provinceCode,
          genderCode,
          mainTypeKey,
          sub.code,
          code
        )));

        return {
          code,
          name: sub.name,
          unit: sub.unit,
          value,
          better: itemRule.better || '',
          match: itemRule.match || ''
        };
      });

    // [6] 组装专项 + 辅助数据
    const specialDataList = this._buildProjectSubmitData('specialProject', specialGroup, provinceCode, genderCode);
    const auxiliaryDataList = auxiliaryEnabled
      ? this._buildProjectSubmitData('auxiliaryProject', auxiliaryGroup, provinceCode, genderCode)
      : [];
    // 合并：后端统一用 specialDataList 接收（含辅助），auxiliaryDataList 也单独保留一份以便调试
    const mergedSpecialDataList = specialDataList.concat(auxiliaryDataList);
    const runtimeEnvVersion = getRuntimeEnvVersion();

    // [7] 组装 callData（云函数完整入参）
    const callData = {
      province: provinceList[provinceIndex],
      provinceCode,
      // 规则编码（后端日志记录用）
      computationRuleCode: provinceRuleMeta.computationRuleCode,
      totalScoreCode: provinceRuleMeta.totalScoreCode,
      specialCaseCodes: provinceRuleMeta.specialCaseCodes || [],
      // 规则对象（深拷贝，防止后续污染原规则）
      computationRule: cloneRuleMeta(provinceRuleMeta.computationRule),
      totalScoreRule: cloneRuleMeta(provinceRuleMeta.totalScoreRule),
      specialCaseRules: cloneRuleMeta(provinceRuleMeta.specialCaseRules || []),
      // 性别
      gender: genderList[genderIndex],
      genderCode,
      // 主项
      mainType: mainTypeList[mainTypeIndex],
      mainTypeKey,
      mainData,
      // 专项
      specialType: specialTypeList[specialTypeIndex] || '',
      specialTypeKey: specialTypeKeys[specialTypeIndex] || '',
      specialDataList: mergedSpecialDataList,
      // 辅助
      auxiliaryDataList,
      // 环境
      runtimeEnvVersion
    };

    // [8] 汇总编码日志（调试大全）
    console.log('[code-summary]', JSON.stringify({
      runtimeEnvVersion,
      ruleCodes: {
        computationRuleCode: provinceRuleMeta.computationRuleCode,
        totalScoreCode: provinceRuleMeta.totalScoreCode,
        specialCaseCodes: provinceRuleMeta.specialCaseCodes || []
      },
      computationRule: provinceRuleMeta.computationRule || null,
      totalScoreRule: provinceRuleMeta.totalScoreRule || null,
      mainCodes: mainData.map((item) => ({ name: item.name, code: item.code, value: item.value })),
      specialCodes: mergedSpecialDataList.map((item) => ({
        name: item.name,
        code: item.code,
        value: item.value,
        scopeKey: item.scopeKey
      }))
    }, null, 2));

    // 结果页只需要的展示数据（province/gender/mainType/specialType + 总分数组）
    const displayInfo = {
      province: provinceList[provinceIndex],
      gender: genderList[genderIndex],
      mainType: mainTypeList[mainTypeIndex],
      specialType: specialGroup.typeLabel
    };

    // [9] 调用统一云函数提交封装
    submitCloudForm({
      name: 'sport_tool_fun1',
      data: callData,
      runtimeEnvVersion,
      lockKey: 'tool_f_submit',
      duplicateWindowMs: 5000,
      businessName: '体育查分表单提交',
      submitPageRoute: '/pages/tool/tool_f/tool_f',
      returnPageRoute: '/pages/tool/tool_f/tool_f_detailed/tool_f_detailed'
    })
      .then((res) => {
        // [10] 成功分支
        wx.hideLoading();
        this.setData({ submitting: false });

        if (res.result && res.result.success) {
          // 组装传进结果页的分数数据（仅展示数据，不含规则，避免二次计算）
          const scoreData = Object.assign({}, displayInfo, {
            totalScore: res.result.score.totalScore,
            mainScores: res.result.score.mainScores,
            specialScores: res.result.score.specialScores || [],
            aiFallback: res.result.score.aiFallback || null
          });

          // 跳转到结果页并通过 eventChannel 把分数传过去
          wx.navigateTo({
            url: '/pages/tool/tool_f/tool_f_detailed/tool_f_detailed',
            success: (navRes) => {
              navRes.eventChannel.emit('scoreResult', scoreData);
            }
          });
        } else {
          // 业务失败（查分逻辑返回 success=false）
          wx.showToast({ title: (res.result && res.result.message) || '提交失败', icon: 'none' });
        }
      })
      .catch((err) => {
        // [11] 异常分支
        wx.hideLoading();
        this.setData({ submitting: false });
        if (err && err.code === 'DUPLICATE_SUBMIT') {
          // 重复提交（5秒锁窗内多次点击）
          wx.showToast({ title: err.message || '请勿重复提交', icon: 'none' });
          return;
        }
        // 其他异常：网络 / 云函数挂了 / 参数错误
        wx.showToast({ title: '网络错误，请重试', icon: 'none' });
        console.error('云函数调用失败:', err);
      });
  }
};
