module.exports = {
  province: { "002": "湖南省" },
  ruleCodes: {
    computationRuleCode: 'cr_B',
    totalScoreCode: 'ts_300',
    specialCaseCodes: []
  },
  mainProject: {
    "1A": {
      label: "身体素质",
      chooseGroups: [
        {
          label: "二选一",
          codes: ["004", "005"],
          choose: 1
        }
      ],
      items: {
        "001": { name: "100米跑", unit: "秒", better: "smaller", match: "threshold" },
        "004": { name: "五米三向折回跑", unit: "秒", better: "smaller", match: "threshold" },
        "005": { name: "立定跳远", unit: "米", better: "larger", match: "threshold" }
      }
    }
  },
  auxiliaryProject: {
    "1aa": {
      label: "球类辅项",
      items: {
        "001": { name: "足球运球绕杆射门", unit: "秒", better: "smaller", match: "threshold" },
        "002": { name: "篮球往返运球单手低手投篮", unit: "秒", better: "smaller", match: "threshold" },
        "003": { name: "排球对墙传球垫球", unit: "个", better: "larger", match: "threshold", genderless: true }
      }
    },
    "2bb": {
      label: "游泳辅项",
      items: {
        "001": { name: "游泳", unit: "秒", better: "smaller", match: "threshold", "Seconds and minutes": true }
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
            "0001": { name: "颠球", unit: "个", better: "larger", match: "threshold", genderless: true },
            "0002": { name: "运球绕杆射门", unit: "秒", better: "smaller", match: "threshold" },
            "0004": { name: "守门员加试-扑接球技术", unit: "分", better: "larger", match: "threshold", genderless: true },
            "0005": { name: "守门员加试-立定跳远", unit: "米", better: "larger", match: "threshold", genderless: true }
          }
        },
        "002": {
          name: "篮球",
          skills: {
            "0001": { name: "达标项目", unit: "", better: "larger", match: "threshold" },
            "0002": { name: "往返运球单手低手投篮", unit: "秒", better: "smaller", match: "threshold" }
          }
        },
        "003": { name: "排球助跑摸高", unit: "米", better: "larger", match: "threshold", genderless: true },
        "004": { name: "乒乓球达标", unit: "", better: "larger", match: "threshold", genderless: true }
      }
    },
    "2b": {
      label: "游泳",
      items: {
        "001": {
          name: "100米游泳",
          choose: 1,
          "Seconds and minutes": true,
          skills: {
            "0001": { name: "自由泳", unit: "秒", better: "smaller", match: "threshold" },
            "0002": { name: "仰泳", unit: "秒", better: "smaller", match: "threshold" },
            "0003": { name: "蛙泳", unit: "秒", better: "smaller", match: "threshold" },
            "0004": { name: "蝶泳", unit: "秒", better: "smaller", match: "threshold" }
          }
        }
      }
    },
    "3c": {
      label: "健美操",
      skills: {
        "001": { name: "纵劈腿(左、右)", unit: "", better: "smaller", match: "threshold" },
        "002": { name: "10秒钟快速俯卧撑", unit: "个", better: "larger", match: "threshold" },
        "003": { name: "难度动作", unit: "分", better: "larger", match: "threshold" }
      }
    },
    "4d": {
      label: "田径",
      groupLabel: "分类",
      groups: {
        "4de": {
          label: "跑类",
          items: {
            // timeRange：可选，自定义三列的"可选数量"（不写则默认 10分/60秒/100毫秒）
            // timeDefaultValue / timeDefault：可选，自定义 picker 的"初始选中位置"（不影响可选数量）
            //   对 200米跑：秒列仍然完整提供 00~59，只是滚轮默认停在 20秒 00毫秒
            "0001": { name: "200米跑", unit: "秒", better: "smaller", match: "threshold", "Seconds and minutes": true, timeDefaultValue: [0, 20, 0] },
            "0002": { name: "400米跑", unit: "秒", better: "smaller", match: "threshold", "Seconds and minutes": true, timeRange: { minute: 5, second: 60, millisecond: 100 },timeDefaultValue: [0, 55, 0] },
            "0003": { name: "800米跑", unit: "秒", better: "smaller", match: "threshold", "Seconds and minutes": true },
            "0004": { name: "1500米跑", unit: "秒", better: "smaller", match: "threshold", "Seconds and minutes": true },
            "0005": { name: "跨栏", unit: "秒", better: "smaller", match: "threshold", "Seconds and minutes": true, timeRange: { minute: 5, second: 60, millisecond: 100 } }
          }
        },
        "4df": {
          label: "跳类",
          items: {
            "0001": { name: "三级跳远", unit: "米", better: "larger", match: "threshold" },
            "0002": { name: "跳高", unit: "米", better: "larger", match: "threshold" },
            "0003": { name: "跳远", unit: "米", better: "larger", match: "threshold" }
          }
        },
        "4dg": {
          label: "投类",
          items: {
            "0001": { name: "铅球", unit: "米", better: "larger", match: "threshold" },
            "0002": { name: "铁饼", unit: "米", better: "larger", match: "threshold" },
            "0003": { name: "标枪", unit: "米", better: "larger", match: "threshold" }
          }
        }
      }
    },
    "5e": {
      label: "展示类",
      groupLabel: "分类",
      groups: {
        "5eg": {
          label: "跆拳道",
          items: {
            "0001": { name: "横叉", unit: "", better: "smaller", match: "threshold" },
            "0002": { name: "双飞踢", unit: "个", better: "larger", match: "threshold" },
            "0003": { name: "组合靶技术", unit: "分", better: "larger", match: "threshold", genderless: true }
          }
        },
        "5eh": {
          label: "艺术体操",
          items: {
            "0001": { name: "专项素质", unit: "分", better: "larger", match: "threshold", genderless: true },
            "0002": { name: "技术徒手规定动作", unit: "分", better: "larger", match: "threshold", genderless: true },
            "0003": { name: "球规定动作", unit: "分", better: "larger", match: "threshold", genderless: true }
          }
        }
      }
    }
  },

};
