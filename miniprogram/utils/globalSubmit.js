const inFlightSubmitMap = Object.create(null);
const recentCompletedSubmitMap = Object.create(null);

function padNumber(value) {
  return String(value).padStart(2, "0");
}

function formatSubmitTime(date) {
  const year = date.getFullYear();
  const month = padNumber(date.getMonth() + 1);
  const day = padNumber(date.getDate());
  const hour = padNumber(date.getHours());
  const minute = padNumber(date.getMinutes());
  const second = padNumber(date.getSeconds());
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function buildClientRequestId(lockKey) {
  return `${lockKey}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getCurrentPageRoute() {
  try {
    const pages = getCurrentPages ? getCurrentPages() : [];
    const currentPage = pages && pages.length ? pages[pages.length - 1] : null;
    return (currentPage && currentPage.route) || "";
  } catch (err) {
    console.warn("[globalSubmit] 获取当前页面路由失败:", err && err.message);
    return "";
  }
}

function logSubmitStage(stage, payload) {
  try {
    console.log(`[globalSubmit][${stage}]`, JSON.stringify(payload, null, 2));
  } catch (err) {
    console.log(`[globalSubmit][${stage}]`, payload);
  }
}

function stableStringify(value) {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function hashString(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash) + text.charCodeAt(i);
    hash &= 0x7fffffff;
  }
  return hash.toString(36);
}

function buildSubmitFingerprint(payload) {
  return `fp_${hashString(stableStringify(payload))}`;
}

function getRuntimeEnvVersion() {
  try {
    const accountInfo = wx.getAccountInfoSync && wx.getAccountInfoSync();
    const miniProgram = accountInfo && accountInfo.miniProgram;
    return (miniProgram && miniProgram.envVersion) || "release";
  } catch (err) {
    console.warn("[globalSubmit] 获取 envVersion 失败，默认按 release 处理:", err && err.message);
    return "release";
  }
}

function syncOpenIdToApp(result) {
  const app = getApp && getApp();
  if (app && app.globalData) {
    app.globalData.openid = result.openid || "";
    app.globalData.appid = result.appid || "";
    app.globalData.unionid = result.unionid || "";
  }

  wx.setStorageSync("openid", result.openid || "");
  wx.setStorageSync("appid", result.appid || "");
  wx.setStorageSync("unionid", result.unionid || "");
}

function getCachedOpenId() {
  const app = getApp && getApp();
  const appOpenid = app && app.globalData ? app.globalData.openid : "";
  return appOpenid || wx.getStorageSync("openid") || "";
}

function requestOpenId(runtimeEnvVersion) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: "login",
      data: {
        runtimeEnvVersion,
      },
      success: (res) => {
        const result = res.result || {};
        if (!result.openid) {
          const err = new Error((result && result.message) || "未获取到 openid");
          err.code = "OPENID_EMPTY";
          reject(err);
          return;
        }

        syncOpenIdToApp(result);
        resolve(result.openid);
      },
      fail: (err) => {
        reject(err);
      },
    });
  });
}

function ensureOpenId(runtimeEnvVersion) {
  const cachedOpenid = getCachedOpenId();
  if (cachedOpenid) return Promise.resolve(cachedOpenid);
  return requestOpenId(runtimeEnvVersion || getRuntimeEnvVersion());
}

function submitWithLock(lockKey, executor) {
  if (inFlightSubmitMap[lockKey]) {
    const err = new Error("请勿重复提交");
    err.code = "DUPLICATE_SUBMIT";
    return Promise.reject(err);
  }

  inFlightSubmitMap[lockKey] = true;

  return Promise.resolve()
    .then(executor)
    .finally(() => {
      delete inFlightSubmitMap[lockKey];
    });
}

function submitCloudForm(options) {
  const opts = options || {};
  const runtimeEnvVersion = opts.runtimeEnvVersion || getRuntimeEnvVersion();
  const lockKey = opts.lockKey || opts.name || "global-submit";
  const submitPageRoute = opts.submitPageRoute || getCurrentPageRoute();
  const duplicateWindowMs = Number.isInteger(opts.duplicateWindowMs) && opts.duplicateWindowMs > 0
    ? opts.duplicateWindowMs
    : 5000;
  const submitDate = new Date();
  const submitMeta = {
    clientSubmitAt: formatSubmitTime(submitDate),
    clientSubmitTimestamp: submitDate.getTime(),
    clientRequestId: buildClientRequestId(lockKey),
    submitPageRoute,
    submitLockKey: lockKey,
  };
  const businessName = opts.businessName || opts.name || "未命名业务";
  const returnPageRoute = opts.returnPageRoute || "";

  return submitWithLock(lockKey, () => ensureOpenId(runtimeEnvVersion).then((openid) => {
    const submitFingerprint = buildSubmitFingerprint({
      cloudFunctionName: opts.name,
      businessName,
      submitPageRoute,
      returnPageRoute,
      runtimeEnvVersion,
      openid,
      data: opts.data || {},
    });
    const lastCompletedTime = recentCompletedSubmitMap[submitFingerprint] || 0;
    if (Date.now() - lastCompletedTime < duplicateWindowMs) {
      const err = new Error("请勿重复提交，相同内容正在保护期内");
      err.code = "DUPLICATE_SUBMIT";
      err.submitFingerprint = submitFingerprint;
      logSubmitStage("本地拦截重复提交", {
        fromPage: submitPageRoute,
        businessName,
        cloudFunctionName: opts.name,
        submitFingerprint,
        duplicateWindowMs,
        returnPage: returnPageRoute,
      });
      return Promise.reject(err);
    }

    const requestData = Object.assign({}, opts.data, {
      runtimeEnvVersion,
      openid,
      __submitMeta: Object.assign({}, submitMeta, {
        submitFingerprint,
        duplicateWindowMs,
      }),
    });

    logSubmitStage("本地提交开始", {
      fromPage: submitPageRoute,
      businessName,
      cloudFunctionName: opts.name,
      requestId: submitMeta.clientRequestId,
      submitAt: submitMeta.clientSubmitAt,
      submitFingerprint,
      duplicateWindowMs,
      returnPage: returnPageRoute,
    });

    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: opts.name,
        data: requestData,
        success: (res) => {
          recentCompletedSubmitMap[submitFingerprint] = Date.now();
          logSubmitStage("本地提交返回", {
            fromPage: submitPageRoute,
            businessName,
            cloudFunctionName: opts.name,
            requestId: submitMeta.clientRequestId,
            submitFingerprint,
            returnPage: returnPageRoute,
            response: res && res.result ? res.result : res,
          });
          resolve(res);
        },
        fail: (err) => {
          logSubmitStage("本地提交失败", {
            fromPage: submitPageRoute,
            businessName,
            cloudFunctionName: opts.name,
            requestId: submitMeta.clientRequestId,
            returnPage: returnPageRoute,
            error: err && err.message ? err.message : err,
          });
          reject(err);
        },
      });
    });
  }));
}

module.exports = {
  getRuntimeEnvVersion,
  ensureOpenId,
  submitCloudForm,
};
