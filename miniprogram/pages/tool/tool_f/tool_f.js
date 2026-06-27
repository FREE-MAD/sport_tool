// pages/tool/tool_f/tool_f.js
const RULES = require('./rule2/rules.js');
const PROVINCE_MAP = require('./rule2/provinceMap.js');

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
  const items = RULES.specialProject[typeKey].items;
  return Object.keys(items).map(code => {
    const item = items[code];
    return { code, name: item.name || item, unit: item.unit || '', hasSkill: !!item.skills };
  });
}

const { provinceKeys, provinceList } = buildProvinceList();
const firstProvinceKey = provinceKeys[0];
const { mainProjects, specialProjects } = getEnabledProjects(firstProvinceKey);
const mainTypeKeys = mainProjects.map(p => p.code);
const mainTypeList = mainTypeKeys.map(k => RULES.mainProject[k].label + '(' + k + ')');
const defaultMainCode = getDefaultMainCode(firstProvinceKey);
const mainTypeIndex = Math.max(0, mainTypeKeys.indexOf(defaultMainCode));
const initialMainKey = mainTypeKeys[mainTypeIndex];

const specialTypeKeys = specialProjects.map(p => p.code);
const specialTypeList = specialTypeKeys.map(k => RULES.specialProject[k].label + '(' + k + ')');
const initialSpecialKey = specialTypeKeys[0];

