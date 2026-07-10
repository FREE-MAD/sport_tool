// pages/tool/tool_f/rule2/provinceMap.js
// 省份项目启用配置

const provinceMap = {
  "001": {
    name: "广东省",

    mainProject: [
      {
        code: "1A",
        order: 1,
        enabled: true,
        default: true
      },
      {
        code: "2B",
        order: 2,
        enabled: true,
        default: false
      }
    ],
    specialProject: [
      {
        code: "1a",
        order: 1,
        enabled: true
      },
      {
        code: "2b",
        order: 2,
        enabled: true
      },
      {
        code: "3c",
        order: 3,
        enabled: true
      }
    ]
  },

  // "002": {
  //   name: "北京市",

  //   mainProject: [
  //     {
  //       code: "1A",
  //       order: 1,
  //       enabled: true
  //     }
  //   ],

  //   specialProject: [
  //     {
  //       code: "1a",
  //       order: 1,
  //       enabled: true
  //     },
  //     {
  //       code: "2b",
  //       order: 2,
  //       enabled: true
  //     }
  //   ]
  // }
};

module.exports = provinceMap;
