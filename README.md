# sport_tool

体育招生考试评分工具项目，当前主线包含：

- 评分表数据整理与结构化
- 微信小程序查分页面
- 微信云函数查表评分
- 本地测试环境与线上正式环境区分

---

## 本轮重点更新说明

本次 README 重点补充以下 5 个方向，并把目前已经落地的实现细节写清楚：

1. 数据结构重构
2. 静默登录
3. 湖北数据
4. 提交方法封装
5. 防重复提交

---

## 1. 数据结构重构

这轮重构的核心目标，是把“评分规则”“省份开关”“数据库查表结构”三件事彻底拆开，避免继续把所有逻辑堆在一个大文件里，后续新增省份时也更容易扩展。

### 1.1 前端规则从单文件改为分省加载

原先规则主要集中在 `miniprogram/pages/tool/tool_f/rule2/rules.js`，这个文件现在保留为开发参考词典，不再作为运行时唯一入口。

当前运行时改为：

- `miniprogram/pages/tool/tool_f/rule2/distinguish_provinces_rule/index.js`
- `miniprogram/pages/tool/tool_f/rule2/distinguish_provinces_rule/001rule.js`
- `miniprogram/pages/tool/tool_f/rule2/distinguish_provinces_rule/002rule.js`
- `miniprogram/pages/tool/tool_f/rule2/provinceMap.js`

职责拆分如下：

- `provinceMap.js`
  - 只负责定义“这个省当前开放哪些大类/子类”
  - 控制项目是否启用、显示顺序、默认项
- `001rule.js`、`002rule.js`
  - 只负责该省份自己的详细规则
  - 包含主项、专项、辅项、分组、并行输入、计量单位、评分方向等定义
- `distinguish_provinces_rule/index.js`
  - 统一导出所有已接入省份规则
- `tool_f.js`
  - 根据当前所选省份动态加载规则，不再依赖一个全局大而全的规则对象

这样做之后，新增一个新省份时，理论上只需要补两层：

1. 在 `distinguish_provinces_rule/` 下新增对应省份规则文件
2. 在 `provinceMap.js` 中登记当前省份开放哪些项目

不需要再去全局大文件里到处改判断分支。

### 1.2 湖南规则支持二级分类和辅项

这次重构不只是“拆文件”，也是为了适配湖南这类更复杂的业务结构。

目前湖南已经支持：

- 主项编码，如 `1A`
- 专项编码，如 `1a / 2b / 3c / 4d / 5e`
- 辅项编码，如 `1aa / 2bb`
- 同一类型下的分组切换
- 专项与辅项合并提交到云函数统一评分

也就是说，现在前端已经不是单纯的“一个主项 + 一个专项”的固定结构，而是可以根据省份配置，动态生成表单结构。

### 1.3 数据库评分表改为“按 code 直查”

云函数 `cloudfunctions/sport_tool/sport_tool_fun1/index.js` 目前已经按扁平文档结构查表：

- 一条文档对应一个 `code`
- 通过 `where({ code })` 直接查询
- 单次请求内使用缓存，避免重复查同一条评分表

当前约定是：

- `tool_code`：正式环境评分集合
- `test_tool_code`：本地开发测试集合

这意味着数据库结构也从“嵌套式找表”逐步转向“扁平式按编码定位”，后面维护会轻很多。

### 1.4 不分性别编码也纳入统一规则层

部分项目数据库本身不分男女，因此前端不能继续拼出 `m` 或 `f` 编码，而要改成 `o`。

现在规则层支持通过 `genderless: true` 明确声明该项目为不分性别项目。当前已明确接入的例子包括：

- 广东排球：传球、垫球
- 广东乒乓球：左推右攻
- 湖南部分专项项目

这样前端编码生成时会自动把性别位修正为 `o`，避免查库命中不到数据。

---

## 2. 静默登录

本轮已经补上小程序启动阶段的静默登录，目标是让查分页面在真正提交前，就已经具备用户身份信息，而不是等用户点提交时再临时兜底。

### 2.1 启动时自动获取 openid

入口位于 `miniprogram/app.js`。

小程序启动后会：

1. 初始化云环境
2. 调用云函数 `login`
3. 获取并缓存：
   - `openid`
   - `appid`
   - `unionid`
   - `runtimeEnvVersion`
   - `loginUserCollectionName`

这一步对用户是无感的，不需要额外点击登录按钮，所以这里记为“静默登录”。

### 2.2 登录云函数同步写入用户记录

对应云函数位于：

- `cloudfunctions/sport_tool/login/index.js`

当前逻辑不是只返回 `openid` 就结束，而是会根据环境自动写入用户集合：

