// pages/tool/tool_f/tool_f.js
const RULES = require('./rule2/rules.js');
const PROVINCE_MAP = require('./rule2/provinceMap.js');

const TIME_MINUTE_OPTIONS = Array.from({ length: 10 }, (_, index) => String(index).padStart(2, '0'));
const TIME_SECOND_OPTIONS = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));
const TIME_MILLISECOND_OPTIONS = Array.from({ length: 100 }, (_, index) => String(index).padStart(2, '0'));

// 同步构建初始数据
function buildProvinceList() {
  const keys = Object.keys(PROVINCE_MAP);
  return {
    provinceKeys: keys,
    provinceList: keys.map(k => PROVINCE_MAP[k].name)
  };
}
function getEnabledProjects(provinceKey) {
  const cfg = PROVINCE_MAP[provinceKey];
  return {
    mainProjects: cfg.mainProject.filter(p => p.enabled).sort((a, b) => a.order - b.order),
    specialProjects: cfg.specialProject.filter(p => p.enabled).sort((a, b) => a.order - b.order)
  };
}
function getDefaultMainCode(provinceKey) {
  const cfg = PROVINCE_MAP[provinceKey];
  const def = cfg.mainProject.find(p => p.enabled && p.default);
  if (def) return def.code;
  const list = cfg.mainProject.filter(p => p.enabled).sort((a, b) => a.order - b.order);
  return list.length > 0 ? list[0].code : null;
}
function buildMainSubList(typeKey) {
  const items = RULES.mainProject[typeKey].items;
  return Object.keys(items).map(code => ({ code, name: items[code].name, unit: items[code].unit }));
}
function buildSpecialSubList(typeKey) {
  const rule = RULES.specialProject[typeKey];
  const items = rule.items;
  // 3c 等类型：skills 在顶层，没有 items 包装
  if (!items) {
    return [];
  }
  return Object.keys(items).map(code => {
    const item = items[code];
    return { code, name: item.name || item, unit: item.unit || '', hasSkill: !!item.skills };
  });
}

function getSkillInputCount(skill) {
  const count = skill && skill.parallel ? parseInt(skill.parallel_num, 10) : 1;
  return Number.isInteger(count) && count > 1 ? count : 1;
}

function getChooseCount(rule) {
  const count = parseInt(rule && rule.choose, 10);
  return Number.isInteger(count) && count > 0 ? count : 0;
}

function useMinuteSecondTime(rule) {
  return !!(rule && rule['Seconds and minutes']);
}

function formatTimeValue(pickerValue) {
  const value = Array.isArray(pickerValue) ? pickerValue : [0, 0, 0];
  const minute = TIME_MINUTE_OPTIONS[value[0]] || TIME_MINUTE_OPTIONS[0];
  const second = TIME_SECOND_OPTIONS[value[1]] || TIME_SECOND_OPTIONS[0];
  const millisecond = TIME_MILLISECOND_OPTIONS[value[2]] || TIME_MILLISECOND_OPTIONS[0];
  return minute + ':' + second + '.' + millisecond;
}

function formatTimeDisplay(pickerValue) {
  const value = Array.isArray(pickerValue) ? pickerValue : [0, 0, 0];
  const minute = TIME_MINUTE_OPTIONS[value[0]] || TIME_MINUTE_OPTIONS[0];
  const second = TIME_SECOND_OPTIONS[value[1]] || TIME_SECOND_OPTIONS[0];
  const millisecond = TIME_MILLISECOND_OPTIONS[value[2]] || TIME_MILLISECOND_OPTIONS[0];
  return minute + '分 ' + second + '秒 ' + millisecond + '毫秒';
}

