/**
 * ============================================================
 * 文件名称：tool_f_rules.js
 * 文件定位：体育查分工具 - 规则层（核心数据构建与规则解析）
 * ============================================================
 *
 * 【整体架构说明】
 * 本文件是整个查分工具的「数据中枢 + 规则翻译器」，负责完成以下三大类工作：
 *
 * ┌───────────────────────────────────────────────────────────┐
 * │ 第一部分：常量与默认值区（第 42 - 56 行）                     │
 * │   - 定义省份规则、空规则兜底、作用域字段映射                   │
 * │   - 定义时间选择器的默认范围（分/秒/毫秒各多少档）             │
 * │   - 生成默认的分钟选项 TIME_MINUTE_OPTIONS                     │
 * │   - 生成默认的秒钟选项 TIME_SECOND_OPTIONS                   │
 * │   - 生成默认的毫秒选项 TIME_MILLISECOND_OPTIONS               │
 * └───────────────────────────────────────────────────────────┘
 *
 * ┌───────────────────────────────────────────────────────────┐
 * │ 第二部分：时间工具函数族（第 58 - 157 行）                   │
 * │   buildTimePickerRange     根据规则生成自定义时间范围            │
 * │   clampIndex              数组下标越界夹取保护                    │
 * │   clampTimePickerValue   时间选择器三元组越界保护            │
 * │   getTimeDefaultValue    解析规则中的默认时间配置             │
 * │   hasExplicitTimeDefault 判断规则是否显式配置了默认时间         │
 * │   formatTimeDefaultArray 格式化默认时间为日志字符串            │
 * │   formatTimeValue        时间索引 → "mm:ss.SSS" 提交格式       │
 * │   formatTimeDisplay    时间索引 → "xx分 xx秒 xx毫秒" 展示格式 │
 * │   buildTimeDefaultHint  生成默认时间提示语（给考生看）           │
 * └───────────────────────────────────────────────────────────┘
 *
 * ┌───────────────────────────────────────────────────────────┐
 * │ 第三部分：省份与项目规则读取函数（第 159 - 204 行）             │
 * │   getProvinceRules        获取指定省份的完整规则对象           │
 * │   getProvinceRuleMeta    获取省份的额外规则元信息           │
 * │   cloneRuleMeta          深拷贝规则元（防止污染原数据）         │
 * │   buildProvinceList     构建省份编码列表 + 显示名称列表         │
 * │   getEnabledProjects  获取某省某作用域下的已启用项目          │
 * │   getDefaultMainCode  获取某省默认主项编码                 │
 * │   getTypeRule         获取某省某作用域某大类的规则细节         │
 * │   buildTypeList       构建项目类型显示名称列表                 │
 * └───────────────────────────────────────────────────────────┘
 *
 * ┌───────────────────────────────────────────────────────────┐
 * │ 第四部分：主项（Main Project）状态构建（第 206 - 257 行）      │
 * │   buildMainProjectState  构建主项完整状态：                  │
 * │                         - mainSubList（必选普通主项列表）             │
 * │                         - mainChooseGroups（多选一组列表）  │
 * │   getMainActiveItems  汇总当前主项下所有激活的子项            │
 * │                      （普通子项 + 各多选组中已选项）           │
 * └───────────────────────────────────────────────────────────┘
 *
 * ┌───────────────────────────────────────────────────────────┐
 * │ 第五部分：专项/辅助项目（Special/Auxiliary）元数据读取    │
 * │   getTypeGroupMeta     获取大类下的分组元信息                  │
 * │   hasTopLevelSkills   判断是否是「顶层技能型」结构              │
 * │   getTypeItems       获取指定分组下的所有子项                │
 * │   getItemRule        获取具体子项的规则配置                  │
 * │   buildProjectSubList 构建子项显示列表                     │
 * │   getSkillInputCount  技能项需要几个输入框（如助跑摸高=2次）   │
 * │   getChooseCount     技能需要选几项（choose字段）            │
 * │   useMinuteSecondTime 是否启用「分秒毫秒」时间规则           │
 * │   normalizeComparableValue 各种格式值统一为可比较数字         │
 * │   getSkillInputLabels 生成多输入框的标签名                   │
 * └───────────────────────────────────────────────────────────┘
 *
 * ┌───────────────────────────────────────────────────────────┐
 * │ 第六部分：技能项（Skill Items）标准化构建                     │
 * │   buildSkillItems       将原始 skills 规则统一转换成页面可用结构    │
 * │                      包含编码、名称、单位、输入数、是否时间选择器    │
 * │                      默认时间值、展示值、时间提示语等字段       │
 * └───────────────────────────────────────────────────────────┘
 *
 * ┌───────────────────────────────────────────────────────────┐
 * │ 第七部分：当前项 / 时间上下文判断（用于切换继承用）               │
 * │   getCurrentSkillItem      根据 skillIndex 获取当前技能项快照    │
 * │   getCurrentSubCode        根据 subIndex 获取当前子项编码   │
 * │   isSameDirectTimeContext 两次切换是否是同一直接时间上下文   │
 * │   isSameSkillTimeContext  两次切换是否是同一技能时间上下文   │
 * └───────────────────────────────────────────────────────────┘
 *
 * ┌───────────────────────────────────────────────────────────┐
 * │ 第八部分：项目编码生成（提交给后端查分的核心编码算法）        │
 * │   编码规则总公式（拼接式编码，所有片段直接字符串拼接）：         │
 * │                                                         │
 * │   【主项编码】：                                          │
 * │     provinceCode + genderCode + mainTypeKey + subCode      │
 * │     = 省份编码  + 性别编码   + 主项大类    + 子项编码        │
 * │                                                         │
 * │   【专项/辅助编码】：                                    │
 * │     provinceCode + resolvedGender + resolvedTypeCode        │
 * │                + subCode + skillCode                           │
 * │     = 省份编码  + 性别(可能o不分性别)                    │
 * │       + 大类(含分组) + 子项编码 + 技能编码               │
 * │                                                         │
 * │   性别编码约定：m=男, f=女, o=不分性别(genderless=true) │
 * │                                                         │
 * │   getResolvedGenderCode  解析最终性别编码（考虑 genderless） │
 * │   buildMainItemCode     组装主项编码                     │
 * │   resolveSpecialTypeCode 组装专项大类编码（含groupKey前缀）   │
 * │   buildSpecialItemCode  组装专项/辅助项完整编码             │
 * │   buildMainCodeLog      主项编码日志结构（用于调试打印）     │
 * │   buildSpecialCodeLog  专项编码日志结构（用于调试打印）     │
 * └───────────────────────────────────────────────────────────┘
 *
 * ┌───────────────────────────────────────────────────────────┐
 * │ 第九部分：专项/辅助分组（Group）完整构建                   │
 * │   createEmptyProjectGroup   创建一个空分组兜底                │
 * │   extractPreviousTimeValues 从旧分组提取已选时间值         │
 * │   buildProjectGroup     构建完整分组的核心函数              │
 * │                         分两种结构分支：                   │
 * │                         ① 顶层技能型（TopSkill）        │
 * │                         ② 普通项目型（Sub -> Skills）     │
 * │   createInitialPageData 构建整个页面的首屏data             │
 * └───────────────────────────────────────────────────────────┘
 *
 * 【数据流方向】
 *   省份规则 JSON（distinguish_provinces_rule/）
 *     ↓ 读取
 *   本文件各 buildXxx 函数
 *     ↓ 输出标准化结构
 *   交互层（tool_f.js）setData 到页面
 *     ↓ 用户操作触发重建
 *   提交层（tool_f_submit.js）读取 data 组装提交
 *
 * 【依赖的关键外部文件】
 *   - ./rule2/distinguish_provinces_rule/index.js  各省规则全集
 *   - ./rule2/provinceMap.js                       省份编码→名称→项目配置映射
 *
 * 【暴露给外部的 API（module.exports 第 738-763 行）】
 * ============================================================
 */

// 导入各省规则全集和省份映射配置
const PROVINCE_RULES = require('./rule2/distinguish_provinces_rule/index.js');
const PROVINCE_MAP = require('./rule2/provinceMap.js');

/**
 * ==========================================================
 * 空规则兜底对象
 * 当省份不存在或规则缺失时返回此结构，防止 undefined 报错
 * 包含：省份/性别配置、规则编码、额外规则元、三大作用域规则
 * ==========================================================
 */