- 开发环境：`test_tool_loginuser`
- 正式环境：`realenvironment_tool_loginuser`

并且按 `openid` 做 upsert：

- 已有用户：更新时间
- 新用户：创建新记录

这样后续如果要做“历史记录”“用户行为统计”“按用户查提交记录”，基础数据已经有了。

### 2.3 提交前仍保留兜底登录能力

虽然 `app.js` 已经会在启动时拿一次 `openid`，但为了避免以下情况：

- 小程序刚启动时用户网络不稳
- 首次调用登录云函数失败
- `globalData` 丢失
- 本地缓存缺失

`miniprogram/utils/globalSubmit.js` 里仍然保留了 `ensureOpenId()` 兜底逻辑。

也就是说，现在是“双保险”：

- 启动时先静默登录
- 真正提交时再确认一次 `openid` 是否可用

这样能明显减少“用户已经填完表单，最后因为身份信息没拿到而提交失败”的情况。

---

## 3. 湖北的数据

这里单独说明一下当前状态，避免后面看 README 时误以为湖北已经前端上线。

### 3.1 当前湖北还没有正式接入运行时规则

目前 `distinguish_provinces_rule/index.js` 实际只导出了两个省份：

- `001` 广东
- `002` 湖南

同时 `provinceMap.js` 当前也只配置了：

- 广东省
- 湖南省

也就是说，从小程序运行时角度看，湖北目前还没有正式挂到省份选择和动态规则加载流程里。

### 3.2 湖北数据应放在哪一层

如果后续接入湖北，建议继续沿用这次重构后的分层方式：

1. 新增省份规则文件，例如 `003rule.js`
2. 在 `distinguish_provinces_rule/index.js` 注册导出
3. 在 `provinceMap.js` 增加湖北的项目启用配置
4. 数据库中准备湖北对应的扁平评分表文档，并保证每条文档存在唯一 `code`

这套方式能保证湖北不会再走回“写死在全局 rules.js 里”的老路。

### 3.3 湖北接入前需要确认的关键点

湖北数据正式接入前，至少要先确认以下内容：

- 主项、专项、辅项是否存在多层级编码
- 是否有不分性别项目
- 是否存在时间制项目
- 是否存在 `rule: false` 的直接给分项目
- 数据库 `code` 编码规则是否与广东/湖南同构
- 原始评分表是否已经按 `value` 与 `score` 对齐完成

如果这些前置不统一，前端虽然能先把省份按钮做出来，但提交到云函数后仍然会因为编码或数据结构不一致而查不到结果。

### 3.4 当前建议

湖北这部分现在更适合定义为：

- 数据整理/接入准备中
- 规则接入位已由本次架构重构预留完成
- 真正上线前只差规则文件、启用配置和数据库评分表三部分补齐

---

## 4. 提交方法封装

这次一个很重要的优化，是把“小程序提交云函数”这件事从业务页面里抽出来，统一封装到了：

- `miniprogram/utils/globalSubmit.js`

这不是简单的代码搬家，而是把提交流程标准化了。

### 4.1 统一解决了哪些问题

封装之后，一个页面发起云函数提交时，可以统一处理：

- 自动识别当前运行环境
- 自动补齐 `openid`
- 自动生成请求时间
- 自动生成客户端请求 ID
- 自动记录页面路由
- 自动生成提交指纹
- 自动做本地防重复提交
- 自动打印提交流转日志

这样业务页只需要关心两件事：

1. 我要调哪个云函数
2. 我要提交什么业务数据

其它通用问题都交给 `globalSubmit.js`。

### 4.2 当前 `tool_f.js` 的提交流程

在 `miniprogram/pages/tool/tool_f/tool_f.js` 中，页面在校验通过后，会先整理出：

- `mainData`
- `specialDataList`
- `auxiliaryDataList`
- `runtimeEnvVersion`

然后统一调用：

```js
submitCloudForm({
  name: 'sport_tool_fun1',
  data: callData,
  runtimeEnvVersion,
  lockKey: 'tool_f_submit',
  duplicateWindowMs: 5000,
  businessName: '体育查分表单提交',
  submitPageRoute: '/pages/tool/tool_f/tool_f',
  returnPageRoute: '/pages/tool/tool_f/tool_f_detailed/tool_f_detailed'
})
```

这意味着业务页面已经不再直接裸调 `wx.cloud.callFunction`。

### 4.3 封装后数据会自动附带提交元信息

`submitCloudForm()` 会在原始业务参数之外，再自动补一个 `__submitMeta`，当前包含：

- `clientSubmitAt`
- `clientSubmitTimestamp`
- `clientRequestId`
- `submitPageRoute`
- `submitLockKey`
- `submitFingerprint`
- `duplicateWindowMs`

