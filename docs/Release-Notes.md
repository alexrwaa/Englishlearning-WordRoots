# WordRoots 0.12.1

**三处 P0：双击不再可能弹出控制台、Word Sum 不再把未核验结构当标准答案、探究进度不再有丢失窗口。**
上一版见 [`releases/v0.12.0.md`](v0.12.0.md)。

## 一、P0：控制台窗口（根因 + 门禁）

### 根因：是 WebView2 开的控制台，不是主程序

第一次在 CI 上实测就否掉了"主程序是控制台子系统"这个假设：ZIP 里的 `WordRoots.exe`
**已经是 GUI 子系统**（`subsystem=2 WINDOWS_GUI`）。

于是把"出现了控制台窗口"改成**先归属、再判断**：从窗口的属主进程沿父进程链上溯，
看 WordRoots 是否在这条链上。第二次实测拿到了决定性证据：

```
ours: msedgewebview2.exe(6544) <- WordRoots.exe(2120)
```

**控制台窗口属于 `msedgewebview2.exe`——我们自己的子进程。**
原因是浏览器参数里带着 `--enable-logging`：Chromium 要写日志，而进程没有控制台，
就会**自己分配一个**。所以无论怎么改主程序的子系统、怎么藏自己的窗口，那个黑框都还在，
因为它是 WebView2 的次级进程开的。

| 排查项 | 结论 |
| --- | --- |
| 主程序子系统 | 已是 GUI，**不是**原因；但仍是潜在坑（见下） |
| `--enable-logging` | **真正原因**：Chromium 无控制台时自行分配一个 |
| 子进程（`reg.exe` 读代理设置） | 早已用 `CREATE_NO_WINDOW` |
| `explorer.exe` 打开数据目录 | GUI 程序；本轮也补上 `CREATE_NO_WINDOW` |
| 程序自己往 stdout 写 | 全仓库没有一处 `println!`/`eprintln!`，日志只写 `app-data/logs/wordroots.log` |
| 启动器 / 脚本 | 便携包直接放 `WordRoots.exe`，没有 .bat/.cmd 包装 |

### 修复

1. **从两处浏览器参数里删掉 `--enable-logging`**（`main.rs` 的 `BROWSER_ARGS` 与 `tauri.conf.json`）。
   诊断不依赖它：`startup.json`、`wordroots.log` 都是我们自己的代码写的。
2. 子系统顺手收紧为 `#![cfg_attr(not(test), windows_subsystem = "windows")]`：
   原来的 `not(debug_assertions)` 意味着**任何带断言的构建**（`cargo build` 不带 `--release`、
   自定义 profile）都会产出控制台程序，是另一个独立的坑，一并堵上。
3. `explorer` 子进程补 `CREATE_NO_WINDOW`，让"每个子进程都隐藏"成为可检查的不变量。
4. 新增 `scripts/check-window-mode.ps1`：
   - 读 PE 头的 `Subsystem`（2=GUI，3=控制台）；
   - 连续启动两次，每 100ms 枚举**可见**的 `ConsoleWindowClass` / `PseudoConsoleWindow` /
     `CASCADIA_HOSTING_WINDOW_CLASS` 窗口；
   - **对每个窗口做归属判定**：属主进程沿父链上溯，链上有 WordRoots 才算我们的。
     别人的控制台照实打印链，但不判失败。
   **conhost.exe 存在不算失败**；别人开的控制台也不算。
5. 两道门禁：
   - 构建阶段 `-SubsystemOnly`：编译完立刻查 PE 头，几秒内失败，不必等打包；
   - 冒烟场景 13：在正式 ZIP 上启动两次并观察窗口，按归属判定。

### 验收

| 目标 | 结果 |
| --- | --- |
| `notepad.exe`（GUI） | `subsystem: 2`，两次启动 0 个控制台窗口 |
| `cmd.exe`（控制台） | `subsystem: 3`，退出码 1，报"会给控制台程序开窗" |
| 便携包 `WordRoots.exe` | CI 场景 13：`subsystem=2`，归属判定 `ours=0`（修复前为 `ours=2`，链为 `msedgewebview2.exe <- WordRoots.exe`） |

修复前的两次实测正好说明了为什么必须做归属：
第一次报"出现 2 个窗口"却查不出是谁的；加上归属后拿到父链，才定位到 WebView2。

## 二、P0：Word Sum 不再把未核验结构当标准答案

参考结构现在带 `analysis: { kind, verified, source }`：

| `kind` | 含义 | 能否自动判分 |
| --- | --- | --- |
| `synchronous` | 现代共时可分析 | 仅当 `verified: true` |
| `historical` | 历史借入/拉丁形态 | 否，判 `unverified` 并说明 |
| `analogical` | 教学拆分/助记 | 否 |
| `cognate` | 历史同源 | 否 |

**spectator**：现代切分改为 `spectate + -or`，`spect + -ator` 降为 `historical` 备选；
说明里明确"spectate 是由 spectator 逆构出来的动词，方向不能反过来讲"。

12 个词族全部扫描，结果写在 `docs/SUM_ANSWER_AUDIT.md`。

## 三、P0：探究进度不再丢

- **单飞 + 合并**：同一族同时只有一个写入，期间的修改合并成"待写最新值"，写完再补一次。
- **立即落盘**：关窗、页面隐藏、切族、卸载都立刻触发一次写；卸载时那次是尽力而为，
  未完成会记进日志，**不假装成功**。
- **序号**：每次修改递增 `revision`，只有 `savedRevision === currentRevision` 才显示"已保存"——
  上一笔的成功回调再也不能点亮新状态的"已保存"。
- 失败显示错误 + 重试；恢复备份后重读库，不沿用旧内存。

## 四、测试

**481 条**（27 文件），本轮新增 28 条：判题门禁 13、进度冲刷 15。

## 五、仍未完成

1. `borrowing-path` / `modern-structure` 仍无跨来源证据。
2. `classical-derivation`、`modern-sense` 仍为 0。
3. 题目级"点开提示"事件仍未埋点。
4. 用户环境（Clash Verge / TUN、便携迁移）验收未做。
5. 没有真人学习效果数据。
