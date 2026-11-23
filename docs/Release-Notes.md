# WordRoots 0.12.1

**三处 P0：双击不再可能弹出控制台、Word Sum 不再把未核验结构当标准答案、探究进度不再有丢失窗口。**
上一版见 [`releases/v0.12.0.md`](v0.12.0.md)。

## 一、P0：控制台窗口（根因 + 门禁）

### 根因

入口写的是 `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]`——
**只在关闭 debug_assertions 的构建里**才是 GUI 子系统。任何带断言的构建（`cargo build` 不带 `--release`、
自定义 profile、本地打包）产出的都是 **CONSOLE 子系统** 的可执行文件，
Windows 会在 `main()` 执行前就给它分配控制台窗口。程序内部无论怎么隐藏都没用，
因为窗口在代码运行之前就出现了。

排查过的其他可能，都不是原因：

| 排查项 | 结论 |
| --- | --- |
| 子进程（`reg.exe` 读代理设置） | 早已用 `CREATE_NO_WINDOW` |
| `explorer.exe` 打开数据目录 | GUI 程序，不建控制台；本轮也补上了 `CREATE_NO_WINDOW` |
| 程序自己往 stdout 写 | 全仓库没有一处 `println!`/`eprintln!`，日志只写 `app-data/logs/wordroots.log` |
| 启动器 / 脚本 | 便携包直接放 `WordRoots.exe`，没有 .bat/.cmd 包装 |
| Debug 与 Release 差异 | 就是这个差异——即根因本身 |

### 修复

1. 子系统改为 `#![cfg_attr(not(test), windows_subsystem = "windows")]`：
   **所有给用户的二进制都是 GUI 子系统**，只有 `cargo test` 的测试宿主保留 stdout。
2. `explorer` 子进程补 `CREATE_NO_WINDOW`，让"每个子进程都隐藏"成为可检查的不变量。
3. 新增 `scripts/check-window-mode.ps1`：
   - 直接读 PE 头里的 `Subsystem`（2=GUI，3=控制台）；
   - 连续启动两次，每 100ms 枚举**可见**的 `ConsoleWindowClass` / `PseudoConsoleWindow` /
     `CASCADIA_HOSTING_WINDOW_CLASS` 窗口，与启动前的基线做差集。
   **conhost.exe 存在不算失败**，只有"出现可见控制台窗口"才算。
4. 两道门禁：
   - 构建阶段 `-SubsystemOnly`：编译完立刻查 PE 头，几秒内失败，不必等打包；
   - 冒烟场景 13：在正式 ZIP 上启动两次并观察窗口。

### 验收（本地已验证探针本身）

| 目标 | 结果 |
| --- | --- |
| `notepad.exe`（GUI） | `subsystem: 2`，两次启动 0 个控制台窗口 |
| `cmd.exe`（控制台） | `subsystem: 3`，退出码 1，报"会给控制台程序开窗" |

正式 EXE 的结果由 CI 场景 13 在真实 Windows Runner 上跑出，未通过则阻断发布。

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