const EMPTY_RULES = {
  province: {},
  gender: {},
  ruleCodes: {
    computationRuleCode: '',        // 计算规则编码（如 t123）
    totalScoreCode: '',       // 总分规则编码
    specialCaseCodes: []        // 特殊案例规则编码列表
  },
  addRuleMeta: {
    computationRuleCode: '',
    totalScoreCode: '',
    specialCaseCodes: [],
    computationRule: null,     // 计算规则的完整对象（深拷贝后传给云函数）
    totalScoreRule: null,      // 总分规则的完整对象
    specialCaseRules: []      // 特殊案例规则对象数组
  },
  mainProject: {},            // 主项作用域规则容器
  specialProject: {},         // 专项作用域规则容器
  auxiliaryProject: {}        // 辅助作用域规则容器
};

/**
 * ==========================================================
 * 作用域字段映射表
 * 目的：消除 specialProject 和 auxiliaryProject 在 data 字段命名差异
 * 使交互层 _setScopeXxxByIndex 可以用统一代码操作两个作用域
 *
 * 字段含义：
 *   typeKeys   — 编码数组（data 字段名）
 *   typeList   — 显示名称数组（data 字段名）
 *   typeIndex  — 当前选中下标（data 字段名）
 *   group      — 完整分组对象（data 字段名）
 * ==========================================================
 */
const SCOPE_DATA_KEY_MAP = {
  specialProject: {
    typeKeys: 'specialTypeKeys',
    typeList: 'specialTypeList',
    typeIndex: 'specialTypeIndex',
    group: 'specialGroup'
  },
  auxiliaryProject: {
    typeKeys: 'auxiliaryTypeKeys',
    typeList: 'auxiliaryTypeList',
    typeIndex: 'auxiliaryTypeIndex',
    group: 'auxiliaryGroup'
  }
};

/**
 * ==========================================================
 * 时间选择器默认档位数（可被各省规则覆盖）
 *   DEFAULT_TIME_MINUTE_COUNT       分钟档位数（默认 10 档 = 0~9 分）
 *   DEFAULT_TIME_SECOND_COUNT       秒钟档位数（默认 60 档 = 0~59 秒）
 *   DEFAULT_TIME_MILLISECOND_COUNT  毫秒档位数（默认 100 档 = 0~99 毫秒）
 * ==========================================================
 */
const DEFAULT_TIME_MINUTE_COUNT = 10;
const DEFAULT_TIME_SECOND_COUNT = 60;
const DEFAULT_TIME_MILLISECOND_COUNT = 100;

/**
 * 生成默认分钟选项数组：['00', '01', ..., '09']
 */
const TIME_MINUTE_OPTIONS = Array.from(
  { length: DEFAULT_TIME_MINUTE_COUNT },
  (_, index) => String(index).padStart(2, '0')
);

/**
 * 生成默认秒钟选项数组：['00', '01', ..., '59']
 */
const TIME_SECOND_OPTIONS = Array.from(
  { length: DEFAULT_TIME_SECOND_COUNT },
  (_, index) => String(index).padStart(2, '0')
);

/**
 * 生成默认毫秒选项数组：['00', '01', ..., '99']
 */
const TIME_MILLISECOND_OPTIONS = Array.from(
  { length: DEFAULT_TIME_MILLISECOND_COUNT },
  (_, index) => String(index).padStart(2, '0')
);

/* ============================================================
 * 第二部分：时间工具函数族
 * ========================================================== */

/**
 * 根据规则配置构建时间选择器范围
 * 规则里可以通过 timeRange: { minute: 5, second: 30, millisecond: 50 } 自定义档位数量
 * 未配置的档位用默认值兜底
 * @param {Object} rule - 某项目规则对象（可能含 timeRange 字段）
 * @returns {Array<Array<string>>} 三维数组：[[分钟选项], [秒钟选项], [毫秒选项]]
 */
function buildTimePickerRange(rule) {
  const cfg = (rule && rule.timeRange) || {};
  const minuteCount = Number.isInteger(cfg.minute) && cfg.minute > 0 ? cfg.minute : DEFAULT_TIME_MINUTE_COUNT;
  const secondCount = Number.isInteger(cfg.second) && cfg.second > 0 ? cfg.second : DEFAULT_TIME_SECOND_COUNT;
  const millisecondCount = Number.isInteger(cfg.millisecond) && cfg.millisecond > 0 ? cfg.millisecond : DEFAULT_TIME_MILLISECOND_COUNT;
  return [
    Array.from({ length: minuteCount }, (_, index) => String(index).padStart(2, '0')),
    Array.from({ length: secondCount }, (_, index) => String(index).padStart(2, '0')),
    Array.from({ length: millisecondCount }, (_, index) => String(index).padStart(2, '0'))
  ];
}

/**
 * 数组下标越界夹取保护
 * 统一把任意 rawIndex 夹到 [0, length-1] 范围内
 * 场景：切换省份/大类后，列表长度变短，旧的选中下标会越界
 * @param {number} rawIndex - 原始下标
 * @param {number} length - 数组长度
 * @returns {number} 安全的下标值
 */
function clampIndex(rawIndex, length) {
  if (!Number.isInteger(rawIndex) || length <= 0) return 0;
  if (rawIndex < 0) return 0;
  if (rawIndex >= length) return length - 1;
  return rawIndex;
}

/**
 * 时间选择器三元组下标越界保护
 * 对 picker 返回的 [分下标, 秒下标, 毫秒下标] 逐个 clamp
 * @param {Array<number>} pickerValue - 原始 picker 值三元组
 * @param {Array<Array<string>>} timePickerRange - 时间范围三维数组
 * @returns {Array<number>} clamp 后的安全三元组
 */
function clampTimePickerValue(pickerValue, timePickerRange) {
  const value = Array.isArray(pickerValue) ? pickerValue.slice() : [0, 0, 0];
  const range = Array.isArray(timePickerRange)
    ? timePickerRange
    : [TIME_MINUTE_OPTIONS, TIME_SECOND_OPTIONS, TIME_MILLISECOND_OPTIONS];
  return [
    clampIndex(value[0], (range[0] || []).length || 1),
    clampIndex(value[1], (range[1] || []).length || 1),
    clampIndex(value[2], (range[2] || []).length || 1)
  ];
}

/**
 * 解析规则里配置的默认时间值
 * 支持两种配置写法：
 *   写法一（数组）：timeDefaultValue: [1, 30, 50]  → 1分30秒50毫秒
 *   写法二（对象）：timeDefault: {minute:1, second:30, millisecond:50}
 * 解析失败返回 null，调用方再决定兜底值
 * @param {Object} rule - 规则对象
 * @param {Array<Array<string>>} timePickerRange - 时间范围（用于clamp）
 * @returns {Array<number>|null} 默认时间三元组 或 null
 */
function getTimeDefaultValue(rule, timePickerRange) {
  if (!rule) return null;

  let arr = null;
  if (Array.isArray(rule.timeDefaultValue)) {
    arr = [
      parseInt(rule.timeDefaultValue[0], 10),
      parseInt(rule.timeDefaultValue[1], 10),
      parseInt(rule.timeDefaultValue[2], 10)
    ];
  } else if (rule.timeDefault && typeof rule.timeDefault === 'object') {
    arr = [
      parseInt(rule.timeDefault.minute, 10),
      parseInt(rule.timeDefault.second, 10),
      parseInt(rule.timeDefault.millisecond, 10)
    ];
  }

  if (!arr) return null;
  arr = arr.map((v) => (Number.isInteger(v) && v >= 0 ? v : 0));
  return clampTimePickerValue(arr, timePickerRange);
}

/**
 * 判断规则是否显式配置了默认时间
 * 用于决定是否在页面展示「默认是 xx分xx秒xx毫秒」提示语
 * @param {Object} rule - 规则对象
 * @returns {boolean} 是否有显式默认时间配置
 */
function hasExplicitTimeDefault(rule) {
  if (!rule) return false;
  if (Array.isArray(rule.timeDefaultValue)) return true;
  return !!(rule.timeDefault && typeof rule.timeDefault === 'object');
}

/**
 * 格式化默认时间三元组为日志可读字符串
 * 如 [1, 30, 50] → "[1, 30, 50]"
 * 主要用于控制台调试打印
 * @param {Array<number>} pickerValue - 时间下标三元组
 * @returns {string}
 */