云函数收到这些信息后，就能知道：

- 这次请求是谁发的
- 从哪个页面发起
- 大概在什么时间发起
- 是否与上一条请求内容完全相同

这对后续排查“重复提交”“页面跳转异常”“线上偶发失败”非常有用。

### 4.4 统一环境切换

`globalSubmit.js` 也统一封装了 `getRuntimeEnvVersion()`。

当前环境规则为：

- `develop` -> 查询测试集合
- 其它环境 -> 查询正式集合

对应云函数 `sport_tool_fun1` 会自动映射到：

- `test_tool_code`
- `tool_code`

这样做之后，前端页面本身不需要再手动区分“这次到底该查测试库还是正式库”。

---

## 5. 防重复提交

这部分这轮也专门做了收口，因为查分类场景很容易出现：

- 用户连续点两次按钮
- 页面还在 loading，用户以为没反应继续点
- 同一份内容短时间反复提交

如果不拦住，就会造成：

- 云函数重复执行
- `tool_records` 写入重复记录
- 用户看到多次结果，不知道哪次是有效的

### 5.1 前端正在执行时加锁

`globalSubmit.js` 内部使用 `inFlightSubmitMap` 做“提交中锁”。

逻辑是：

- 同一个 `lockKey` 正在执行时
- 后续再次点击会直接抛出 `DUPLICATE_SUBMIT`
- 页面提示“请勿重复提交”

同时，`tool_f.js` 页面也有自己的 `submitting` 状态，按钮会进入 loading 并禁用。

所以现在是两层保护：

- 页面按钮禁点
- 提交工具层再次加锁

### 5.2 相同内容在保护窗口内再次提交会被拦截

除了“同一时刻不能并发提交”，还增加了“短时间内相同内容不能重复提交”。

`submitCloudForm()` 会基于以下信息生成 `submitFingerprint`：

- 云函数名
- 业务名
- 提交页
- 返回页
- 环境
- openid
- 业务数据本身

然后结合 `recentCompletedSubmitMap` 记录最近一次成功提交时间。

当前默认保护窗口是：

- `5000ms`

也就是同一个用户、同一份内容、同一路由，在 5 秒内再次提交，会被本地直接拦截，不再打到云函数。

### 5.3 服务端防重目前先停用

云函数 `sport_tool_fun1` 里保留了 `findRecentDuplicateRecord()` 这个入口，但当前实现明确返回 `null`，也就是：

- 现在主防重在前端
- 服务端二次校验逻辑暂时停用

这样处理的原因也很现实：

- 先把前端重复点击这个高频问题压住
- 避免服务端“误判重复”影响正常提交
- 后面如果线上观察到还有重复写入，再恢复基于 `openid + submitFingerprint` 的服务端兜底方案

### 5.4 记录层已经预留了防重排查字段

虽然服务端硬拦截暂时停用，但写入 `tool_records` 时已经把这些字段落库了：

- `clientRequestId`
- `clientSubmitAt`
- `clientSubmitTimestamp`
- `submitPageRoute`
- `submitLockKey`
- `submitFingerprint`
- `duplicateWindowMs`
- `runtimeEnvVersion`

所以后面如果你要排查“到底有没有重复提交”“同一用户是不是连续点了多次”“开发环境和正式环境有没有串数据”，已经有基础数据可查。

---

## 当前目录中与本轮更新最相关的文件

### 小程序端

- `miniprogram/app.js`
- `miniprogram/utils/globalSubmit.js`
- `miniprogram/pages/tool/tool_f/tool_f.js`
- `miniprogram/pages/tool/tool_f/tool_f.wxml`
- `miniprogram/pages/tool/tool_f/rule2/provinceMap.js`
- `miniprogram/pages/tool/tool_f/rule2/distinguish_provinces_rule/index.js`
- `miniprogram/pages/tool/tool_f/rule2/distinguish_provinces_rule/001rule.js`
- `miniprogram/pages/tool/tool_f/rule2/distinguish_provinces_rule/002rule.js`

### 云函数端

- `cloudfunctions/sport_tool/login/index.js`
- `cloudfunctions/sport_tool/sport_tool_fun1/index.js`

---

## 历史更新日志

- 7.14 粗提取湖南 pdf-to-json。
- 7.11 处理 Git 仓库嵌套问题，删除外层 `sport/.git`，将 `dm/.git` 作为主仓库并使用 `master` 分支。
- 7.11 补充本地 Git 操作流程说明。
- 7.10 完成第一个页面 `index` 的 UI 设计。
- 6.30 `1.0.0` 初版：完成广东省份查分（游泳除外，健美操支持负数计算）。
