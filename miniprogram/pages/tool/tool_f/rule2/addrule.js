const ADD_RULES = {
  gender: {
    m: '男',
    f: '女',
    o: '不分性别'
  },
  computationRules: {
    cr_A: {
      code: 'cr_A',
      label: '主项+专项',
      formula: 'mainProject + specialProject',
      scopeKeys: ['mainProject', 'specialProject'],
      scopeWeights: {
        mainProject: 1,
        specialProject: 1
      }
    },
    cr_B: {
      code: 'cr_B',
      label: '100米[001]*0.9 + 二选一[004/005]*0.6 + 辅项*0.5 + 专项',
      formula: 'mainProject[001]*0.9 + mainProject[004|005]*0.6 + auxiliaryProject*0.5 + specialProject',
      scopeKeys: ['mainProject', 'specialProject', 'auxiliaryProject'],
      scopeWeights: {
        specialProject: 1,
        auxiliaryProject: 0.5
      },
      mainProjectWeights: {
        itemWeights: {
          '001': 0.9,
          '004': 0.6,
          '005': 0.6
        },
        chooseOneGroups: [
          ['004', '005']
        ]
      }
    }
  },
  totalScore: {
    ts_300: {
      code: 'ts_300',
      label: '总分300分',
      total: 300
    },
    ts_400: {
      code: 'ts_400',
      label: '总分400分',
      total: 400
    },
    ts_500: {
      code: 'ts_500',
      label: '总分500分',
      total: 500
    }
  },
  specialCase: {}
};

function clonePlainObject(input) {
  return Object.assign({}, input || {});
}

function normalizeRuleCodes(ruleCodes) {
  const codes = ruleCodes || {};
  return {
    computationRuleCode: codes.computationRuleCode || '',
    totalScoreCode: codes.totalScoreCode || '',
    specialCaseCodes: Array.isArray(codes.specialCaseCodes) ? codes.specialCaseCodes.slice() : []
  };
}

function resolveRuleCode(ruleMap, ruleCode) {
  if (!ruleCode || !ruleMap || !ruleMap[ruleCode]) return null;
  return clonePlainObject(ruleMap[ruleCode]);
}

function buildProvinceRuleMeta(ruleCodes) {
  const normalizedCodes = normalizeRuleCodes(ruleCodes);
  return {
    computationRuleCode: normalizedCodes.computationRuleCode,
    totalScoreCode: normalizedCodes.totalScoreCode,
    specialCaseCodes: normalizedCodes.specialCaseCodes,
    computationRule: resolveRuleCode(ADD_RULES.computationRules, normalizedCodes.computationRuleCode),
    totalScoreRule: resolveRuleCode(ADD_RULES.totalScore, normalizedCodes.totalScoreCode),
    specialCaseRules: normalizedCodes.specialCaseCodes
      .map((code) => resolveRuleCode(ADD_RULES.specialCase, code))
      .filter(Boolean)
  };
}

function mergeProvinceRule(provinceRule) {
  const nextRule = clonePlainObject(provinceRule);
  nextRule.gender = nextRule.gender || clonePlainObject(ADD_RULES.gender);
  nextRule.ruleCodes = normalizeRuleCodes(nextRule.ruleCodes);
  nextRule.addRuleMeta = buildProvinceRuleMeta(nextRule.ruleCodes);
  return nextRule;
}

module.exports = Object.assign({}, ADD_RULES, {
  normalizeRuleCodes,
  resolveRuleCode,
  buildProvinceRuleMeta,
  mergeProvinceRule
});
