// app.js
App({
  onLaunch() {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: "cloud1-6gh7jgl8c5b16a83",
        traceUser: true,
      });
    }
  },
});
