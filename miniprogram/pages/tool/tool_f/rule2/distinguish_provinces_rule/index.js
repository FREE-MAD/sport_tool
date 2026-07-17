const { mergeProvinceRule } = require('../addrule.js');
const guangdongRule = require('./001rule.js');
const hunanRule = require('./002rule.js');

module.exports = {
  "001": mergeProvinceRule(guangdongRule),
  "002": mergeProvinceRule(hunanRule)
};
