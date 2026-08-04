// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 构造统一的空资料结构，后续扩充昵称、头像、手机号时都挂在同一层
function createEmptyProfile() {
  return {
    nickName: '',
    avatarUrl: '',
    phone: '',
  };
}

// 统一把任意来源的登录时间记录整理为数组，保证“只增不减”的历史结构稳定
function normalizeLoginHistory(existing) {
  if (Array.isArray(existing) && existing.length) {
    return existing.filter(Boolean);
  }
  if (existing) {
    return [existing];
  }
  return [];
}

// 兼容旧数据结构，确保旧库里 null/缺失字段不会影响新的一人一文档模型
function normalizeUserRecord(rawRecord, fallbackOpenid) {
  const source = rawRecord || {};
  const openid = source.openid || fallbackOpenid || '';
  return {
    _id: openid,
    openid,
    appid: source.appid || '',
    unionid: source.unionid || '',
    profile: source.profile && typeof source.profile === 'object'
      ? Object.assign(createEmptyProfile(), source.profile)
      : createEmptyProfile(),
    runtimeEnvVersion: source.runtimeEnvVersion || 'release',
    toolPreferences: source.toolPreferences && typeof source.toolPreferences === 'object'
      ? source.toolPreferences
      : {},
    createTime: source.createTime || null,
    lastLoginTime: source.lastLoginTime || null,
    loginHistory: normalizeLoginHistory(source.loginHistory || source.LoginTime),
  };
}

// 统一读取当前 openid 对应的登录用户记录。
// 新结构优先按 _id=openid 读取；如果命中旧库历史数据，则自动兼容读取，便于后续收敛到单文档模型。
async function getLoginUserRecordByOpenid(collectionName, openid) {
  const collection = db.collection(collectionName);

  try {
    const docRes = await collection.doc(openid).get();
    if (docRes && docRes.data) {
      return normalizeUserRecord(docRes.data, openid);
    }
  } catch (err) {
    if (!String(err && err.message || '').includes('does not exist')) {
      throw err;
    }
  }

  const queryRes = await collection.where({ openid }).limit(20).get();
  const records = (queryRes.data || []).filter(Boolean);
  if (!records.length) {
    return null;
  }

  const merged = records.reduce((acc, item) => {
    if (!acc) {
      return normalizeUserRecord(item, openid);
    }

    const normalized = normalizeUserRecord(item, openid);
    return {
      ...acc,
      appid: acc.appid || normalized.appid,
      unionid: acc.unionid || normalized.unionid,
      profile: Object.assign({}, createEmptyProfile(), acc.profile || {}, normalized.profile || {}),
      runtimeEnvVersion: normalized.runtimeEnvVersion || acc.runtimeEnvVersion,
      toolPreferences: Object.assign({}, acc.toolPreferences || {}, normalized.toolPreferences || {}),
      createTime: acc.createTime || normalized.createTime,
      lastLoginTime: normalized.lastLoginTime || acc.lastLoginTime,
      loginHistory: normalizeLoginHistory([].concat(acc.loginHistory || [], normalized.loginHistory || [])),
    };
  }, null);

  return merged;
}

function resolveLoginUserCollectionName(options) {
  const opts = options || {};
  if (opts.forceLoginUserCollectionName) return opts.forceLoginUserCollectionName;
  if (opts.useTestCollection === true) return 'test_tool_loginuser';
  if (opts.useTestCollection === false) return 'realenvironment_tool_loginuser';
  if (opts.runtimeEnvVersion === 'develop') return 'test_tool_loginuser';
  return 'realenvironment_tool_loginuser';
}

// 与 sport_tool_fun1 保持同一套环境分仓规则，确保“我的历史”读取的是当前环境下的提交记录。
function resolveRecordCollectionName(options) {
  const opts = options || {};
  if (opts.forceRecordCollectionName) return opts.forceRecordCollectionName;
  if (opts.useTestCollection === true) return 'tool_records';
  if (opts.useTestCollection === false) return 'real_environment_tool_records';
  if (opts.runtimeEnvVersion === 'develop') return 'tool_records';
  return 'real_environment_tool_records';
}