function formatTimeDefaultArray(pickerValue) {
  const value = Array.isArray(pickerValue) ? pickerValue : [0, 0, 0];
  return '[' + value.map((item) => parseInt(item, 10) || 0).join(', ') + ']';
}

/**
 * 时间选择器下标三元组 → 提交格式 "mm:ss.SSS"
 * 例：下标 [1, 30, 50] + 默认范围 → "01:30.50"
 * 此值会直接存入 values[0] 并提交给后端查分
 * @param {Array<number>} pickerValue - 时间下标三元组
 * @param {Array<Array<string>>} timePickerRange - 时间范围
 * @returns {string} "mm:ss.SSS" 格式字符串
 */
function formatTimeValue(pickerValue, timePickerRange) {
  const value = Array.isArray(pickerValue) ? pickerValue : [0, 0, 0];
  const range = Array.isArray(timePickerRange)
    ? timePickerRange
    : [TIME_MINUTE_OPTIONS, TIME_SECOND_OPTIONS, TIME_MILLISECOND_OPTIONS];
  const minuteOpts = range[0] || TIME_MINUTE_OPTIONS;
  const secondOpts = range[1] || TIME_SECOND_OPTIONS;
  const milliOpts = range[2] || TIME_MILLISECOND_OPTIONS;
  const minute = minuteOpts[clampIndex(value[0], minuteOpts.length)] || minuteOpts[0];
  const second = secondOpts[clampIndex(value[1], secondOpts.length)] || secondOpts[0];
  const millisecond = milliOpts[clampIndex(value[2], milliOpts.length)] || milliOpts[0];
  return minute + ':' + second + '.' + millisecond;
}

/**
 * 时间选择器下标三元组 → 展示格式 "xx分 xx秒 xx毫秒"
 * 例：[1, 30, 50] → "01分 30秒 50毫秒"
 * 此值仅用于页面上给用户直观查看，不参与提交
 * @param {Array<number>} pickerValue - 时间下标三元组
 * @param {Array<Array<string>>} timePickerRange - 时间范围
 * @returns {string} 人类可读展示字符串
 */
function formatTimeDisplay(pickerValue, timePickerRange) {
  const value = Array.isArray(pickerValue) ? pickerValue : [0, 0, 0];
  const range = Array.isArray(timePickerRange)
    ? timePickerRange
    : [TIME_MINUTE_OPTIONS, TIME_SECOND_OPTIONS, TIME_MILLISECOND_OPTIONS];
  const minuteOpts = range[0] || TIME_MINUTE_OPTIONS;
  const secondOpts = range[1] || TIME_SECOND_OPTIONS;
  const milliOpts = range[2] || TIME_MILLISECOND_OPTIONS;
  const minute = minuteOpts[clampIndex(value[0], minuteOpts.length)] || minuteOpts[0];
  const second = secondOpts[clampIndex(value[1], secondOpts.length)] || secondOpts[0];
  const millisecond = milliOpts[clampIndex(value[2], milliOpts.length)] || milliOpts[0];
  return minute + '分 ' + second + '秒 ' + millisecond + '毫秒';
}

/**
 * 构建默认时间提示语（在输入框下方显示给考生）
 * 格式："为了方便各位考生查询：\n默认是 01分 30秒 50毫秒"
 * 技能级有配置则优先用技能级，否则回退到父级（项目级）配置
 * @param {Object} rule - 规则对象（技能级或项目级）
 * @param {Array<Array<string>>} timePickerRange - 时间范围
 * @returns {string} 提示语字符串，无默认则返回空串
 */
function buildTimeDefaultHint(rule, timePickerRange) {
  if (!hasExplicitTimeDefault(rule)) return '';
  const defaultValue = getTimeDefaultValue(rule, timePickerRange);
  if (!defaultValue) return '';
  return '为了方便各位考生查询：\n默认是 ' + formatTimeDisplay(defaultValue, timePickerRange);
}

/* ============================================================
 * 第三部分：省份与项目规则读取函数
 * ============================================================ */

/**
 * 获取指定省份的完整规则对象
 * 查不到则返回 EMPTY_RULES 兜底
 * @param {string} provinceKey - 省份编码键（如 'guangdong'）
 * @returns {Object} 省份规则对象
 */
function getProvinceRules(provinceKey) {
  return PROVINCE_RULES[provinceKey] || EMPTY_RULES;
}

/**
 * 获取省份的 addRuleMeta（额外规则元信息）
 * 包含：计算规则、总分规则、特殊案例规则的编码和完整对象
 * 提交阶段需要把这些传给云函数做评分
 * @param {string} provinceKey - 省份编码键
 * @returns {Object} addRuleMeta 对象
 */
function getProvinceRuleMeta(provinceKey) {
  const rules = getProvinceRules(provinceKey);
  return rules.addRuleMeta || EMPTY_RULES.addRuleMeta;
}

/**
 * 深拷贝规则元对象
 * 防止提交时修改对象造成的规则源数据污染（通过 JSON 序列化/反序列化）
 * @param {Object} ruleMeta - 规则元对象（computationRule/totalScoreRule 等）
 * @returns {Object|null} 深拷贝后的新对象
 */
function cloneRuleMeta(ruleMeta) {
  if (!ruleMeta) return null;
  return JSON.parse(JSON.stringify(ruleMeta));
}

/**
 * 构建省份选择器数据
 * 返回省份编码键数组 + 显示名称数组，下标一一对应
 * @returns {{provinceKeys: string[], provinceList: string[]}
 */
function buildProvinceList() {
  const keys = Object.keys(PROVINCE_MAP);
  return {
    provinceKeys: keys,
    provinceList: keys.map((key) => (PROVINCE_MAP[key] || {}).name || key)
  };
}

/**
 * 获取指定省份、指定作用域下所有已启用项目列表
 * 流程：从 PROVINCE_MAP 取配置 → 过滤 enabled:true → 按 order 升序排列
 * @param {string} provinceKey - 省份编码键
 * @param {string} scopeKey - 'mainProject' | 'specialProject' | 'auxiliaryProject'
 * @returns {Array<Object>} 已启用项目数组，每项形如 { code:'001', name:'身体素质', order:1, enabled:true, default:true }
 */
function getEnabledProjects(provinceKey, scopeKey) {
  const cfg = PROVINCE_MAP[provinceKey] || {};
  const list = Array.isArray(cfg[scopeKey]) ? cfg[scopeKey] : [];
  return list.filter((item) => item && item.enabled).sort((a, b) => a.order - b.order);
}

/**
 * 获取某省份默认选中的主项编码
 * 优先顺序：配置了 default:true 的项 → 列表第一项 → 空串
 * @param {string} provinceKey - 省份编码键
 * @returns {string} 主项编码（如 '001'）
 */
function getDefaultMainCode(provinceKey) {
  const list = getEnabledProjects(provinceKey, 'mainProject');
  const def = list.find((item) => item.default);
  return def ? def.code : (list[0] ? list[0].code : '');
}

/**
 * 获取某省某作用域某大类的具体规则
 * 这是规则进入各 buildXxx 函数的基础入口
 * @param {string} provinceKey - 省份编码键
 * @param {string} scopeKey - 作用域
 * @param {string} typeKey - 大类编码
 * @returns {Object|null} 具体规则对象（含 label / items / groups / skills 等字段）
 */
function getTypeRule(provinceKey, scopeKey, typeKey) {
  const rules = getProvinceRules(provinceKey);
  const scopeRule = rules[scopeKey] || {};
  return scopeRule[typeKey] || null;
}

/**
 * 构建项目类型显示名称列表
 * 取各项目编码对应的规则 label（中文名），没有 label 就用编码兜底
 * @param {string} provinceKey - 省份编码键
 * @param {string} scopeKey - 作用域
 * @param {Array<Object>} items - getEnabledProjects 返回的项目数组
 * @returns {Array<string>} 与 items 一一对应的显示名称数组
 */
function buildTypeList(provinceKey, scopeKey, items) {
  return items.map((item) => {
    const typeRule = getTypeRule(provinceKey, scopeKey, item.code);
    return (typeRule && typeRule.label) || item.code;
  });
}

/* ============================================================
 * 第四部分：主项（Main Project）状态构建
 * ============================================================ */

