// pages/tool/tool_f/rules.js
// 体育成绩编码规则
// 前端渲染字段说明：
// label: 渲染为类别/分组 picker 的显示名称。
// items: 渲染为“项目”级列表；有 items 时，前端先选项目，再决定是否继续渲染 skills。
// skills: 渲染为“细项/泳姿/技能”列表；是否需要先选、以及每个细项显示几个 input，由 choose / parallel 决定。
// name: 渲染为当前项目或细项的标题文案。
// unit: 渲染为 input 的 placeholder 单位。
// parallel: 是否为当前规则节点渲染多个 input；true 时按 parallel_num 生成，false 或不写时默认 1 个 input。
// parallel_num: 与 parallel=true 搭配，表示当前规则节点前端要渲染几个 input。
// choose: 配在包含 skills 的父级节点上，表示该组 skills 允许选择几个候选项；当前前端已实现 choose: 1 的单选渲染。
// "Seconds and minutes": true 时，前端对该规则下的时间成绩使用微信原生多列 picker，按“分/秒/毫秒”选择，并提交为 MM:SS.xx。
// better: 查表方向(smaller=值越小分越高, larger=值越大分越高)，只影响评分，不改变前端布局。
// match: 匹配方式(threshold=阈值查表)，只影响评分，不改变前端布局。
// genderless: 使用不分性别编码，只影响编码拼接，不改变前端布局。
// number: 数值格式约束；Positive or negative 表示前端 input 允许输入负数。
// rule: 评分规则开关；false 表示该项提交后不走常规规则表评分。
// 统一约定：
// 1. 只有最终渲染到 input 的规则节点，才保留 parallel / parallel_num。
// 2. 包含 skills 的父级节点，用 choose 表达“选几个”；不再用父级 parallel_num 做说明性统计。
// 3. 未配置 choose 的 skills 组，前端默认全展开。
const RULES = {
  province: { "001": "广东省" },
  gender: { "m": "男", "f": "女", "o": "不分性别" },
  mainProject: {
    "1A": {
      label: "田径",
      items: {
        "001": { name: "100米跑", unit: "秒", better: "smaller", match: "threshold", parallel: false },
        "002": { name: "立定三级跳远", unit: "米", better: "larger", match: "threshold", parallel: false },
        "003": { name: "原地推铅球", unit: "米", better: "larger", match: "threshold", parallel: false }
      }
    },
    "2B": {
      label: "体操",
      items: {
        "001": { name: "俯卧撑", unit: "个", better: "larger", match: "threshold", parallel: false },
        "002": { name: "8字绕杆跑", unit: "秒", better: "smaller", match: "threshold", parallel: false },
        "003": { name: "两头起", unit: "个", better: "larger", match: "threshold", parallel: false },
      }
    }
  },
  specialProject: {
    "1a": {
      label: "球类",
      items: {
        "001": { name: "足球", unit: "秒", better: "smaller", match: "threshold", parallel: false },
        "002": { name: "篮球", unit: "秒", better: "smaller", match: "threshold", parallel: false },
        // 全展开：排球下的细项全部显示；真正决定 input 数量的是具体 skill 节点。
        "003": {
          name: "排球",
          skills: {
            "0001": { name: "摸高", unit: "米", better: "larger", match: "threshold", parallel: false },
            "0002": { name: "垫球,传球", unit: "个", better: "larger", match: "threshold", genderless: true, parallel: true, parallel_num: "2" }
          }
        },
        "004": { name: "乒乓球", unit: "个", better: "larger", match: "threshold", genderless: true, parallel: false }
      }
    },
    "2b": {
      label: "游泳",
      items: {
        // choose: 1，表示四种泳姿单选；选中后再渲染该泳姿自己的 input。
        "001": {
          name: "100 米游泳考试评分标准（25 米池）",
          choose: 1,
          "Seconds and minutes": true,
          skills: {
            "0001": { name: "蝶泳", unit: "秒", better: "smaller", match: "threshold", parallel: false },
            "0002": { name: "仰泳", unit: "秒", better: "smaller", match: "threshold", parallel: false },
            "0003": { name: "自由泳", unit: "秒", better: "smaller", match: "threshold", parallel: false },
            "0004": { name: "蛙泳", unit: "秒", better: "smaller", match: "threshold", parallel: false }
          }
        },
        "002": {
          name: "100 米游泳考试评分标准（50 米池）",
          choose: 1,
          "Seconds and minutes": true,
          skills: {
            "0001": { name: "蝶泳", unit: "秒", better: "smaller", match: "threshold", parallel: false },
            "0002": { name: "仰泳", unit: "秒", better: "smaller", match: "threshold", parallel: false },
            "0003": { name: "自由泳", unit: "秒", better: "smaller", match: "threshold", parallel: false },
            "0004": { name: "蛙泳", unit: "秒", better: "smaller", match: "threshold", parallel: false }
          }
        },
        "003": {
          name: "50 米游泳考试评分标准（25 米池）",
          choose: 1,
          "Seconds and minutes": true,
          skills: {
            "0001": { name: "蝶泳", unit: "秒", better: "smaller", match: "threshold", parallel: false },
            "0002": { name: "仰泳", unit: "秒", better: "smaller", match: "threshold", parallel: false },
            "0003": { name: "自由泳", unit: "秒", better: "smaller", match: "threshold", parallel: false },
            "0004": { name: "蛙泳", unit: "秒", better: "smaller", match: "threshold", parallel: false }
          }
        },
        "004": {
          name: "50 米游泳考试评分标准（50 米池）",
          choose: 1,
          "Seconds and minutes": true,
          skills: {
            "0001": { name: "蝶泳", unit: "秒", better: "smaller", match: "threshold", parallel: false },
            "0002": { name: "仰泳", unit: "秒", better: "smaller", match: "threshold", parallel: false },
            "0003": { name: "自由泳", unit: "秒", better: "smaller", match: "threshold", parallel: false },
            "0004": { name: "蛙泳", unit: "秒", better: "smaller", match: "threshold", parallel: false }
          }
        }
      }
    },
    // 顶层 skills 全展开：不走 choose；每个 skill 是否多 input 由各自 parallel / parallel_num 决定。
    "3c": {
      label: "体操",
      skills: {
        "001": { name: "左、右纵劈叉考试评分标准", unit: "厘米", better: "larger", match: "threshold", number: "Positive or negative", parallel: false },
        "002": { name: "控倒立", unit: "秒", better: "larger", match: "threshold", parallel: false },
        "003": { name: "健美操成套动作", unit: "分", better: "larger", match: "threshold", rule: false, parallel: false }
      }
    }
  }
};

module.exports = RULES;