function normalizeComparableValue(raw) {
  if (raw === undefined || raw === null) return NaN;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;

  const text = String(raw).trim();
  if (!text) return NaN;

  const cleaned = text
    .replace(/[<>=≤≥]/g, '')
    .replace(/\s+/g, '');

  if (!cleaned) return NaN;

  if (cleaned.includes(':')) {
    const parts = cleaned.split(':').map(part => parseFloat(part));
    if (parts.some(part => Number.isNaN(part))) return NaN;
    return parts.reduce((total, part) => total * 60 + part, 0);
  }

  const numeric = parseFloat(cleaned);
  return Number.isNaN(numeric) ? NaN : numeric;
}

function getSkillInputLabels(skill) {
  const count = getSkillInputCount(skill);
  const name = skill && skill.name ? String(skill.name) : '输入';
  if (count === 1) return [name];

  const parts = name
    .split(/[,\uff0c\/、]/)
    .map(item => item.trim())
    .filter(Boolean);

  if (parts.length >= count) {
    return parts.slice(0, count);
  }

  return Array.from({ length: count }, (_, index) => name + (index + 1));
}

function buildSkillItems(skills, options) {
  const opts = options || {};
  const skillKeys = Object.keys(skills || {});
  const skillItems = skillKeys.map(code => {
    const skill = skills[code] || {};
    const inputCount = getSkillInputCount(skill);
    const inputLabels = getSkillInputLabels(skill);
    const isTimePicker = !!opts.useMinuteSecondTime && inputCount === 1;
    return {
      code,
      name: skill.name || '',
      unit: skill.unit || '',
      inputCount,
      inputLabels,
      isTimePicker,
      timePickerValue: [0, 0, 0],
      timeDisplay: '',
      allowNegative: skill.number === 'Positive or negative',
      values: Array.from({ length: inputCount }, () => '')
    };
  });

  return {
    skillKeys,
    skillList: skillItems.map(item => item.name),
    skillUnits: skillItems.map(item => item.unit),
    skillItems
  };
}

function getCurrentSkillItem(group) {
  const skillItems = (group && group.skillItems) || [];
  const skillIndex = parseInt(group && group.skillIndex, 10);
  if (!skillItems.length) return null;
  if (Number.isInteger(skillIndex) && skillItems[skillIndex]) return skillItems[skillIndex];
  return skillItems[0];
}

function getResolvedGenderCode(genderCode, itemRule, skillRule) {
  if (skillRule && skillRule.genderless) return 'o';
  if (itemRule && itemRule.genderless) return 'o';
  return genderCode;
}

function buildMainItemCode(provinceCode, genderCode, mainTypeKey, subCode) {
  return provinceCode + genderCode + mainTypeKey + subCode;
}

function buildSpecialItemCode(provinceCode, genderCode, specialTypeKey, subCode, itemRule, skillCode, skillRule) {
  const resolvedGenderCode = getResolvedGenderCode(genderCode, itemRule, skillRule);
  return provinceCode + resolvedGenderCode + specialTypeKey + subCode + (skillCode || '');
}

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

function buildSpecialCodeLog(provinceCode, genderCode, specialTypeKey, subCode, itemRule, skillCode, skillRule, code) {
  return {
    scope: 'special',
    provinceCode,
    inputGenderCode: genderCode,
    resolvedGenderCode: getResolvedGenderCode(genderCode, itemRule, skillRule),
    typeKey: specialTypeKey,
    subCode,
    skillCode: skillCode || '',
    genderlessFromItem: !!(itemRule && itemRule.genderless),
    genderlessFromSkill: !!(skillRule && skillRule.genderless),
    code
  };
}

const { provinceKeys, provinceList } = buildProvinceList();
const firstProvinceKey = provinceKeys[0];
const { mainProjects, specialProjects } = getEnabledProjects(firstProvinceKey);
const mainTypeKeys = mainProjects.map(p => p.code);
const mainTypeList = mainTypeKeys.map(k => RULES.mainProject[k].label);
const defaultMainCode = getDefaultMainCode(firstProvinceKey);
const mainTypeIndex = Math.max(0, mainTypeKeys.indexOf(defaultMainCode));
const initialMainKey = mainTypeKeys[mainTypeIndex];