/**
 * 构建主项完整状态（页面 data 会用到两个结果）
 *
 * 主项分两类子项：
 *   A. 普通主项（mainSubList）：必选，每个考生都必须填写
 *   B. 多选一组（mainChooseGroups）：每组选 1 个或多个
 *
 * 处理流程：
 *   1. 读取 typeRule.items = 所有子项字典
 *   2. 读取 typeRule.chooseGroups = 多选组配置（每组 codes 列表表示多选一）
 *   3. 构建 mainChooseGroups：每组生成 options + 默认选中项
 *   4. 构建 mainSubList：过滤掉已被 chooseGroups 占用的子项（互斥），剩余就是普通必选子项
 *
 * @param {string} provinceKey - 省份编码键
 * @param {string} typeKey - 主项大类编码
 * @param {Array<Object>} [previousChooseGroups] - 旧多选组（用于切换主项时继承选中）
 * @returns {{mainSubList: Array, mainChooseGroups: Array<Object>}
 */
function buildMainProjectState(provinceKey, typeKey, previousChooseGroups) {
  const typeRule = getTypeRule(provinceKey, 'mainProject', typeKey);
  const items = (typeRule && typeRule.items) || {};
  const chooseGroups = Array.isArray(typeRule && typeRule.chooseGroups) ? typeRule.chooseGroups : [];
  const exclusiveCodeSet = new Set(); // 记录本大类中被「多选组」占用的编码集合（用于后续过滤普通子项）

  const mainChooseGroups = chooseGroups.map((group, groupIndex) => {
    // 过滤出 codes 中确实存在于 items 的编码（防规则配置错）
    const codes = Array.isArray(group.codes) ? group.codes.filter((code) => items[code]) : [];
    // 组装显示用 options：编码+名称+单位
    const options = codes.map((code) => ({
      code,
      name: items[code].name || '',
      unit: items[code].unit || ''
    }));
    // 把该组所有编码记入互斥集合
    codes.forEach((code) => exclusiveCodeSet.add(code));

    // 继承上一状态选中值（如果新组仍包含旧编码则保留，否则选第一个）
    const previousGroup = Array.isArray(previousChooseGroups) ? previousChooseGroups[groupIndex] : null;
    const previousSelectedCode = previousGroup && previousGroup.selectedCode;
    const selectedCode = options.some((option) => option.code === previousSelectedCode)
      ? previousSelectedCode
      : (options[0] ? options[0].code : '');

    return {
      label: group.label || '项目',    // 组标题（如"选考一项"）
      choose: group.choose || 1,       // 每组选几个（默认1=多选一）
      options,                      // 候选项目数组
      selectedCode                  // 当前选中编码
    };
  });

  // 普通主项子列表 = 所有子项 - 互斥集合中的编码（即没被多选组占用的就是必选）
  const mainSubList = Object.keys(items)
    .filter((code) => !exclusiveCodeSet.has(code))
    .map((code) => ({
      code,
      name: items[code].name || '',
      unit: items[code].unit || ''
    }));

  return {
    mainSubList,
    mainChooseGroups
  };
}

/**
 * 汇总当前主项下所有激活的子项
 * = 普通必选主项 + 每个多选组中选中的那一项
 * 用于：提交阶段遍历每个子项拿成绩
 * @param {Array} mainSubList - 普通主项子列表
 * @param {Array<Object>} mainChooseGroups - 多选一组列表
 * @returns {Array<Object>} 所有激活子项数组（每项含 code/name/unit）
 */
function getMainActiveItems(mainSubList, mainChooseGroups) {
  const result = Array.isArray(mainSubList) ? mainSubList.slice() : [];
  (mainChooseGroups || []).forEach((group) => {
    const selectedItem = (group.options || []).find((option) => option.code === group.selectedCode);
    if (selectedItem) result.push(selectedItem);
  });
  return result;
}

/* ============================================================
 * 第五部分：专项/辅助元数据读取函数
 * ============================================================ */

/**
 * 获取一个大类下的分组元信息
 * groups 结构示例：{ groupA: {label:'男子组', items:{...}}, groupB: {label:'女子组', items:{...}} }
 * @param {Object} typeRule - 大类规则
 * @returns {{groupKeys: string[], groupList: string[], groupLabel: string}}
 */
function getTypeGroupMeta(typeRule) {
  const groups = (typeRule && typeRule.groups) || {};
  const groupKeys = Object.keys(groups);
  return {
    groupKeys,                          // 分组编码数组 ['groupA','groupB']
    groupList: groupKeys.map((key) => groups[key].label || key), // 分组显示名
    groupLabel: (typeRule && typeRule.groupLabel) || '分组'       // 分组标签（用于UI显示："性别分组"等）
  };
}

/**
 * 判断是否为「顶层技能型」大类
 * 顶层技能型结构：大类直接挂 skills，没有 items 也没有 groups
 * 典型场景：某些省份直接把技能列在大类下，不分子项
 * @param {Object} typeRule - 大类规则
 * @returns {boolean}
 */
function hasTopLevelSkills(typeRule) {
  return !!(typeRule && typeRule.skills && !typeRule.items && !typeRule.groups);
}

/**
 * 获取指定分组下的所有子项字典
 * 规则分两种结构：
 *   ① 有 groups：需先定位到具体 group，再取其 items
 *   ② 无 groups（扁平结构）：直接取 typeRule.items
 * @param {Object} typeRule - 大类规则
 * @param {string} groupKey - 分组编码（结构①用）
 * @returns {Object} 子项字典 { subCode1: {name,unit,skills...}, subCode2: {...} }
 */
function getTypeItems(typeRule, groupKey) {
  if (!typeRule) return {};
  if (typeRule.groups) {
    const groupKeys = Object.keys(typeRule.groups);
    const resolvedGroupKey = groupKey && typeRule.groups[groupKey] ? groupKey : groupKeys[0];
    const groupRule = resolvedGroupKey ? typeRule.groups[resolvedGroupKey] : null;
    return (groupRule && groupRule.items) || {};
  }
  return typeRule.items || {};
}

/**
 * 获取具体子项的规则配置
 * @param {Object} typeRule - 大类规则
 * @param {string} groupKey - 分组编码
 * @param {string} subCode - 子项编码
 * @returns {Object}
 */
function getItemRule(typeRule, groupKey, subCode) {
  const items = getTypeItems(typeRule, groupKey);
  return items[subCode] || {};
}

/**
 * 构建子项显示列表（页面展示用）
 * @param {Object} typeRule - 大类规则
 * @param {string} groupKey - 分组编码
 * @returns {Array<{code, name, unit, hasSkill}>}
 */
function buildProjectSubList(typeRule, groupKey) {
  const items = getTypeItems(typeRule, groupKey);
  return Object.keys(items).map((code) => {
    const item = items[code] || {};
    return {
      code,
      name: item.name || '',
      unit: item.unit || '',
      hasSkill: !!item.skills   // 子项是否下挂技能（如"助跑摸高"分多个动作）
    };
  });
}

/**
 * 计算一个技能项需要几个输入框
 * 依据规则：parallel=true 时读 parallel_num（如 parallel_num=2 → 两次试跳/两次投掷）
 * parallel 为假或不配置则返回1
 * @param {Object} skill - 技能规则
 * @returns {number}
 */
function getSkillInputCount(skill) {
  const count = skill && skill.parallel ? parseInt(skill.parallel_num, 10) : 1;
  return Number.isInteger(count) && count > 1 ? count : 1;
}

/**
 * 读取子项规则中的 choose 字段（技能选几项）
 * choose=1 → 用 picker 选择一个技能；choose>1 → 展示所有技能让用户逐个填
 * @param {Object} rule - 子项或大类规则
 * @returns {number} 0 表示该字段未配置
 */
function getChooseCount(rule) {
  const count = parseInt(rule && rule.choose, 10);
  return Number.isInteger(count) && count > 0 ? count : 0;
}

/**
 * 判断是否启用「分+秒+毫秒」时间输入模式
 * 规则字段名是英文的 "Seconds and minutes"，值为 truthy 即启用
 * 启用后显示 picker 三列选择器（分/秒/毫秒）代替普通数字输入
 * @param {Object} rule - 规则对象（可能是大类、子项或技能级）
 * @returns {boolean}
 */
function useMinuteSecondTime(rule) {
  return !!(rule && rule['Seconds and minutes']);
}

/**
 * 把各种格式的用户输入值统一转换成可比较的浮点数
 * 支持格式：
 *   - 纯数字字符串："12.5" → 12.5
 *   - 带比较符号：">=12.5" → 12.5
 *   - 时间格式："01:30.5" → 90.5 秒（用于时间类数值比较）
 *   - 空值、非法值 → NaN
 * @param {*} raw - 原始输入
 * @returns {number} 标准化后的浮点数，失败返回 NaN
 */
