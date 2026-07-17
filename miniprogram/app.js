// app.js
function getRuntimeEnvVersion() {
  try {
    const accountInfo = wx.getAccountInfoSync && wx.getAccountInfoSync();
    const miniProgram = accountInfo && accountInfo.miniProgram;
    return (miniProgram && miniProgram.envVersion) || "release";
  } catch (err) {
    console.warn("[app] 获取 envVersion 失败，默认按 release 处理:", err && err.message);
    return "release";
  }
}

App({
  globalData: {
    openid: "",
    appid: "",
    unionid: "",
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: "cloud1-6gh7jgl8c5b16a83",
        traceUser: true,
      });

      this.fetchOpenId();
    }
  },

  fetchOpenId() {
    const runtimeEnvVersion = getRuntimeEnvVersion();
    wx.cloud.callFunction({
      name: "login",
      data: {
        runtimeEnvVersion,
      },
      success: (res) => {
        const result = res.result || {};
        this.globalData.openid = result.openid || "";
        this.globalData.appid = result.appid || "";
        this.globalData.unionid = result.unionid || "";

        console.log("[app] openid:", this.globalData.openid);

        wx.setStorageSync("openid", this.globalData.openid);
        wx.setStorageSync("appid", this.globalData.appid);
        wx.setStorageSync("unionid", this.globalData.unionid);
        wx.setStorageSync("runtimeEnvVersion", runtimeEnvVersion);
        wx.setStorageSync("loginUserCollectionName", result.loginUserCollectionName || "");
      },
      fail: (err) => {
        console.error("获取 openid 失败", err);
      },
    });
  },
});
