// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 统一读取当前 openid 对应的登录用户记录，供登录、偏好读取、偏好保存复用
async function getLoginUserRecordByOpenid(collectionName, openid) {
  const collection = db.collection(collectionName);
  const queryRes = await collection.where({ openid }).limit(1).get();
  return (queryRes.data && queryRes.data[0]) || null;
}

function resolveLoginUserCollectionName(options) {
  const opts = options || {};
  if (opts.forceLoginUserCollectionName) return opts.forceLoginUserCollectionName;
  if (opts.useTestCollection === true) return 'test_tool_loginuser';
  if (opts.useTestCollection === false) return 'realenvironment_tool_loginuser';
  if (opts.runtimeEnvVersion === 'develop') return 'test_tool_loginuser';
  return 'realenvironment_tool_loginuser';
}

async function upsertLoginUserRecord(collectionName, wxContext, runtimeEnvVersion) {
  const openid = wxContext.OPENID || '';
  if (!openid) {
    throw new Error('未获取到 openid');
  }

  const collection = db.collection(collectionName);
  const existing = await getLoginUserRecordByOpenid(collectionName, openid);

  const payload = {
    openid,
    appid: wxContext.APPID || '',
    unionid: wxContext.UNIONID || '',
    runtimeEnvVersion: runtimeEnvVersion || 'release',
    lastLoginTime: db.serverDate(),
  };

  if (existing && existing._id) {
    await collection.doc(existing._id).update({
      data: payload,
    });
    return { recordId: existing._id, isNewUser: false };
  }

  const addRes = await collection.add({
    data: {
      ...payload,
      createTime: db.serverDate(),
    },
  });

  return { recordId: addRes._id, isNewUser: true };
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
  if (!existing || !existing._id) {
    throw new Error('未找到用户记录，无法保存偏好');
  }

  const nextToolPreferences = Object.assign({}, existing.toolPreferences || {}, {
    [toolKey]: {
      preference: preference || {},
      updatedAt: Date.now(),
      runtimeEnvVersion: runtimeEnvVersion || 'release',
    },
  });

  await db.collection(collectionName).doc(existing._id).update({
    data: {
      toolPreferences: nextToolPreferences,
      runtimeEnvVersion: runtimeEnvVersion || 'release',
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
  if (!existing || !existing._id) {
    throw new Error('未找到用户记录，无法清空偏好');
  }

  const nextToolPreferences = Object.assign({}, existing.toolPreferences || {});
  delete nextToolPreferences[toolKey];

  await db.collection(collectionName).doc(existing._id).update({
    data: {
      toolPreferences: nextToolPreferences,
      runtimeEnvVersion: runtimeEnvVersion || 'release',
      lastLoginTime: db.serverDate(),
    },
  });

  return {
    toolKey,
    cleared: true,
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
      message: action === 'login' ? '获取登录信息失败' : '处理用户偏好失败',
      action,
      error: err.message,
      openid: wxContext.OPENID || '',
      appid: wxContext.APPID || '',
      unionid: wxContext.UNIONID || '',
      loginUserCollectionName,
    };
  }
};