function normalizeComparableValue(raw) {
  if (raw === undefined || raw === null) return NaN;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;

  const text = String(raw).trim();
  if (!text) return NaN;

  // 先去掉所有比较符号（< > = ≤ ≥）和空格
  const cleaned = text
    .replace(/[<>=≤≥]/g, '')
    .replace(/\s+/g, '');

  if (!cleaned) return NaN;

  // 包含冒号 → 视作时间格式 mm:ss.SSS → 换算成总秒数
  if (cleaned.includes(':')) {
    const parts = cleaned.split(':').map((part) => parseFloat(part));
    if (parts.some((part) => Number.isNaN(part))) return NaN;
    // 从左到右依次进位：分*60 + 秒(.毫秒)
    return parts.reduce((total, part) => total * 60 + part, 0);
  }

  const numeric = parseFloat(cleaned);
  return Number.isNaN(numeric) ? NaN : numeric;
}

/**
 * 根据技能规则生成多输入框标签名数组
 * 场景：parallel_num=3，name="跳远" → ["跳远1","跳远2","跳远3"]
 * 若 name 本身是用逗号/顿号分隔的多段，则直接拆成多段截取
 * @param {Object} skill - 技能规则
 * @returns {Array<string>}
 */
function getSkillInputLabels(skill) {
  const count = getSkillInputCount(skill);
  const name = skill && skill.name ? String(skill.name) : '输入';
  if (count === 1) return [name];

  // 尝试按分隔符（中英文逗号、斜杠、顿号）拆分名字
  const parts = name
    .split(/[,\uff0c\/、]/)
    .map((item) => item.trim())
    .filter(Boolean);

  // 拆分段数足够则直接用分段
  if (parts.length >= count) {
    return parts.slice(0, count);
  }

  // 分段数不够则 name+序号："跳远1" "跳远2"...
  return Array.from({ length: count }, (_, index) => name + (index + 1));
}

/* ============================================================
 * 第六部分：技能项标准化构建（buildSkillItems）
 * ============================================================ */

/**
 * 将原始规则中的 skills 字典转换为页面可直接渲染的标准化数组
 * 这是规则层最重要的「翻译器」之一：把各种配置型结构变成页面 skillItems
 *
 * 每个 skillItem 标准化后包含：
 *   code             技能编码（4位）
 *   name             技能名称
 *   unit             单位（米/秒/个等）
 *   inputCount       输入框个数
 *   inputLabels      输入框标签数组
 *   isTimePicker     是否走时间 picker 模式
 *   timePickerRange  时间范围三维数组
 *   timePickerValue  当前时间下标三元组
 *   timeDisplay      时间展示字符串
 *   timeDefaultHint  默认时间提示语（给考生）
 *   allowNegative    是否允许负数（如温度、得分有正负）
 *   values           输入值字符串数组（length=inputCount）
 *
 * @param {Object} skills - 原始技能字典 { code1: skillRule1, code2: skillRule2 }
 * @param {Object} options - 构建选项
 * @param {boolean} options.useMinuteSecondTime - 是否启用时间模式
 * @param {Array} options.timePickerRange - 时间范围
 * @param {Object} options.parentRule - 父级规则（子项或大类）用于 fallback 默认时间
 * @param {Object} options.previousTimePickerValues - 旧分组同编码下各技能的时间值 {code: [m,s,ms]}
 * @returns {{skillKeys, skillList, skillUnits, skillItems}}
 */
function buildSkillItems(skills, options) {
  const opts = options || {};
  // 确定本批技能共用的时间范围
  const itemTimePickerRange = Array.isArray(opts.timePickerRange)
    ? opts.timePickerRange
    : (opts.useMinuteSecondTime
      ? buildTimePickerRange(null)
      : [TIME_MINUTE_OPTIONS, TIME_SECOND_OPTIONS, TIME_MILLISECOND_OPTIONS]);
  // 父级默认时间值（技能本身没配置时回退用）
  const parentDefaultValue = Array.isArray(opts.parentDefaultValue)
    ? opts.parentDefaultValue
    : getTimeDefaultValue(opts.parentRule, itemTimePickerRange);

  const skillKeys = Object.keys(skills || {});
  const skillItems = skillKeys.map((code) => {
    const skill = skills[code] || {};
    const inputCount = getSkillInputCount(skill);
    const inputLabels = getSkillInputLabels(skill);
    // 单输入框 + 启用时间模式 = 走 picker
    const isTimePicker = !!opts.useMinuteSecondTime && inputCount === 1;

    // 优先从 previousValues.skills 里继承（同编码则继承）
    const previousValue = Array.isArray(opts.previousTimePickerValues) && Array.isArray(opts.previousTimePickerValues[code])
      ? opts.previousTimePickerValues[code]
      : null;
    // 技能自身的默认时间
    const skillOwnDefault = isTimePicker ? getTimeDefaultValue(skill, itemTimePickerRange) : null;
    // 兜底优先级：上一次选择 > 技能默认 > 父级默认 > [0,0,0]
    const fallbackValue = skillOwnDefault || parentDefaultValue || [0, 0, 0];
    const rawTimePickerValue = previousValue || fallbackValue;
    const timePickerValue = isTimePicker ? clampTimePickerValue(rawTimePickerValue, itemTimePickerRange) : [0, 0, 0];

    return {
      code,
      name: skill.name || '',
      unit: skill.unit || '',
      inputCount,
      inputLabels,
      isTimePicker,
      timePickerRange: itemTimePickerRange,
      timePickerValue,
      timeDisplay: isTimePicker ? formatTimeDisplay(timePickerValue, itemTimePickerRange) : '',
      // 默认时间提示：优先技能级 → 回退到父级（项目/大类级）
      timeDefaultHint: isTimePicker
        ? buildTimeDefaultHint(skill, itemTimePickerRange) || buildTimeDefaultHint(opts.parentRule, itemTimePickerRange)
        : '',
      allowNegative: skill.number === 'Positive or negative',
      values: Array.from({ length: inputCount }, () => '')
    };
  });

  return {
    skillKeys,          // 技能编码数组（提交编码用）
    skillList: skillItems.map((item) => item.name), // 技能名数组（picker显示）
    skillUnits: skillItems.map((item) => item.unit), // 技能单位数组
    skillItems         // 完整技能对象数组（页面渲染核心）
  };
}

/* ============================================================
 * 第七部分：当前项获取与时间上下文判断（切换继承用）
 * ============================================================ */

/**
 * 从分组中取出当前选中的技能项
 * skillIndex 合法则取对应项，否则回退到第一项
 * @param {Object} group - 分组对象
 * @returns {Object|null}
 */
function getCurrentSkillItem(group) {
  const skillItems = (group && group.skillItems) || [];
  const skillIndex = parseInt(group && group.skillIndex, 10);
  if (!skillItems.length) return null;
  if (Number.isInteger(skillIndex) && skillItems[skillIndex]) return skillItems[skillIndex];
  return skillItems[0];
}

/**
 * 从分组中取出当前选中子项的编码
 * @param {Object} group - 分组对象
 * @returns {string}
 */
function getCurrentSubCode(group) {
  const subList = (group && group.subList) || [];
  const subIndex = parseInt(group && group.subIndex, 10);
  if (!subList.length) return '';
  if (Number.isInteger(subIndex) && subList[subIndex] && subList[subIndex].code) return subList[subIndex].code;
  return (subList[0] && subList[0].code) || '';
}

/**
 * 判断旧分组与新参数是否属于同一个「直接输入型时间上下文」
 * 同上下文 = 大类/分组/子项编码完全一致，且旧分组确实是直接picker模式
 * 返回 true 时可以安全继承旧分组 currentTimePickerValue，减少用户重新选择
 * @param {Object} previousGroup - 旧分组
 * @param {string} typeKey - 新大类编码
 * @param {string} groupKey - 新分组编码
 * @param {string} subCode - 新子项编码
 * @returns {boolean}
 */
function isSameDirectTimeContext(previousGroup, typeKey, groupKey, subCode) {
  if (!previousGroup || !typeKey || !subCode) return false;
  return previousGroup.typeKey === typeKey
    && previousGroup.groupKey === groupKey
    && getCurrentSubCode(previousGroup) === subCode
    && !!previousGroup.currentIsTimePicker;
}

