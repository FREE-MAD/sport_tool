# [OPEN] login-id-set-error

## 现象
- 生产与测试环境的 `saveToolPreference` 都写库失败。
- 运行时日志报错：`document.set:fail -501007 invalid parameters. 不能更新_id的值`

## 当前证据
- 日志显示动作为 `saveToolPreference`
- 日志显示集合选择正常：`realenvironment_tool_loginuser`
- 失败点发生在云数据库写入阶段，不是集合分流阶段

## 可证伪假设
1. `doc(openid).set({ data })` 时，`data` 内部仍包含 `_id` 字段，云数据库禁止显式更新 `_id`，因此直接报错。
2. 新的 `_id=openid` 改造与旧文档兼容逻辑同时生效，导致对已有文档执行了“变更 `_id`”语义的写入。
3. `saveToolPreference` 先调用 `upsertLoginUserRecord()`，而该函数在生产和测试环境都走了同一段 `set` 逻辑，因此两个环境同时报同类错误。
4. 报错与数据库连接本身无关，真正的问题是请求参数非法，所以看起来像“关联不到数据库”，实质是写入 payload 不合法。

## 下一步
- 核对 `login/index.js` 中 `upsertLoginUserRecord()` 的 `doc(openid).set()` payload。
- 仅在证据确认后做最小修复，并重新进行语法校验。
