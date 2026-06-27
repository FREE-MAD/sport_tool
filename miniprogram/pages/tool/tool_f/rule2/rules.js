// pages/tool/tool_f/rules.js
// 体育成绩编码规则
const RULES = {
  province: { "001": "广东省" },
  gender: { "m": "男", "f": "女" },
  mainProject: {
    "1A": {
      label: "田径",
      items: {
        "001": { name: "100米跑", unit: "秒" },
        "002": { name: "立定三级跳远", unit: "米" },
        "003": { name: "原地推铅球", unit: "米" }
      }
    },
    "2B": {
      label: "体操",
      items: {
        "001": { name: "俯卧撑", unit: "个" },
        "002": { name: "8字绕杆跑", unit: "秒" },
        "003": { name: "控倒立", unit: "秒" },
        "004": { name: "两头起", unit: "个" },
        "005": { name: "左、右纵劈叉", unit: "厘米" }
      }
    }
  },
  specialProject: {
    "1a": {
      label: "球类",
      items: {
        "001": { name: "足球", unit: "秒" },
        "002": { name: "篮球", unit: "秒" },
        "003": {
          name: "排球",
          skills: {
            "0001": { name: "摸高", unit: "米" },
            "0002": { name: "垫球", unit: "个" },
            "0003": { name: "传球", unit: "个" }
          }
        },
        "004": { name: "乒乓球", unit: "秒" }
      }
    },
    "2b": {
      label: "游泳",
      items: {
        "001": { name: "游泳", unit: "秒" }
      }
    }
  }
};

module.exports = RULES;