/**
 * 判断旧分组与新参数是否属于同一个「技能型时间上下文」
 * 同上下文时可以安全继承旧分组 skillItems 下各技能的时间值
 * TopSkill型只判断大类是否相同（因为没有子项概念）
 * @param {Object} previousGroup - 旧分组
 * @param {string} typeKey - 新大类
 * @param {string} groupKey - 新分组
 * @param {string} subCode - 新子项
 * @param {boolean} isTopSkill - 是否顶层技能型结构
 * @returns {boolean}
 */
function isSameSkillTimeContext(previousGroup, typeKey, groupKey, subCode, isTopSkill) {
  if (!previousGroup || !typeKey) return false;
  if (previousGroup.typeKey !== typeKey) return false;
  if (isTopSkill) return true;
  if (!subCode) return false;
  return previousGroup.groupKey === groupKey && getCurrentSubCode(previousGroup) === subCode;
}

/* ============================================================
 * 第八部分：项目编码生成（提交给后端查分的核心编码算法）
 * ============================================================ */

/**
 * 根据项目规则和技能规则解析最终性别编码
 * 优先级：技能级 genderless → 子项级 genderless → 用户选择的 genderCode
 * genderless = true → 性别不分男女，编码固定为 'o'
 * @param {string} genderCode - 用户选择的性别编码 'm' | 'f'
 * @param {Object} itemRule - 子项规则（可能含 genderless）
 * @param {Object} skillRule - 技能规则（可能含 genderless）
 * @returns {string} 'm' | 'f' | 'o'
 */
function getResolvedGenderCode(genderCode, itemRule, skillRule) {
  if (skillRule && skillRule.genderless) return 'o';
  if (itemRule && itemRule.genderless) return 'o';
  return genderCode;
}

/**
 * 构建主项完整编码
 * 公式：provinceCode + genderCode + mainTypeKey + subCode
 * 示例：广东('002', 'm', 'm1', 'A0001') → '002mm1A0001'
 * @param {string} provinceCode - 省份编码（如 '002' 广东）
 * @param {string} genderCode - 性别编码 'm' | 'f'
 * @param {string} mainTypeKey - 主项大类编码
 * @param {string} subCode - 子项编码
 * @returns {string}
 */
function buildMainItemCode(provinceCode, genderCode, mainTypeKey, subCode) {
  return provinceCode + genderCode + mainTypeKey + subCode;
}

/**
 * 解析专项大类编码（含分组前缀处理）
 * 场景：部分省份 groupKey 已经包含 typeKey 前缀，避免重复拼接
 * 例：specialTypeKey='002m', groupKey='002m4d' → 直接返回 groupKey（已含前缀）
 * 例：specialTypeKey='002m', groupKey='4d' → 返回 '002m4d'
 * @param {string} specialTypeKey - 专项大类编码
 * @param {string} groupKey - 分组编码
 * @returns {string} 合并后的 type+group 编码
 */
function resolveSpecialTypeCode(specialTypeKey, groupKey) {
  if (!groupKey) return specialTypeKey;
  if (groupKey.indexOf(specialTypeKey) === 0) return groupKey;
  return specialTypeKey + groupKey;
}

/**
 * 构建专项/辅助项目完整编码
 * 公式：provinceCode + resolvedGender + resolvedTypeCode + subCode + skillCode
 * 其中：
 *   resolvedGender   = 考虑 genderless 之后的性别编码
 *   resolvedTypeCode = specialTypeKey + groupKey（去重前缀）
 * @param {string} provinceCode - 省份编码
 * @param {string} genderCode - 用户性别编码 'm'|'f'
 * @param {string} specialTypeKey - 专项大类编码
 * @param {string} subCode - 子项编码（顶层技能型则传 ''）
 * @param {Object} itemRule - 子项规则（用于 genderless 判断）
 * @param {string} skillCode - 技能编码（直接输入型则传 ''）
 * @param {Object} skillRule - 技能规则（用于 genderless 判断）
 * @param {string} groupKey - 分组编码
 * @returns {string}
 */
function buildSpecialItemCode(provinceCode, genderCode, specialTypeKey, subCode, itemRule, skillCode, skillRule, groupKey) {
  const resolvedGenderCode = getResolvedGenderCode(genderCode, itemRule, skillRule);
  const resolvedTypeCode = resolveSpecialTypeCode(specialTypeKey, groupKey);
  return provinceCode + resolvedGenderCode + resolvedTypeCode + subCode + (skillCode || '');
}

/**
 * 构建主项编码日志对象（用于控制台调试打印）
 * 提交时 console.log 该对象，方便排查编码问题
 * @param {string} provinceCode
 * @param {string} genderCode
 * @param {string} mainTypeKey
 * @param {string} subCode
 * @param {string} code - 最终生成的编码
 * @returns {Object} 日志结构
 */
function buildMainCodeLog(provinceCode, genderCode, mainTypeKey, subCode, code) {
  return {
    scope: 'main',
    provinceCode,
    genderCode,
    typeKey: mainTypeKey,
    subCode,
    code
  };
}

/**
 * 构建专项/辅助编码日志对象（详细记录编码各片段值来源）
 * 对比主项多了：
 *   inputGenderCode vs resolvedGenderCode 可看出是否因 genderless 改写
 *   groupKey / resolvedTypeCode  可看出分组前缀拼接
 *   genderlessFromItem / genderlessFromSkill  哪一层导致不分性别
 * @param {string} provinceCode
 * @param {string} genderCode - 用户原始性别
 * @param {string} specialTypeKey
 * @param {string} subCode
 * @param {Object} itemRule
 * @param {string} skillCode
 * @param {Object} skillRule
 * @param {string} code - 最终编码
 * @param {string} scopeKey - 'specialProject' | 'auxiliaryProject'
 * @param {string} groupKey
 * @returns {Object}
 */
function buildSpecialCodeLog(provinceCode, genderCode, specialTypeKey, subCode, itemRule, skillCode, skillRule, code, scopeKey, groupKey) {
  return {
    scope: scopeKey || 'specialProject',
    provinceCode,
    inputGenderCode: genderCode,
    resolvedGenderCode: getResolvedGenderCode(genderCode, itemRule, skillRule),
    typeKey: specialTypeKey,
    groupKey: groupKey || '',
    resolvedTypeCode: resolveSpecialTypeCode(specialTypeKey, groupKey),
    subCode,
    skillCode: skillCode || '',
    genderlessFromItem: !!(itemRule && itemRule.genderless),
    genderlessFromSkill: !!(skillRule && skillRule.genderless),
    code
  };
}

/* ============================================================
 * 第九部分：专项/辅助分组（Group）完整构建
 * ============================================================ */

/**
 * 创建一个空的项目分组兜底对象
 * 当省份/作用域无对应规则时返回，防止页面渲染报错
 * 所有字段给合理默认值，方便 wxml 直接访问不需要层层判空
 * @param {string} scopeKey - 'specialProject' | 'auxiliaryProject'
 * @returns {Object} 完整的空分组结构（所有字段齐全）
 */
function createEmptyProjectGroup(scopeKey) {
  const defaultTimeRange = buildTimePickerRange(null);
  return {
    scopeKey,                       // 作用域标识
    typeKey: '',                     // 当前选中大类编码
    typeLabel: '',                  // 当前选中大类名称
    groupKeys: [],                  // 分组编码数组
    groupList: [],                  // 分组显示名称数组
    groupLabel: '分组',              // 分组标签（UI显示）
    groupIndex: 0,                  // 当前分组下标
    groupKey: '',                   // 当前分组编码
    subList: [],                    // 子项数组
    subNames: [],                   // 子项名称数组（可能 UI 用）
    subIndex: 0,                    // 当前子项下标
    currentSubName: '',              // 当前子项名
    currentUnit: '',                // 当前单位（直接输入型展示）
    currentAllowNegative: false,     // 当前是否允许负数输入
    currentIsTimePicker: false,     // 当前是否直接走时间 picker
    currentTimePickerRange: defaultTimeRange, // 当前时间范围
    currentTimePickerValue: clampTimePickerValue([0, 0, 0], defaultTimeRange), // 当前时间下标
    currentTimeDisplay: '',          // 当前时间展示文字
    currentTimeDefaultHint: '',       // 当前默认时间提示
    score: '',                       // 直接输入型的成绩值（字符串）
    hasSkill: false,                // 当前子项是否下挂技能
    showSkill: false,               // UI 是否展开技能区
    skillKeys: [],                  // 技能编码数组
    skillList: [],                  // 技能名称数组
    skillUnits: [],                  // 技能单位数组
    skillItems: [],                 // 技能完整对象数组
    skillChooseCount: 0,            // 规则配置的 choose 值
    useSkillPicker: false,         // choose=1 时用 picker 选一个技能
    skillIndex: 0,                  // 当前技能选中下标
    currentSkillItem: null          // 当前技能快照（UI 渲染当前技能详情）
  };
}