const initialMainSubList = buildMainSubList(initialMainKey);
const initialSpecialSubList = buildSpecialSubList(initialSpecialKey);
const initialSpecialSubNames = initialSpecialSubList.map(s => s.name);
const firstSpecial = initialSpecialSubList[0];
const initialShowVolley = firstSpecial && firstSpecial.hasSkill;
let initialVolleyList = [], initialVolleyKeys = [], initialSpecialUnit = firstSpecial ? firstSpecial.unit : '';
if (initialShowVolley) {
  const skills = RULES.specialProject[initialSpecialKey].items[firstSpecial.code].skills;
  initialVolleyKeys = Object.keys(skills);
  initialVolleyList = initialVolleyKeys.map(code => skills[code].name);
  initialSpecialUnit = skills[initialVolleyKeys[0]].unit;
}

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

    specialTypeIndex: 0,
    specialTypeList,
    specialTypeKeys,

    specialSubList: initialSpecialSubList,
    specialSubNames: initialSpecialSubNames,
    specialSubIndex: 0,
    specialSubUnit: initialSpecialUnit,

    showVolleyballSkill: initialShowVolley,
    volleyballSkillList: initialVolleyList,
    volleyballSkillKeys: initialVolleyKeys,
    volleyballSkillIndex: 0,

    specialScore: '',
    submitting: false
  },

  onLoad() {
    console.log('[tool_f] onLoad, data keys:', Object.keys(this.data));
    console.log('[tool_f] provinceList:', this.data.provinceList);
    console.log('[tool_f] mainTypeList:', this.data.mainTypeList);
    console.log('[tool_f] specialTypeList:', this.data.specialTypeList);
    console.log('[tool_f] specialSubNames:', this.data.specialSubNames);
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
    const newMainTypeList = newMainTypeKeys.map(k => RULES.mainProject[k].label + '(' + k + ')');
    const newSpecialTypeKeys = specialProjects.map(p => p.code);
    const newSpecialTypeList = newSpecialTypeKeys.map(k => RULES.specialProject[k].label + '(' + k + ')');

    const defMainCode = getDefaultMainCode(provinceKey);
    const newMainTypeIndex = Math.max(0, newMainTypeKeys.indexOf(defMainCode));
    const defaultMainKey = newMainTypeKeys[newMainTypeIndex];
    const defaultSpecialKey = newSpecialTypeKeys[0];

    const newMainSubList = buildMainSubList(defaultMainKey);
    const newSpecialSubList = buildSpecialSubList(defaultSpecialKey);
    const newSpecialSubNames = newSpecialSubList.map(s => s.name);

    const firstSp = newSpecialSubList[0];
    const showVolley = firstSp && firstSp.hasSkill;
    let volleyList = [], volleyKeys = [], subUnit = firstSp ? firstSp.unit : '';
    if (showVolley) {
      const skills = RULES.specialProject[defaultSpecialKey].items[firstSp.code].skills;
      volleyKeys = Object.keys(skills);
      volleyList = volleyKeys.map(code => skills[code].name);
      subUnit = skills[volleyKeys[0]].unit;
    }

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
      specialSubIndex: 0,
      specialScore: '',
      specialSubList: newSpecialSubList,
      specialSubNames: newSpecialSubNames,
      specialSubUnit: subUnit,
      showVolleyballSkill: showVolley,
      volleyballSkillList: volleyList,
      volleyballSkillKeys: volleyKeys,
      volleyballSkillIndex: 0
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

  // ========== 专项 ==========
  onSpecialTypeChange(e) {
    console.log('[tool_f] onSpecialTypeChange:', e.detail.value);
    const idx = parseInt(e.detail.value);
    const typeKey = this.data.specialTypeKeys[idx];
    const subList = buildSpecialSubList(typeKey);
    const subNames = subList.map(s => s.name);
    const firstSub = subList[0];
    const showVolley = firstSub && firstSub.hasSkill;
    let volleyList = [], volleyKeys = [], subUnit = firstSub ? firstSub.unit : '';
    if (showVolley) {
      const skills = RULES.specialProject[typeKey].items[firstSub.code].skills;
      volleyKeys = Object.keys(skills);
      volleyList = volleyKeys.map(code => skills[code].name);
      subUnit = skills[volleyKeys[0]].unit;
    }
    this.setData({
      specialTypeIndex: idx,
      specialSubIndex: 0,
      specialScore: '',
      specialSubList: subList,
      specialSubNames: subNames,
      specialSubUnit: subUnit,
      showVolleyballSkill: showVolley,
      volleyballSkillList: volleyList,
      volleyballSkillKeys: volleyKeys,
      volleyballSkillIndex: 0
    });
  },

  onSpecialSubChange(e) {
    console.log('[tool_f] onSpecialSubChange:', e.detail.value);
    const idx = parseInt(e.detail.value);
    const sub = this.data.specialSubList[idx];
    let subUnit = sub ? sub.unit : '';
    if (sub && sub.hasSkill) {
      const typeKey = this.data.specialTypeKeys[this.data.specialTypeIndex];
      const skills = RULES.specialProject[typeKey].items[sub.code].skills;
      const volleyKeys = Object.keys(skills);
      const volleyList = volleyKeys.map(code => skills[code].name);
      subUnit = skills[volleyKeys[0]].unit;
      this.setData({
        specialSubIndex: idx,
        specialScore: '',
        specialSubUnit: subUnit,
        showVolleyballSkill: true,
        volleyballSkillList: volleyList,
        volleyballSkillKeys: volleyKeys,
        volleyballSkillIndex: 0
      });
    } else {
      this.setData({
        specialSubIndex: idx,
        specialScore: '',
        specialSubUnit: subUnit,
        showVolleyballSkill: false,
        volleyballSkillList: [],
        volleyballSkillKeys: [],
        volleyballSkillIndex: 0
      });
    }
  },

  onVolleyballSkillChange(e) {
    console.log('[tool_f] onVolleyballSkillChange:', e.detail.value);
    const idx = parseInt(e.detail.value);
    const { specialTypeKeys, specialTypeIndex, specialSubList, specialSubIndex, volleyballSkillKeys } = this.data;
    const typeKey = specialTypeKeys[specialTypeIndex];
    const sub = specialSubList[specialSubIndex];
    const skills = RULES.specialProject[typeKey].items[sub.code].skills;
    const unit = skills[volleyballSkillKeys[idx]].unit;
    this.setData({
      volleyballSkillIndex: idx,
      specialSubUnit: unit
    });
  },

  onSpecialScoreInput(e) {
    this.setData({ specialScore: e.detail.value });
  },

  // ========== 验证 & 提交 ==========
  validate() {
    const { mainScores, mainSubList, specialScore } = this.data;
    for (const sub of mainSubList) {
      const val = mainScores[sub.code];
      if (val && val.trim() && isNaN(Number(val))) {
        wx.showToast({ title: sub.name + '成绩必须为数字', icon: 'none' });
        return false;
      }
    }
    if (specialScore && specialScore.trim() && isNaN(Number(specialScore))) {
      wx.showToast({ title: '专项成绩必须为数字', icon: 'none' });
      return false;
    }
    const hasMain = mainSubList.some(sub => mainScores[sub.code] && mainScores[sub.code].trim());
    const hasSpecial = specialScore && specialScore.trim();
    if (!hasMain && !hasSpecial) {
      wx.showToast({ title: '请至少填写一项成绩', icon: 'none' });
      return false;
    }
    return true;
  },

  buildCode() {
    const { provinceKeys, provinceIndex, genderIndex, mainTypeKeys, mainTypeIndex, specialTypeKeys, specialTypeIndex, specialSubList, specialSubIndex, showVolleyballSkill, volleyballSkillKeys, volleyballSkillIndex } = this.data;
    const provinceCode = provinceKeys[provinceIndex];
    const genderCode = genderIndex === 0 ? 'm' : 'f';
    const mainCodes = this.data.mainSubList.map(sub => provinceCode + genderCode + mainTypeKeys[mainTypeIndex] + sub.code);
    const specialSub = specialSubList[specialSubIndex];
    let specialCode = provinceCode + genderCode + specialTypeKeys[specialTypeIndex] + specialSub.code;
    if (showVolleyballSkill && volleyballSkillKeys.length > 0) {
      specialCode += volleyballSkillKeys[volleyballSkillIndex];
    }
    return { mainCodes, specialCode };
  },

  submitForm() {
    console.log('[tool_f] submitForm');
    if (!this.validate()) return;
    if (this.data.submitting) return;

    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中...' });

    const { provinceList, provinceIndex, provinceKeys, genderList, genderIndex, mainTypeList, mainTypeIndex, mainTypeKeys, mainSubList, mainScores, specialTypeList, specialTypeIndex, specialTypeKeys, specialSubList, specialSubIndex, specialScore, showVolleyballSkill, volleyballSkillList, volleyballSkillKeys, volleyballSkillIndex } = this.data;
    const { mainCodes, specialCode } = this.buildCode();

    const provinceCode = provinceKeys[provinceIndex];
    const genderCode = genderIndex === 0 ? 'm' : 'f';

    const mainData = mainSubList
      .filter(sub => mainScores[sub.code] && mainScores[sub.code].trim())
      .map(sub => ({
        code: provinceCode + genderCode + mainTypeKeys[mainTypeIndex] + sub.code,
        name: sub.name,
        unit: sub.unit,
        value: mainScores[sub.code].trim()
      }));

    let specialData = null;
    if (specialScore && specialScore.trim()) {
      const specialSub = specialSubList[specialSubIndex];
      let specialName = specialSub.name;
      let specialUnit = specialSub.unit;
      if (showVolleyballSkill && volleyballSkillList.length > 0) {
        specialName += '-' + volleyballSkillList[volleyballSkillIndex];
        const typeKey = specialTypeKeys[specialTypeIndex];
        const skills = RULES.specialProject[typeKey].items[specialSub.code].skills;
        specialUnit = skills[volleyballSkillKeys[volleyballSkillIndex]].unit;
      }
      specialData = {
        code: specialCode,
        name: specialName,
        unit: specialUnit,
        value: specialScore.trim()
      };
    }

    wx.cloud.callFunction({
      name: 'sport_tool_fun1',
      data: {
        province: provinceList[provinceIndex],
        provinceCode,
        gender: genderList[genderIndex],
        mainType: mainTypeList[mainTypeIndex],
        mainTypeKey: mainTypeKeys[mainTypeIndex],
        mainData,
        specialType: specialTypeList[specialTypeIndex],
        specialTypeKey: specialTypeKeys[specialTypeIndex],
        specialData
      },
      success: (res) => {
        wx.hideLoading();
        this.setData({ submitting: false });
        if (res.result && res.result.success) {
          wx.showToast({ title: '提交成功', icon: 'success' });
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
      genderIndex: 0,
      specialScore: ''
    });
    this.loadProvinceOptions(provinceKey);
  }
});
