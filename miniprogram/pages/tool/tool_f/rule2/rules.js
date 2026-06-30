// pages/tool/tool_f/rules.js
// 体育成绩编码规则
// better=查表方向(smaller=值越小分越高, larger=值越大分越高), match=匹配方式(threshold=阈值查表)
const RULES = {
  province: { "001": "广东省" },
  gender: { "m": "男", "f": "女", "o": "不分性别" },
  mainProject: {
    "1A": {
      label: "田径",
      items: {
        "001": { name: "100米跑", unit: "秒", better: "smaller", match: "threshold" },
        "002": { name: "立定三级跳远", unit: "米", better: "larger", match: "threshold" },
        "003": { name: "原地推铅球", unit: "米", better: "larger", match: "threshold" }
      }
    },
    "2B": {
      label: "体操",
      items: {
        "001": { name: "俯卧撑", unit: "个", better: "larger", match: "threshold" },
        "002": { name: "8字绕杆跑", unit: "秒", better: "smaller", match: "threshold" },
        "003": { name: "两头起", unit: "个", better: "larger", match: "threshold" },
      }
    }
  },
  specialProject: {
    "1a": {
      label: "球类",
      items: {
        "001": { name: "足球", unit: "秒", better: "smaller", match: "threshold" },
        "002": { name: "篮球", unit: "秒", better: "smaller", match: "threshold" },
        "003": {
          name: "排球",
          input: "2",
          skills: {
            "0001": { name: "摸高", unit: "米", better: "larger", match: "threshold" },
            "0002": { name: "垫球,传球", unit: "个", better: "larger", match: "threshold", genderless: true, input: "2" }
          }
        },
        "004": { name: "乒乓球", unit: "个", better: "larger", match: "threshold", genderless: true }
      }
    },
    // "2b": {
    //   label: "游泳",
    //   items: {
    //     "001": { name: "游泳", unit: "秒", better: "smaller", match: "threshold" }
    //   }
    // },
    "3c": {
      label: "健美操、啦啦操",
      input: "2",
      skills: {
        "001": { name: "左、右纵劈叉考试评分标准", unit: "厘米", better: "larger", match: "threshold", number: "Positive or negative" },
        "002": { name: "控倒立", unit: "秒", better: "larger", match: "threshold" },
        "003": { name: "健美操成套动作", unit: "分", better: "larger", match: "threshold", rule: false }
      }
    }
  }
};

module.exports = RULES;