/**
 * 从旧分组中提取用户已选的时间值（切换时继承用）
 * 提取两部分：
 *   ① current：直接picker型的 currentTimePickerValue（整组共用一个）
 *   ② skills：技能型各 skillItem 各自的 timePickerValue
 * @param {Object} previousGroup - 旧分组
 * @returns {{current: Array|null, skills: Object<{code: [m,s,ms]}>}}
 */
function extractPreviousTimeValues(previousGroup) {
  if (!previousGroup) return { current: null, skills: {} };
  const prevSkillValues = {};
  (previousGroup.skillItems || []).forEach((item) => {
    if (item && item.code && Array.isArray(item.timePickerValue)) {
      prevSkillValues[item.code] = item.timePickerValue;
    }
  });
  return {
    current: Array.isArray(previousGroup.currentTimePickerValue) ? previousGroup.currentTimePickerValue : null,
    skills: prevSkillValues
  };
}

/**
 * ============================================================
 * 构建项目分组的核心函数（规则层最复杂的一个函数）
 * 根据省份+作用域+大类+分组+子项，生成完整 group 对象
 *
 * 核心两大分支结构：
 *
 * 分支① 顶层技能型（hasTopLevelSkills=true）
 *   大类规则直接挂 skills（无 items 无 groups）：
 *   └─ typeRule.skills → skillItems[]
 *      页面直接展示所有技能让用户选/填（不需要子项选择区）
 *
 * 分支② 普通项目型（默认分支）
 *   常规：groups → group.items → subItem.skills
 *   ├─ groupIndex 选分组（性别组/年龄组）
 *   ├─ subIndex 选子项（100米/跳远/铅球...）
 *   └─ 子项有两种输入形态：
 *      ├─ A. hasSkill=true：子项下挂 skills → 技能区（与分支①类似）
 *      └─ B. hasSkill=false：子项本身直接输入
 *                         ├─ 时间型 → 分秒picker
 *                         └─ 数值型 → 普通input
 *
 * 时间值继承策略：
 *   通过 extractPreviousTimeValues 从旧分组提取
 *   通过 isSameDirectTimeContext / isSameSkillTimeContext 判断是否属于同上下文
 *   同上下文才继承，避免串值（比如从100米picker跳到跳远不应继承时间）
 *
 * @param {string} provinceKey - 省份编码键
 * @param {string} scopeKey - 作用域
 * @param {string} typeKey - 大类编码
 * @param {Object} options - 构建选项
 * @param {number} options.groupIndex - 指定分组下标
 * @param {number} options.subIndex - 指定子项下标
 * @param {number} options.skillIndex - 指定技能下标
 * @param {Object} options.previousGroup - 上一次的分组（用于继承）
 * @param {Object} options.previousValues - 已提取的旧时间值（优先传，不传则从 previousGroup 现抽）
 * @returns {Object} 完整分组对象（结构同 createEmptyProjectGroup）
 */
function buildProjectGroup(provinceKey, scopeKey, typeKey, options) {
  const opts = options || {};
  const typeRule = getTypeRule(provinceKey, scopeKey, typeKey);
  // 规则查不到直接返回空分组兜底
  if (!typeRule) {
    return createEmptyProjectGroup(scopeKey);
  }

  // 提取上一次时间值（优先用传的 previousValues，不传就从 previousGroup 抽）
  const previousValues = opts.previousValues || extractPreviousTimeValues(opts.previousGroup);
  const previousGroup = opts.previousGroup || null;
  // 分组元信息 + 确定当前分组下标和编码
  const groupMeta = getTypeGroupMeta(typeRule);
  const groupIndex = clampIndex(parseInt(opts.groupIndex, 10), groupMeta.groupKeys.length || 1);
  const groupKey = groupMeta.groupKeys[groupIndex] || '';
  // 是否顶层技能型结构
  const isTopSkill = hasTopLevelSkills(typeRule);

  /* -------------------- 分支①：顶层技能型结构 -------------------- */
  if (isTopSkill) {
    const topTimePickerRange = buildTimePickerRange(typeRule);
    // 判断技能时间上下文：大类相同则允许继承技能时间
    const allowSkillPrevious = isSameSkillTimeContext(previousGroup, typeKey, groupKey, '', true);
    // 构建技能项
    const skillMeta = buildSkillItems(typeRule.skills, {
      useMinuteSecondTime: useMinuteSecondTime(typeRule),
      timePickerRange: topTimePickerRange,
      parentRule: typeRule,
      previousTimePickerValues: allowSkillPrevious ? previousValues.skills : null
    });
    const skillIndex = clampIndex(parseInt(opts.skillIndex, 10), skillMeta.skillItems.length || 1);
    const currentSkillItem = skillMeta.skillItems[skillIndex] || null;
    // 顶层技能大类默认时间（用于 currentTimePickerValue 兜底）
    const topLevelDefault = getTimeDefaultValue(typeRule, topTimePickerRange);
    // 上一次同上下文的 current 值，否则默认
    const rawTopCurrentValue = previousValues.current || topLevelDefault || [0, 0, 0];

    return {
      scopeKey,
      typeKey,
      typeLabel: typeRule.label || '',
      groupKeys: groupMeta.groupKeys,
      groupList: groupMeta.groupList,
      groupLabel: groupMeta.groupLabel,
      groupIndex,
      groupKey,
      subList: [],              // 顶层技能型无子项概念
      subNames: [],
      subIndex: 0,
      currentSubName: '',
      currentUnit: currentSkillItem ? currentSkillItem.unit : '',
      currentAllowNegative: false,
      currentIsTimePicker: false, // 顶层型：时间在技能内部，不是整组共用
      currentTimePickerRange: topTimePickerRange,
      currentTimePickerValue: clampTimePickerValue(rawTopCurrentValue, topTimePickerRange),
      currentTimeDisplay: '',
      currentTimeDefaultHint: '',
      score: '',
      hasSkill: true,
      showSkill: true,
      skillKeys: skillMeta.skillKeys,
      skillList: skillMeta.skillList,
      skillUnits: skillMeta.skillUnits,
      skillItems: skillMeta.skillItems,
      skillChooseCount: getChooseCount(typeRule),
      useSkillPicker: getChooseCount(typeRule) === 1,
      skillIndex,
      currentSkillItem
    };
  }

  /* -------------------- 分支②：普通项目型结构 -------------------- */
  // 步骤1：构建子项列表 + 确定当前子项 + 取子项规则
  const subList = buildProjectSubList(typeRule, groupKey);
  const subIndex = clampIndex(parseInt(opts.subIndex, 10), subList.length || 1);
  const currentSub = subList[subIndex] || null;
  const itemRule = currentSub ? getItemRule(typeRule, groupKey, currentSub.code) : {};
  const hasSkill = !!(currentSub && currentSub.hasSkill); // 子项下是否有技能
  const currentSubCode = currentSub ? currentSub.code : '';
  // 子项级的时间范围（直接输入型用）
  const itemDirectTimeRange = buildTimePickerRange(itemRule);

  // 步骤2：默认声明（后续根据 hasSkill 条件赋值）
  let skillMeta = { skillKeys: [], skillList: [], skillUnits: [], skillItems: [] };
  let skillChooseCount = 0;
  let useSkillPicker = false;
  let skillIndex = 0;
  let currentSkillItem = null;
  // 直接输入型的几个字段：
  let currentUnit = currentSub ? currentSub.unit : '';
  let currentAllowNegative = itemRule.number === 'Positive or negative';
  // 是否走直接时间 picker（启用分秒模式 + 无技能才是直接picker）
  let currentIsTimePicker = useMinuteSecondTime(itemRule) && !hasSkill;
  // 直接picker的默认值
  const itemOwnDefault = getTimeDefaultValue(itemRule, itemDirectTimeRange);
  // 判断直接picker上下文是否相同（相同则继承上次值）
  const directPreviousValue = isSameDirectTimeContext(previousGroup, typeKey, groupKey, currentSubCode)
    ? previousValues.current
    : null;
  const rawDirectValue = directPreviousValue || itemOwnDefault || [0, 0, 0];
  let currentTimePickerValue = clampTimePickerValue(rawDirectValue, itemDirectTimeRange);
  let currentTimeDisplay = currentIsTimePicker ? formatTimeDisplay(currentTimePickerValue, itemDirectTimeRange) : '';
  let currentTimeDefaultHint = currentIsTimePicker ? buildTimeDefaultHint(itemRule, itemDirectTimeRange) : '';

  // 步骤3：子项有技能 → 构建技能，覆盖部分直接型字段
  if (hasSkill) {
    const skillTimeRange = buildTimePickerRange(itemRule);
    // 判断技能时间上下文（大类+分组+子项都相同才继承技能各时间）
    const allowSkillPrevious = isSameSkillTimeContext(previousGroup, typeKey, groupKey, currentSubCode, false);
    skillMeta = buildSkillItems(itemRule.skills, {
      useMinuteSecondTime: useMinuteSecondTime(itemRule),
      timePickerRange: skillTimeRange,
      parentRule: itemRule,
      previousTimePickerValues: allowSkillPrevious ? previousValues.skills : null
    });
    skillChooseCount = getChooseCount(itemRule);
    useSkillPicker = skillChooseCount === 1;
    skillIndex = clampIndex(parseInt(opts.skillIndex, 10), skillMeta.skillItems.length || 1);
    currentSkillItem = skillMeta.skillItems[skillIndex] || null;
    // 技能型：单位从当前技能取
    currentUnit = currentSkillItem ? currentSkillItem.unit : '';
    currentAllowNegative = false;
    currentIsTimePicker = false; // 技能型时间在 skillItem 内部，不是整组共用 picker
    currentTimePickerValue = clampTimePickerValue([0, 0, 0], itemDirectTimeRange);
    currentTimeDisplay = '';
    currentTimeDefaultHint = '';
  }

  return {
    scopeKey,
    typeKey,
    typeLabel: typeRule.label || '',
    groupKeys: groupMeta.groupKeys,
    groupList: groupMeta.groupList,
    groupLabel: groupMeta.groupLabel,
    groupIndex,
    groupKey,
    subList,
    subNames: subList.map((item) => item.name),
    subIndex,
    currentSubName: currentSub ? currentSub.name : '',
    currentUnit,
    currentAllowNegative,
    currentIsTimePicker,
    currentTimePickerRange: itemDirectTimeRange,
    currentTimePickerValue,
    currentTimeDisplay,
    currentTimeDefaultHint,
    score: '',
    hasSkill,
    showSkill: hasSkill,
    skillKeys: skillMeta.skillKeys,
    skillList: skillMeta.skillList,
    skillUnits: skillMeta.skillUnits,
    skillItems: skillMeta.skillItems,
    skillChooseCount,
    useSkillPicker,
    skillIndex,
    currentSkillItem
  };
}