const specialTypeKeys = specialProjects.map(p => p.code);
const specialTypeList = specialTypeKeys.map(k => RULES.specialProject[k].label);

// 判断专项类型是否有顶层 skills（如 3c 健美操、啦啦操）
function hasTopLevelSkills(typeKey) {
  const rule = RULES.specialProject[typeKey];
  return !!(rule && rule.skills && !rule.items);
}

// 构建单个专项类型的显示数据
function buildSpecialGroup(typeKey) {
  const rule = RULES.specialProject[typeKey];
  const isTopSkill = hasTopLevelSkills(typeKey);
  let subList, subNames, firstSub, hasSkill, skillKeys, skillList, skillUnits, skillItems, currentUnit, currentSubName, skillChooseCount, useSkillPicker, skillIndex, currentSkillItem;

  if (isTopSkill) {
    // 3c 等：skills 在顶层，没有 items/subList
    subList = [];
    subNames = [];
    firstSub = null;
    hasSkill = true;
    skillChooseCount = getChooseCount(rule);
    useSkillPicker = skillChooseCount === 1;
    skillIndex = 0;
    const skillMeta = buildSkillItems(rule.skills, { useMinuteSecondTime: useMinuteSecondTime(rule) });
    skillKeys = skillMeta.skillKeys;
    skillList = skillMeta.skillList;
    skillUnits = skillMeta.skillUnits;
    skillItems = skillMeta.skillItems;
    currentSkillItem = skillItems[0] || null;
    currentUnit = currentSkillItem ? currentSkillItem.unit : '';
    currentSubName = '';
  } else {
    subList = buildSpecialSubList(typeKey);
    subNames = subList.map(s => s.name);
    firstSub = subList[0];
    hasSkill = firstSub && firstSub.hasSkill;
    skillChooseCount = 0;
    useSkillPicker = false;
    skillIndex = 0;
    skillKeys = [];
    skillList = [];
    skillUnits = [];
    skillItems = [];
    currentSkillItem = null;
    currentUnit = firstSub ? firstSub.unit : '';
    currentSubName = firstSub ? firstSub.name : '';
    if (hasSkill) {
      const itemRule = rule.items[firstSub.code] || {};
      const skills = itemRule.skills;
      skillChooseCount = getChooseCount(itemRule);
      useSkillPicker = skillChooseCount === 1;
      const skillMeta = buildSkillItems(skills, { useMinuteSecondTime: useMinuteSecondTime(itemRule) });
      skillKeys = skillMeta.skillKeys;
      skillList = skillMeta.skillList;
      skillUnits = skillMeta.skillUnits;
      skillItems = skillMeta.skillItems;
      currentSkillItem = skillItems[0] || null;
      currentUnit = currentSkillItem ? currentSkillItem.unit : '';
    }
  }
  return {
    typeKey,
    typeLabel: rule.label,
    subList,
    subNames,
    subIndex: 0,
    currentSubName,
    currentUnit,
    score: '',
    hasSkill,
    showSkill: hasSkill,
    skillKeys,
    skillList,
    skillUnits,
    skillItems,
    skillChooseCount,
    useSkillPicker,
    skillIndex,
    currentSkillItem
  };
}

const initialMainSubList = buildMainSubList(initialMainKey);
const initialSpecialTypeIndex = 0;
const initialSpecialGroup = buildSpecialGroup(specialTypeKeys[initialSpecialTypeIndex] || '');

