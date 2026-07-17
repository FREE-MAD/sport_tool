module.exports = {
  province: { "001": "广东省" },
  ruleCodes: {
    computationRuleCode: 'cr_A',
    totalScoreCode: 'ts_300',
    specialCaseCodes: []
  },
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
        "003": { name: "两头起", unit: "个", better: "larger", match: "threshold" }
      }
    }
  },
  specialProject: {
    "1a": {
      label: "球类",
      items: {
        "001": {
          name: "足球",
          skills: {
            "0002": { name: "运球绕杆射门", unit: "秒", better: "smaller", match: "threshold" }
          }
        },
        "002": {
          name: "篮球",
          skills: {
            "0001": { name: "篮球运球", unit: "秒", better: "smaller", match: "threshold" }
          }
        },
        "003": {
          name: "排球",
          skills: {
            "0001": { name: "助跑摸高", unit: "米", better: "larger", match: "threshold" },
            "0003": { name: "传球", unit: "个", better: "larger", match: "threshold", genderless: true },
            "0004": { name: "垫球", unit: "个", better: "larger", match: "threshold", genderless: true }
          }
        },
        "004": {
          name: "乒乓球",
          skills: {
            "0001": { name: "左推右攻", unit: "个", better: "larger", match: "threshold", genderless: true }
          }
        }
      }
    },
    "2b": {
      label: "游泳",
      items: {
        "001": {
          name: "100米游泳（25米池）",
          choose: 1,
          "Seconds and minutes": true,
          skills: {
            "0001": { name: "蝶泳", unit: "秒", better: "smaller", match: "threshold" },
            "0002": { name: "仰泳", unit: "秒", better: "smaller", match: "threshold" },
            "0003": { name: "自由泳", unit: "秒", better: "smaller", match: "threshold" },
            "0004": { name: "蛙泳", unit: "秒", better: "smaller", match: "threshold" }
          }
        },
        "002": {
          name: "100米游泳（50米池）",
          choose: 1,
          "Seconds and minutes": true,
          skills: {
            "0001": { name: "蝶泳", unit: "秒", better: "smaller", match: "threshold" },
            "0002": { name: "仰泳", unit: "秒", better: "smaller", match: "threshold" },
            "0003": { name: "自由泳", unit: "秒", better: "smaller", match: "threshold" },
            "0004": { name: "蛙泳", unit: "秒", better: "smaller", match: "threshold" }
          }
        },
        "003": {
          name: "50米游泳（25米池）",
          choose: 1,
          "Seconds and minutes": true,
          skills: {
            "0001": { name: "蝶泳", unit: "秒", better: "smaller", match: "threshold" },
            "0002": { name: "仰泳", unit: "秒", better: "smaller", match: "threshold" },
            "0003": { name: "自由泳", unit: "秒", better: "smaller", match: "threshold" },
            "0004": { name: "蛙泳", unit: "秒", better: "smaller", match: "threshold" }
          }
        },
        "004": {
          name: "50米游泳（50米池）",
          choose: 1,
          "Seconds and minutes": true,
          skills: {
            "0001": { name: "蝶泳", unit: "秒", better: "smaller", match: "threshold" },
            "0002": { name: "仰泳", unit: "秒", better: "smaller", match: "threshold" },
            "0003": { name: "自由泳", unit: "秒", better: "smaller", match: "threshold" },
            "0004": { name: "蛙泳", unit: "秒", better: "smaller", match: "threshold" }
          }
        }
      }
    },
    "3c": {
      label: "体操",
      skills: {
        "001": { name: "左、右纵劈叉考试评分标准", unit: "厘米", better: "larger", match: "threshold", number: "Positive or negative" },
        "002": { name: "控倒立", unit: "秒", better: "larger", match: "threshold" },
        "003": { name: "健美操成套动作", unit: "分", better: "larger", match: "threshold", rule: false }
      }
    }
  },
  auxiliaryProject: {}
};