/**
 * 构建整个页面首屏 data（Page({ data: 这里的 data })
 * 策略：
 *   1. 省份 → 取第一个省份作为初始省份（以后用户可以切换）
 *   2. 主项 → 取该省默认主项（default:true 或第一项）
 *   3. 专项/辅助 → 取第一个大类 → 构建第一个分组
 * 所有默认值全部由规则层决定，页面层不用自己拼 data，保证数据源单一
 * @returns {Object} 页面初始 data 对象（Page 构造用）
 */
function createInitialPageData() {
  const provinceMeta = buildProvinceList();
  const firstProvinceKey = provinceMeta.provinceKeys[0] || '';

  // 初始主项数据
  const initialMainProjects = getEnabledProjects(firstProvinceKey, 'mainProject');
  const initialSpecialProjects = getEnabledProjects(firstProvinceKey, 'specialProject');
  const initialAuxiliaryProjects = getEnabledProjects(firstProvinceKey, 'auxiliaryProject');

  const mainTypeKeys = initialMainProjects.map((item) => item.code);
  const mainTypeList = buildTypeList(firstProvinceKey, 'mainProject', initialMainProjects);
  const defaultMainCode = getDefaultMainCode(firstProvinceKey);
  const mainTypeIndex = clampIndex(mainTypeKeys.indexOf(defaultMainCode), mainTypeKeys.length || 1);
  const initialMainKey = mainTypeKeys[mainTypeIndex] || '';
  const initialMainProjectState = buildMainProjectState(firstProvinceKey, initialMainKey);

  // 初始专项分组
  const specialTypeKeys = initialSpecialProjects.map((item) => item.code);
  const specialTypeList = buildTypeList(firstProvinceKey, 'specialProject', initialSpecialProjects);
  const initialSpecialGroup = specialTypeKeys.length
    ? buildProjectGroup(firstProvinceKey, 'specialProject', specialTypeKeys[0])
    : createEmptyProjectGroup('specialProject');

  // 初始辅助分组
  const auxiliaryTypeKeys = initialAuxiliaryProjects.map((item) => item.code);
  const auxiliaryTypeList = buildTypeList(firstProvinceKey, 'auxiliaryProject', initialAuxiliaryProjects);
  const initialAuxiliaryGroup = auxiliaryTypeKeys.length
    ? buildProjectGroup(firstProvinceKey, 'auxiliaryProject', auxiliaryTypeKeys[0])
    : createEmptyProjectGroup('auxiliaryProject');

  return {
    provinceIndex: 0,                                        // 默认选中第一个省份
    provinceList: provinceMeta.provinceList,
    provinceKeys: provinceMeta.provinceKeys,
    genderIndex: 0,                                            // 默认男
    genderList: ['男', '女'],
    mainTypeIndex,                                            // 默认主项下标
    showMainTypePicker: mainTypeKeys.length > 1,              // 主项>1才显示选择器
    mainTypeList,
    mainTypeKeys,
    mainSubList: initialMainProjectState.mainSubList,
    mainChooseGroups: initialMainProjectState.mainChooseGroups,
    mainScores: {},                                           // 主项成绩输入值字典
    specialTypeKeys,
    specialTypeList,
    specialTypeIndex: 0,
    specialGroup: initialSpecialGroup,
    auxiliaryEnabled: auxiliaryTypeKeys.length > 0,               // 辅助项目>0才显示辅助区
    auxiliaryTypeKeys,
    auxiliaryTypeList,
    auxiliaryTypeIndex: 0,
    auxiliaryGroup: initialAuxiliaryGroup,
    timePickerRange: [TIME_MINUTE_OPTIONS, TIME_SECOND_OPTIONS, TIME_MILLISECOND_OPTIONS], // 页面全局默认picker范围（wxml全局用）
    submitting: false                                         // 提交锁（防止重复点击）
  };
}

/* ============================================================
 * 模块导出（暴露给交互层 / 提交层的 API
 * ============================================================ */
module.exports = {
  // 作用域字段映射表（交互层 _getScopeMap 用）
  SCOPE_DATA_KEY_MAP,

  // 编码日志构建（提交层打印调试编码）
  buildMainCodeLog,
  buildSpecialCodeLog,

  // 编码构建（提交层组装提交数据的编码）
  buildMainItemCode,
  buildSpecialItemCode,

  // 主项状态构建
  buildMainProjectState,
  getMainActiveItems,

  // 专项/辅助分组构建（交互层切换的核心函数）
  buildProjectGroup,

  // 列表构建（省份/作用域项目显示列表）
  buildTypeList,

  // 下标越界保护（交互层 clamp）
  clampIndex,
  clampTimePickerValue,

  // 规则元深拷贝（提交层传云函数前）
  cloneRuleMeta,

  // 空分组兜底工厂
  createEmptyProjectGroup,

  // 页面首屏 data 构建
  createInitialPageData,

  // 时间格式化（交互层 picker 变化后）
  formatTimeDisplay,
  formatTimeValue,

  // 获取当前技能快照（提交层读取当前选中的技能）
  getCurrentSkillItem,

  // 主项/辅助默认编码
  getDefaultMainCode,
  getEnabledProjects,

  // 规则读取（提交层重新查规则）
  getItemRule,
  getProvinceRuleMeta,
  getTypeRule,

  // 结构判断（提交层区分TopSkill分支）
  hasTopLevelSkills,

  // 输入值标准化（提交层校验数字/时间）
  normalizeComparableValue
};