Page({
  data: {
    provinceIndex: 0,
    provinceList,
    provinceKeys,

    genderIndex: 0,
    genderList: ['男', '女'],

    mainTypeIndex,
    mainTypeList,
    mainTypeKeys,

    mainSubList: initialMainSubList,
    mainScores: {},

    specialTypeKeys,
    specialTypeList,
    specialTypeIndex: initialSpecialTypeIndex,
    timePickerRange: [TIME_MINUTE_OPTIONS, TIME_SECOND_OPTIONS, TIME_MILLISECOND_OPTIONS],

    specialGroup: initialSpecialGroup,

    submitting: false
  },

  onLoad() {
    console.log('[tool_f] onLoad, data keys:', Object.keys(this.data));
    console.log('[tool_f] provinceList:', this.data.provinceList);
    console.log('[tool_f] mainTypeList:', this.data.mainTypeList);
    console.log('[tool_f] specialGroup:', this.data.specialGroup);
    console.log('[tool_f] specialTypeList:', this.data.specialTypeList);
  },

  // ========== 省份 ==========
  onProvinceChange(e) {
    console.log('[tool_f] onProvinceChange:', e.detail.value);
    const idx = parseInt(e.detail.value);
    const provinceKey = this.data.provinceKeys[idx];
    console.log('[tool_f] switching to:', provinceKey, PROVINCE_MAP[provinceKey].name);
    this.loadProvinceOptions(provinceKey);
  },

  loadProvinceOptions(provinceKey) {
    const { mainProjects, specialProjects } = getEnabledProjects(provinceKey);
    const newMainTypeKeys = mainProjects.map(p => p.code);
    const newMainTypeList = newMainTypeKeys.map(k => RULES.mainProject[k].label);
    const newSpecialTypeKeys = specialProjects.map(p => p.code);
    const newSpecialTypeList = newSpecialTypeKeys.map(k => RULES.specialProject[k].label);

    const defMainCode = getDefaultMainCode(provinceKey);
    const newMainTypeIndex = Math.max(0, newMainTypeKeys.indexOf(defMainCode));
    const defaultMainKey = newMainTypeKeys[newMainTypeIndex];

    const newMainSubList = buildMainSubList(defaultMainKey);
    const newSpecialGroup = buildSpecialGroup(newSpecialTypeKeys[0] || '');

    this.setData({
      provinceIndex: this.data.provinceKeys.indexOf(provinceKey),
      mainTypeKeys: newMainTypeKeys,
      mainTypeList: newMainTypeList,
      mainTypeIndex: newMainTypeIndex,
      mainScores: {},
      mainSubList: newMainSubList,
      specialTypeKeys: newSpecialTypeKeys,
      specialTypeList: newSpecialTypeList,
      specialTypeIndex: 0,
      specialGroup: newSpecialGroup
    });
  },

  // ========== 性别 ==========
  onGenderChange(e) {
    console.log('[tool_f] onGenderChange:', e.detail.value);
    this.setData({ genderIndex: parseInt(e.detail.value) });
  },

  // ========== 基本素质 ==========
  onMainTypeChange(e) {
    console.log('[tool_f] onMainTypeChange:', e.detail.value);
    const idx = parseInt(e.detail.value);
    const typeKey = this.data.mainTypeKeys[idx];
    this.setData({
      mainTypeIndex: idx,
      mainScores: {},
      mainSubList: buildMainSubList(typeKey)
    });
  },

  onMainScoreInput(e) {
    const code = e.currentTarget.dataset.code;
    this.setData({ ['mainScores.' + code]: e.detail.value });
  },

  // ========== 专项（二选一 + 动态显示）==========
  onSpecialTypeChange(e) {
    console.log('[tool_f] onSpecialTypeChange:', e.detail.value);
    const idx = parseInt(e.detail.value);
    this.setSpecialTypeByIndex(idx);
  },

  onSpecialTypeTap(e) {
    const idx = parseInt(e.currentTarget.dataset.index, 10);
    this.setSpecialTypeByIndex(idx);
  },

  setSpecialTypeByIndex(idx) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= this.data.specialTypeKeys.length) return;
    const typeKey = this.data.specialTypeKeys[idx];
    const newSpecialGroup = buildSpecialGroup(typeKey);
    this.setData({
      specialTypeIndex: idx,
      specialGroup: newSpecialGroup
    });
  },

  onSpecialSubChange(e) {
    console.log('[tool_f] onSpecialSubChange:', e.detail.value);
    const idx = parseInt(e.detail.value);
    this.setSpecialSubByIndex(idx);
  },

  onSpecialSubTap(e) {
    const idx = parseInt(e.currentTarget.dataset.index, 10);
    this.setSpecialSubByIndex(idx);
  },

  setSpecialSubByIndex(idx) {
    if (!Number.isInteger(idx) || idx < 0) return;
    const group = this.data.specialGroup;
    const isTopSkill = hasTopLevelSkills(group.typeKey);
    // 3c 等顶层 skills 类型：没有 subList，无需处理子项切换
    if (isTopSkill) return;
    if (!group.subList[idx]) return;

    const sub = group.subList[idx];
    const typeKey = group.typeKey;
    const hasSkill = sub && sub.hasSkill;
    let skillKeys = [], skillList = [], skillUnits = [], skillItems = [], currentUnit = sub ? sub.unit : '', skillChooseCount = 0, useSkillPicker = false, currentSkillItem = null;
    if (hasSkill) {
      const itemRule = RULES.specialProject[typeKey].items[sub.code] || {};
      const skills = itemRule.skills;
      skillChooseCount = getChooseCount(itemRule);
      useSkillPicker = skillChooseCount === 1;
      const skillMeta = buildSkillItems(skills, { useMinuteSecondTime: useMinuteSecondTime(itemRule) });
      skillKeys = skillMeta.skillKeys;
      skillList = skillMeta.skillList;
      skillUnits = skillMeta.skillUnits;
      skillItems = skillMeta.skillItems;
      currentSkillItem = skillItems[0] || null;
      currentUnit = currentSkillItem ? currentSkillItem.unit : '';
    }
    const updatedGroup = Object.assign({}, group, {
      subIndex: idx,
      score: '',
      currentSubName: sub ? sub.name : '',
      currentUnit,
      hasSkill,
      showSkill: hasSkill,
      skillKeys,
      skillList,
      skillUnits,
      skillItems,
      skillChooseCount,
      useSkillPicker,
      skillIndex: 0,
      currentSkillItem
    });
    this.setData({ specialGroup: updatedGroup });
  },

  onSkillChange(e) {
    const skillIndex = parseInt(e.detail.value, 10) || 0;
    const currentSkillItem = this.data.specialGroup.skillItems[skillIndex] || null;
    this.setData({
      ['specialGroup.skillIndex']: skillIndex,
      ['specialGroup.currentSkillItem']: currentSkillItem,
      ['specialGroup.currentUnit']: currentSkillItem ? currentSkillItem.unit : ''
    });
  },

  onSkillScoreInput(e) {
    const skillIndex = e.currentTarget.dataset.ski;
    const inputIndex = e.currentTarget.dataset.inputIndex || 0;
    const updates = {
      ['specialGroup.skillItems[' + skillIndex + '].values[' + inputIndex + ']']: e.detail.value
    };
    if (parseInt(this.data.specialGroup.skillIndex, 10) === parseInt(skillIndex, 10)) {
      updates['specialGroup.currentSkillItem.values[' + inputIndex + ']'] = e.detail.value;
    }
    this.setData(updates);
  },

  onTimePickerChange(e) {
    const skillIndex = parseInt(e.currentTarget.dataset.ski, 10) || 0;
    const pickerValue = e.detail.value || [0, 0, 0];
    const timeValue = formatTimeValue(pickerValue);
    const timeDisplay = formatTimeDisplay(pickerValue);
    const updates = {
      ['specialGroup.skillItems[' + skillIndex + '].timePickerValue']: pickerValue,
      ['specialGroup.skillItems[' + skillIndex + '].timeDisplay']: timeDisplay,
      ['specialGroup.skillItems[' + skillIndex + '].values[0]']: timeValue
    };

    if (parseInt(this.data.specialGroup.skillIndex, 10) === skillIndex) {
      updates['specialGroup.currentSkillItem.timePickerValue'] = pickerValue;
      updates['specialGroup.currentSkillItem.timeDisplay'] = timeDisplay;
      updates['specialGroup.currentSkillItem.values[0]'] = timeValue;
    }

    this.setData(updates);
  },

  onSpecialScoreInput(e) {
    this.setData({
      ['specialGroup.score']: e.detail.value
    });
  },

  // ========== 验证 & 提交 ==========
  _safeTrim(val) {
    return (val !== undefined && val !== null) ? String(val).trim() : '';
  },

  _getSkillSubmitEntries(skillItem) {
    const values = (skillItem && skillItem.values) || [];
    const inputLabels = (skillItem && skillItem.inputLabels) || [];

    return values
      .map((rawValue, index) => ({
        label: inputLabels[index] || skillItem.name,
        value: this._safeTrim(rawValue)
      }))
      .filter(item => !!item.value);
  },

  validate() {
    const { mainScores, mainSubList, specialGroup } = this.data;
    for (const sub of mainSubList) {
      const val = this._safeTrim(mainScores[sub.code]);
      if (val && isNaN(Number(val))) {
        wx.showToast({ title: sub.name + '成绩必须为数字', icon: 'none' });
        return false;
      }
    }
    // 专项验证
    if (specialGroup.showSkill) {
      const currentSkillItem = getCurrentSkillItem(specialGroup);
      const skillItems = specialGroup.useSkillPicker
        ? (currentSkillItem ? [currentSkillItem] : [])
        : (specialGroup.skillItems || []);
      for (let ski = 0; ski < skillItems.length; ski++) {
        const skillItem = skillItems[ski];
        const inputLabels = skillItem.inputLabels || [skillItem.name];
        const values = skillItem.values || [];
        for (let inputIndex = 0; inputIndex < values.length; inputIndex++) {
          const val = this._safeTrim(values[inputIndex]);
          const isValid = skillItem.isTimePicker ? Number.isFinite(normalizeComparableValue(val)) : !isNaN(Number(val));
          if (val && !isValid) {
            const label = inputLabels[inputIndex] || skillItem.name;
            wx.showToast({ title: skillItem.isTimePicker ? (label + '时间格式无效') : (label + '成绩必须为数字'), icon: 'none' });
            return false;
          }
        }
      }
    } else {
      const val = this._safeTrim(specialGroup.score);
      if (val && isNaN(Number(val))) {
        wx.showToast({ title: specialGroup.currentSubName + '成绩必须为数字', icon: 'none' });
        return false;
      }
    }
    const hasMain = mainSubList.some(sub => this._safeTrim(mainScores[sub.code]));
    let hasSpecial = false;
    if (specialGroup.showSkill) {
      const currentSkillItem = getCurrentSkillItem(specialGroup);
      const skillItems = specialGroup.useSkillPicker
        ? (currentSkillItem ? [currentSkillItem] : [])
        : (specialGroup.skillItems || []);
      hasSpecial = skillItems.some(skillItem => this._getSkillSubmitEntries(skillItem).length > 0);
    } else {
      hasSpecial = !!this._safeTrim(specialGroup.score);
    }
    if (!hasMain && !hasSpecial) {
      wx.showToast({ title: '请至少填写一项成绩', icon: 'none' });
      return false;
    }
    return true;
  },

  submitForm() {
    console.log('[tool_f] submitForm');
    if (!this.validate()) return;
    if (this.data.submitting) return;

    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中...' });

    const { provinceList, provinceIndex, provinceKeys, genderList, genderIndex, mainTypeList, mainTypeIndex, mainTypeKeys, mainSubList, mainScores, specialGroup, specialTypeKeys, specialTypeList, specialTypeIndex } = this.data;

    const provinceCode = provinceKeys[provinceIndex];
    const genderCode = genderIndex === 0 ? 'm' : 'f';
    const mainTypeKey = mainTypeKeys[mainTypeIndex];

    // 调试日志：打印 specialGroup 关键字段
    console.log('[submitForm] specialGroup:', JSON.stringify({
      typeKey: specialGroup.typeKey,
      subIndex: specialGroup.subIndex,
      subCode: specialGroup.subList[specialGroup.subIndex] && specialGroup.subList[specialGroup.subIndex].code,
      showSkill: specialGroup.showSkill,
      skillKeys: specialGroup.skillKeys,
      skillItems: specialGroup.skillItems,
      score: specialGroup.score
    }));

    // ========== 构建基本数字提交数据 ==========
    const mainData = mainSubList
      .filter(sub => this._safeTrim(mainScores[sub.code]))
      .map(sub => {
        const itemRule = RULES.mainProject[mainTypeKey].items[sub.code] || {};
        const value = this._safeTrim(mainScores[sub.code]);
        const code = buildMainItemCode(provinceCode, genderCode, mainTypeKey, sub.code);
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

    // ========== 构建专项提交数据 ==========
    const specialDataList = [];
    const isTopSkill = hasTopLevelSkills(specialGroup.typeKey);

    if (isTopSkill) {
      // 3c 等：skills 在顶层，没有 items/sub
      const rule = RULES.specialProject[specialGroup.typeKey];
      const skills = rule.skills;
      const currentSkillItem = getCurrentSkillItem(specialGroup);
      const skillItems = specialGroup.useSkillPicker
        ? (currentSkillItem ? [currentSkillItem] : [])
        : (specialGroup.skillItems || []);
      skillItems.forEach((skillItem) => {
        const skillInfo = skills[skillItem.code];
        if (!skillInfo) {
          console.error('[submitForm] 缺少技能配置:', skillItem.code);
          return;
        }
        const entries = this._getSkillSubmitEntries(skillItem);
        const itemCode = buildSpecialItemCode(
          provinceCode,
          genderCode,
          specialGroup.typeKey,
          '',           // 3c 无 subCode
          {},           // 无 itemRule
          skillItem.code,
          skillInfo
        );
        console.log('[code-special-top-skill]', JSON.stringify(buildSpecialCodeLog(
          provinceCode,
          genderCode,
          specialGroup.typeKey,
          '',
          {},
          skillItem.code,
          skillInfo,
          itemCode
        )));
        entries.forEach((entry) => {
          specialDataList.push({
            code: itemCode,
            typeKey: specialGroup.typeKey,
            typeLabel: specialGroup.typeLabel,
            name: entry.label,
            unit: skillInfo.unit,
            value: entry.value,
            better: skillInfo.better || '',
            match: skillInfo.match || '',
            rule: skillInfo.rule !== undefined ? skillInfo.rule : ''
          });
        });
      });
    } else {
      const sub = specialGroup.subList[specialGroup.subIndex];
      if (!sub) {
        wx.hideLoading();
        this.setData({ submitting: false });
        wx.showToast({ title: '专项数据异常', icon: 'none' });
        return;
      }

      if (specialGroup.showSkill && specialGroup.skillKeys.length > 0) {
        // choose=1 时只提交当前选中的技能；未配置 choose 时提交全部技能
        const itemRule = RULES.specialProject[specialGroup.typeKey].items[sub.code] || {};
        const skills = itemRule.skills;
        if (!skills) {
          console.error('[submitForm] 排球子项缺少 skills 配置:', specialGroup.typeKey, sub.code);
        } else {
          const currentSkillItem = getCurrentSkillItem(specialGroup);
          const skillItems = specialGroup.useSkillPicker
            ? (currentSkillItem ? [currentSkillItem] : [])
            : (specialGroup.skillItems || []);
          skillItems.forEach((skillItem) => {
            const skillInfo = skills[skillItem.code];
            if (!skillInfo) {
              console.error('[submitForm] 缺少技能配置:', skillItem.code);
              return;
            }

            const entries = this._getSkillSubmitEntries(skillItem);
            const itemCode = buildSpecialItemCode(
              provinceCode,
              genderCode,
              specialGroup.typeKey,
              sub.code,
              itemRule,
              skillItem.code,
              skillInfo
            );
            console.log('[code-special]', JSON.stringify(buildSpecialCodeLog(
              provinceCode,
              genderCode,
              specialGroup.typeKey,
              sub.code,
              itemRule,
              skillItem.code,
              skillInfo,
              itemCode
            )));
            entries.forEach((entry) => {
              specialDataList.push({
                code: itemCode,
                typeKey: specialGroup.typeKey,
                typeLabel: specialGroup.typeLabel,
                name: sub.name + '-' + entry.label,
                unit: skillInfo.unit,
                value: entry.value,
                better: skillInfo.better || '',
                match: skillInfo.match || '',
                rule: skillInfo.rule !== undefined ? skillInfo.rule : ''
              });
            });
          });
        }
      } else {
        // 非排球：单条记录
        const rawScore = specialGroup.score;
        const scoreVal = (rawScore !== undefined && rawScore !== null) ? String(rawScore).trim() : '';
        if (scoreVal) {
          const itemRule = RULES.specialProject[specialGroup.typeKey].items[sub.code] || {};
          const code = buildSpecialItemCode(
            provinceCode,
            genderCode,
            specialGroup.typeKey,
            sub.code,
            itemRule
          );
          console.log('[code-special]', JSON.stringify(buildSpecialCodeLog(
            provinceCode,
            genderCode,
            specialGroup.typeKey,
            sub.code,
            itemRule,
            '',
            null,
            code
          )));
          specialDataList.push({
            code,
            typeKey: specialGroup.typeKey,
            typeLabel: specialGroup.typeLabel,
            name: sub.name,
            unit: sub.unit,
            value: scoreVal,
            better: itemRule.better || '',
            match: itemRule.match || '',
            rule: itemRule.rule !== undefined ? itemRule.rule : ''
          });
        }
      }
    }

    // ========== 组装调用参数 ==========
    const callData = {
      province: provinceList[provinceIndex],
      provinceCode,
      gender: genderList[genderIndex],
      genderCode,
      mainType: mainTypeList[mainTypeIndex],
      mainTypeKey,
      mainData,
      specialType: specialTypeList[specialTypeIndex],
      specialTypeKey: specialTypeKeys[specialTypeIndex],
      specialDataList
    };
    console.log('[code-summary]', JSON.stringify({
      mainCodes: mainData.map(item => ({ name: item.name, code: item.code, value: item.value })),
      specialCodes: specialDataList.map(item => ({ name: item.name, code: item.code, value: item.value }))
    }, null, 2));
    console.log('========== [前端] 调用云函数传入数据 ==========');
    console.log(JSON.stringify(callData, null, 2));
    console.log('================================================');

    // ========== 构建跳转用的展示信息 ==========
    const displayInfo = {
      province: provinceList[provinceIndex],
      gender: genderList[genderIndex],
      mainType: mainTypeList[mainTypeIndex],
      specialType: specialGroup.typeLabel
    };

    wx.cloud.callFunction({
      name: 'sport_tool_fun1',
      data: callData,
      success: (res) => {
        wx.hideLoading();
        this.setData({ submitting: false });
        if (res.result && res.result.success) {
          const scoreData = Object.assign({}, displayInfo, {
            totalScore: res.result.score.totalScore,
            mainScores: res.result.score.mainScores,
            specialScores: res.result.score.specialScores || [],
            aiFallback: res.result.score.aiFallback || null
          });
          wx.navigateTo({
            url: '/pages/tool/tool_f/tool_f_detailed/tool_f_detailed',
            success: (navRes) => {
              navRes.eventChannel.emit('scoreResult', scoreData);
            }
          });
        } else {
          wx.showToast({ title: (res.result && res.result.message) || '提交失败', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        this.setData({ submitting: false });
        wx.showToast({ title: '网络错误，请重试', icon: 'none' });
        console.error('云函数调用失败:', err);
      }
    });
  },

  // ========== 重置 ==========
  resetForm() {
    const provinceKey = this.data.provinceKeys[0];
    this.setData({
      provinceIndex: 0,
      genderIndex: 0
    });
    this.loadProvinceOptions(provinceKey);
  }
});