// 把任意时间值整理为可排序时间戳，兼容数据库 Date / ISO 字符串 / 数字时间戳。
function toTimestamp(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

// 将提交记录整理为前端 mine 页可直接消费的历史卡片结构，避免页面层再关心数据库原始字段差异。
function normalizeScoreHistoryRecord(record) {
  const source = record || {};
  const mainScores = Array.isArray(source.mainScores) ? source.mainScores : [];
  const specialScores = Array.isArray(source.specialScores) ? source.specialScores : [];
  const submitTimestamp = source.clientSubmitTimestamp || toTimestamp(source.createTime) || Date.now();
  const projectCount = mainScores.length + specialScores.length;
  const scorePreviewList = mainScores.concat(specialScores).slice(0, 2).map((item) => item.name).filter(Boolean);

  return {
    id: source._id || '',
    totalScore: Number(source.totalScore || 0),
    province: source.province || '',
    gender: source.gender || '',
    mainType: source.mainType || '',
    specialType: source.specialType || '',
    submitTimeText: source.clientSubmitAt || '',
    submitTimestamp,
    projectCount,
    scorePreviewText: scorePreviewList.join(' / '),
    detailPayload: {
      province: source.province || '',
      gender: source.gender || '',
      mainType: source.mainType || '',
      specialType: source.specialType || '',
      totalScore: Number(source.totalScore || 0),
      mainScores,
      specialScores,
      aiFallback: source.aiFallback || null
    }
  };
}

async function upsertLoginUserRecord(collectionName, wxContext, runtimeEnvVersion) {
  const openid = wxContext.OPENID || '';
  if (!openid) {
    throw new Error('未获取到 openid');
  }

  const collection = db.collection(collectionName);
  const existing = await getLoginUserRecordByOpenid(collectionName, openid);
  const nowIso = new Date().toISOString();
  const normalizedExisting = normalizeUserRecord(existing, openid);

  // 使用 doc(openid) 固定文档主键时，data 内不能再显式携带 _id，
  // 否则云数据库会判定为“更新 _id”并直接报参数非法。
  const payload = {
    openid,
    appid: wxContext.APPID || '',
    unionid: wxContext.UNIONID || '',
    profile: normalizedExisting.profile || createEmptyProfile(),
    runtimeEnvVersion: runtimeEnvVersion || normalizedExisting.runtimeEnvVersion || 'release',
    toolPreferences: normalizedExisting.toolPreferences || {},
    createTime: normalizedExisting.createTime || db.serverDate(),
    lastLoginTime: db.serverDate(),
    loginHistory: normalizeLoginHistory([].concat(normalizedExisting.loginHistory || [], nowIso)),
  };

  await collection.doc(openid).set({
    data: payload,
  });

  return { recordId: openid, isNewUser: !existing };
}

// 读取指定工具的用户偏好，用于页面加载时回填上次使用的省份和项目选择
async function getToolPreference(collectionName, wxContext, toolKey) {
  const openid = wxContext.OPENID || '';
  if (!openid) {
    throw new Error('未获取到 openid');
  }
  if (!toolKey) {
    throw new Error('未传入 toolKey');
  }

  const existing = await getLoginUserRecordByOpenid(collectionName, openid);
  const toolPreference = existing && existing.toolPreferences
    ? existing.toolPreferences[toolKey]
    : null;

  return {
    preference: toolPreference ? (toolPreference.preference || null) : null,
    updatedAt: toolPreference ? (toolPreference.updatedAt || 0) : 0,
  };
}

// 保存指定工具的用户偏好，按 openid 写入对应登录用户记录，实现“不同用户记不同选择”
async function saveToolPreference(collectionName, wxContext, runtimeEnvVersion, toolKey, preference) {
  const openid = wxContext.OPENID || '';
  if (!openid) {
    throw new Error('未获取到 openid');
  }
  if (!toolKey) {
    throw new Error('未传入 toolKey');
  }

  await upsertLoginUserRecord(collectionName, wxContext, runtimeEnvVersion);
  const existing = await getLoginUserRecordByOpenid(collectionName, openid);
  if (!existing || !existing.openid) {
    throw new Error('未找到用户记录，无法保存偏好');
  }

  const normalizedExisting = normalizeUserRecord(existing, openid);
  const nextToolPreferences = Object.assign({}, normalizedExisting.toolPreferences || {}, {
    [toolKey]: {
      preference: preference || {},
      updatedAt: Date.now(),
      runtimeEnvVersion: runtimeEnvVersion || 'release',
    },
  });

  await db.collection(collectionName).doc(openid).update({
    data: {
      toolPreferences: nextToolPreferences,
      profile: normalizedExisting.profile || createEmptyProfile(),
      runtimeEnvVersion: runtimeEnvVersion || normalizedExisting.runtimeEnvVersion || 'release',
      lastLoginTime: db.serverDate(),
    },
  });

  return {
    preference: nextToolPreferences[toolKey].preference,
    updatedAt: nextToolPreferences[toolKey].updatedAt,
  };
}

// 清空指定工具的用户偏好，仅删除默认偏好记录，不影响当前用户其他登录字段和其他工具偏好
async function clearToolPreference(collectionName, wxContext, runtimeEnvVersion, toolKey) {
  const openid = wxContext.OPENID || '';
  if (!openid) {
    throw new Error('未获取到 openid');
  }
  if (!toolKey) {
    throw new Error('未传入 toolKey');
  }

  await upsertLoginUserRecord(collectionName, wxContext, runtimeEnvVersion);
  const existing = await getLoginUserRecordByOpenid(collectionName, openid);
  if (!existing || !existing.openid) {
    throw new Error('未找到用户记录，无法清空偏好');
  }

  const normalizedExisting = normalizeUserRecord(existing, openid);
  const nextToolPreferences = Object.assign({}, normalizedExisting.toolPreferences || {});
  delete nextToolPreferences[toolKey];

  await db.collection(collectionName).doc(openid).update({
    data: {
      toolPreferences: nextToolPreferences,
      profile: normalizedExisting.profile || createEmptyProfile(),
      runtimeEnvVersion: runtimeEnvVersion || normalizedExisting.runtimeEnvVersion || 'release',
      lastLoginTime: db.serverDate(),
    },
  });

  return {
    toolKey,
    cleared: true,
  };
}

// 读取当前 openid 在当前环境下的查分历史，仅返回最近若干条并按提交时间倒序输出。
async function getScoreHistory(wxContext, runtimeEnvVersion, options) {
  const openid = wxContext.OPENID || '';
  if (!openid) {
    throw new Error('未获取到 openid');
  }

  const opts = options || {};
  const recordCollectionName = resolveRecordCollectionName({
    runtimeEnvVersion,
    useTestCollection: opts.useTestCollection,
    forceRecordCollectionName: opts.forceRecordCollectionName
  });
  const limit = Math.min(Math.max(parseInt(opts.limit, 10) || 10, 1), 20);

  const queryRes = await db.collection(recordCollectionName).where({ openid }).limit(50).get();
  const historyList = (queryRes.data || [])
    .filter(Boolean)
    .sort((a, b) => {
      const bTime = b.clientSubmitTimestamp || toTimestamp(b.createTime);
      const aTime = a.clientSubmitTimestamp || toTimestamp(a.createTime);
      return bTime - aTime;
    })
    .slice(0, limit)
    .map(normalizeScoreHistoryRecord);

  return {
    list: historyList,
    total: historyList.length,
    recordCollectionName
  };
}

// 云函数入口函数
exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const runtimeEnvVersion = event && event.runtimeEnvVersion;
  const loginUserCollectionName = resolveLoginUserCollectionName(event);
  const action = (event && event.action) || 'login';
  const toolKey = event && event.toolKey;

  console.log('[login] 动作:', action, '| 环境:', runtimeEnvVersion || 'unknown', '| 用户集合:', loginUserCollectionName);

  try {
    // 读取工具偏好：用于页面初始化时按 openid 回填用户上次选择
    if (action === 'getToolPreference') {
      const preferenceResult = await getToolPreference(loginUserCollectionName, wxContext, toolKey);
      return {
        success: true,
        action,
        openid: wxContext.OPENID || '',
        loginUserCollectionName,
        toolKey: toolKey || '',
        preference: preferenceResult.preference,
        updatedAt: preferenceResult.updatedAt,
      };
    }

    // 保存工具偏好：用于在用户切换省份/项目时把偏好持久化到当前 openid 对应用户记录
    if (action === 'saveToolPreference') {
      const savePreferenceResult = await saveToolPreference(
        loginUserCollectionName,
        wxContext,
        runtimeEnvVersion,
        toolKey,
        event && event.preference
      );
      return {
        success: true,
        action,
        openid: wxContext.OPENID || '',
        loginUserCollectionName,
        toolKey: toolKey || '',
        preference: savePreferenceResult.preference,
        updatedAt: savePreferenceResult.updatedAt,
      };
    }

    // 清空工具偏好：用于用户主动删除自己的默认项目选择，不影响其他工具和登录资料
    if (action === 'clearToolPreference') {
      const clearPreferenceResult = await clearToolPreference(
        loginUserCollectionName,
        wxContext,
        runtimeEnvVersion,
        toolKey
      );
      return {
        success: true,
        action,
        openid: wxContext.OPENID || '',
        loginUserCollectionName,
        toolKey: clearPreferenceResult.toolKey || '',
        cleared: !!clearPreferenceResult.cleared,
      };
    }

    // 读取查分历史：用于“我的”页面按当前 openid 展示最近查分记录
    if (action === 'getScoreHistory') {
      const historyResult = await getScoreHistory(wxContext, runtimeEnvVersion, event);
      return {
        success: true,
        action,
        openid: wxContext.OPENID || '',
        recordCollectionName: historyResult.recordCollectionName,
        total: historyResult.total,
        list: historyResult.list
      };
    }

    // 默认 login 动作保持原有行为不变，继续负责静默登录和用户记录 upsert
    const saveResult = await upsertLoginUserRecord(loginUserCollectionName, wxContext, runtimeEnvVersion);

    return {
      success: true,
      action,
      openid: wxContext.OPENID,
      appid: wxContext.APPID,
      unionid: wxContext.UNIONID,
      loginUserCollectionName,
      recordId: saveResult.recordId,
      isNewUser: saveResult.isNewUser,
    };
  } catch (err) {
    console.error('[login] 登录用户写库失败:', err.message);
    return {
      success: false,
      message: action === 'login' ? '获取登录信息失败' : '处理用户数据失败',
      action,
      error: err.message,
      openid: wxContext.OPENID || '',
      appid: wxContext.APPID || '',
      unionid: wxContext.UNIONID || '',
      loginUserCollectionName,
    };
  }
};
