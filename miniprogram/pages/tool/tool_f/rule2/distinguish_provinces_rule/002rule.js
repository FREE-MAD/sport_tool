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
      // 默认38
      items: {
        "001": { name: "游泳", unit: "秒", better: "smaller", match: "threshold", "Seconds and minutes": true ,timeDefaultValue: [0, 38, 0] }
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
            // 可查125，，，注意没有评分表的项目，不走查分逻辑
            "0001": { name: "颠球", unit: "个", better: "larger", match: "threshold", genderless: true },
            // 固定项目：定位球传准按总分直接输入，不走查分表
            "0003": { name: "定位球传准", unit: "分", rule: false },
            // B：普通考生项目。达标分查表，技术评审单独手填 10 分
            "0002": { name: "运球绕杆射门", unit: "秒", better: "smaller", match: "threshold", techSkill: "0006" },

            // 守门员加试两项改为并列独立项，和专项动作选择处于同一层级
            "0005": { name: "守门员加试-立定跳远", unit: "米", better: "larger", match: "threshold" },
            "0004": { name: "守门员加试-扑接球技术", unit: "分", better: "larger", match: "threshold", genderless: true, rule: false },
            // 运球绕杆射门的技术评审单独成码，页面展示为附加评审输入框
            "0006": { name: "技术评审", unit: "分", rule: false }
          },
          // 技能层二选一：
          // 1. 选“运球绕杆射门”时，仅激活 0002
          // 2. 选“守门员加试”时，同时激活 0004 + 0005
          skillChooseGroups: [
            {
              label: "专项项目选择",
              options: [
                { code: "0002", name: "运球绕杆射门", codes: ["0002"] },
                { code: "goalkeeper", name: "守门员加试", codes: ["0004", "0005"] }
              ],
              choose: 1
            }
          ]
        },
        "002": {
          name: "篮球",
          skills: {
            "0002": { name: "助跑摸高", unit: "米" },
            // 男子 3.10 米为满分。高度每下降 1 厘米扣 1 分，以此类推。
            // 女子 2.75 米为满分。高度每下降 1 厘米扣 1 分，以此类推。
            "0003": { name: "往返运球单手低手投篮", unit: "秒", techSkill: "0005" },
            // 编码可查 + 评分
            // "1a0020003"   往返运球单手低手投篮，有表可查
            // "1a00200030005" 往返运球单手低手投篮技术评审，无表可查直接填写
            "0004": { name: "一分钟自投自抢投篮", unit: "个", techSkill: "0005" },
            // 编码可查 + 评分
            // "1a0020004"   一分钟自投自抢投篮，有表可查
            // "1a00200040005" 一分钟自投自抢投篮技术评审，无表可查直接填写
            // 技术评审无评分表，按用户输入分数直接计分
            "0005": { name: "技术评审", unit: "分", rule: false }
          }
        },
        "003": {
          // name: "排球助跑摸高", unit: "米", better: "larger", match: "threshold", genderless: true
          name: "排球",
          skills: {
            // 20 分可以查询
            "0001": { name: "助跑摸高", unit: "米" },
            // 以下项目均无单独查分表，在前端逻辑中按组合项直接输入
            // 12 + 4
            // "0002": { name: "发球", unit: "分", techSkill: "0006" },
            // "0003": { name: "传球", unit: "分", techSkill: "0006" },
            // "0004": { name: "垫球", unit: "分", techSkill: "0006" },
            // 24 + 8
            // "0005": { name: "扣球", unit: "分", techSkill: "0006" },
            // "0006": { name: "技术评审", unit: "分" }
            // 基本技术无单独评分表，前端手填后直接计分
            "23456all": { name: "基本技术", unit: "分", rule: false }
          }
        },
        "004": {
          name: "乒乓球",
          // 40 + 10
          skills: {
            // "0002": { name: "结合技术", unit: "分" },
            // 里面包含：
            // "0004": { name: "推攻、两面攻", unit: "个" }
            // "0005": { name: "正反手削球", unit: "个" }
            // 这里不再把“结合技术”做成嵌套节点，而是转成技能层局部二选一
            // 选中的达标项继续复用 techSkill 挂接技术评审分
            // 搓中侧身突击按输入分值直接计分，技术评审同样不走查分表
            "0003": { name: "搓中侧身突击", unit: "个", techSkill: "0006",genderless: true},
            "0004": { name: "推攻、两面攻", unit: "个", better: "larger", match: "threshold", techSkill: "0006" ,genderless: true},
            "0005": { name: "正反手削球", unit: "个", better: "larger", match: "threshold", techSkill: "0006" ,genderless: true},
            "0006": { name: "技术评审", unit: "分", rule: false ,genderless: true,}
          },
          skillChooseGroups: [
            {
              label: "结合技术二选一",
              codes: ["0004", "0005"],
              choose: 1
            }
          ]
        },
        "005": {
          name: "网球",
          skills: {
            // 无标准表，直接输入分数
            "0001": { name: "发球", unit: "分", rule: false },
            "0002": { name: "正反手击球", unit: "分", rule: false }
          }
        },
        "006": {
          name: "羽毛球",
          skills: {
            // 无查分方式，直接输入
            "0001": { name: "正手击后场高远球", unit: "个", rule: false },
            "0002": { name: "后场吊球", unit: "分", rule: false },
            "0003": { name: "网前勾球", unit: "分", rule: false }
          }
        }
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
            "0001": { name: "自由泳", unit: "秒", better: "smaller", match: "threshold", timeDefaultValue: [1, 6, 0] },
            "0002": { name: "仰泳", unit: "秒", better: "smaller", match: "threshold" ,
            timeDefaultValue: [1, 15, 0]},
            "0003": { name: "蛙泳", unit: "秒", better: "smaller", match: "threshold" ,
            timeDefaultValue: [1, 21, 0]},
            "0004": { name: "蝶泳", unit: "秒", better: "smaller", match: "threshold",
            timeDefaultValue: [1, 12, 0] }
          }
        }
      }
    },
    // "3c": {
    //   label: "体操",
    //   skills: {
    //     // 无明确查分规则，直接输入
    //     "004": { name: "自由体操", unit: "分" },
    //     "005": { name: "单杠/双杠", unit: "分" }
    //   }
    // },
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
      // 先注释掉所有细分,先使用'请输入分数',
      // code末尾到"5eg"等等即可,不进行后端查分
      // 无明确查分规则的项目按直接输入处理
      groupLabel: "分类",
      groups: {
        "5eg": {
          label: "跆拳道",
          // 旧细分规则先保留为注释，当前统一改为直接输入总分。
          // 这里不再包 items，直接由分组外层承载当前项目配置。
          name: "跆拳道",
          unit: "分",
          rule: false,
          // items: {
          //   "0001": { name: "横叉", unit: "", better: "smaller", match: "threshold" },
          //   "0002": { name: "双飞踢", unit: "个", better: "larger", match: "threshold" },
          //   "0003": { name: "组合靶技术", unit: "分", better: "larger", match: "threshold", genderless: true }
          // }
        },
        "5eh": {
          label: "艺术体操",
          // 旧细分规则先保留为注释，当前统一改为直接输入总分。
          // 艺术体操原本就是不分性别评分逻辑，这里继续沿用 genderless 标记。
          // 这里不再包 items，直接由分组外层承载当前项目配置。
          name: "艺术体操",
          unit: "分",
          rule: false,
          genderless: true,
          // items: {
          //   "0001": { name: "专项素质", unit: "分", better: "larger", match: "threshold", genderless: true },
          //   "0002": { name: "技术徒手规定动作", unit: "分", better: "larger", match: "threshold", genderless: true },
          //   "0003": { name: "球规定动作", unit: "分", better: "larger", match: "threshold", genderless: true }
          // }
        },
        "5ei": {
          label: "健美操",
          // 旧细分规则先保留为注释，当前统一改为直接输入总分。
          // 这里不再包 items，直接由分组外层承载当前项目配置。
          name: "健美操",
          unit: "分",
          rule: false,
          // items: {
          //   "0001": { name: "横叉", unit: "", better: "smaller", match: "threshold" },
          //   "0002": { name: "双飞踢", unit: "个", better: "larger", match: "threshold" },
          //   "0003": { name: "组合靶技术", unit: "分", better: "larger", match: "threshold", genderless: true }
          // }
        },
        "5ej": {
          // 区别于编码词典，这里按湖南标准编码挂到 5ej 分组
          label: "体操",
          // 旧 skills 规则先保留为注释，当前统一改为直接输入总分。
          // 这里不再包 items，直接由分组外层承载当前项目配置。
          name: "体操",
          unit: "分",
          rule: false,
          // skills: {
          //   // 无明确查分规则，直接输入
          //   "004": { name: "自由体操", unit: "分" },
          //   "005": { name: "单杠/双杠", unit: "分" }
          // }
        }
      }
    }
  },

};
