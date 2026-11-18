# 验收记录（v0.2.0）

本文件记录**实际执行过**的验证，以及无法自动验证、需要人工确认的项目。数字来自命令输出与 CI 日志，不做估算。

## 0. P0 根因与证据

「开启 VPN / 系统代理时 EXE 打不开」的真因不是 VPN，而是**发布构建漏了 `custom-protocol` 特性**：

- Tauri 2 的 `tauri::is_dev()` 实现是 `!cfg!(feature = "custom-protocol")`。
- 0.1.0 用 `cargo build --release` 构建、未开该特性 → 产物自认开发模式 → `generate_context!` 走 `devUrl`，
  窗口导航到 `http://localhost:5183`，便携包里没有 Vite 服务器，于是显示「localhost 无法连接」。
  关掉 VPN 也一样失败，VPN 只是让失败更早被看见。

**修复前探针输出**：`probe: url=Ok("http://localhost:5183/")`
**修复后**：`frontend_ready: phase=mounted payload={"domNodes":160,"textChars":838,"navItems":7,...}`

修复手段（详见 `docs/Release-Notes.md`）：Cargo 增加 `custom-protocol` 特性、CI 显式 `--features custom-protocol`、
启动时若仍是 dev 模式则写 FATAL 日志并由冒烟测试直接判失败；另加 WebView2 进程级直连
（`--proxy-server=direct://`）、`--disable-gpu`、启动诊断文件与 `--diagnose` 模式。

## 1. 自动化验证

| 项目 | 命令 / 位置 | 结果 |
|---|---|---|
| TypeScript 类型检查 | `npx tsc -b` | 通过，0 error |
| ESLint | `npx eslint .` | 通过，0 error 0 warning |
| 单元测试 | `npx vitest run` | 95 passed（6 个文件） |
| 课程内容校验 | `npx tsx scripts/validate-content.ts` | ✓ content valid；12 周 / 84 课 / 423 卡 / 559 题 / 206 词素 / 473 词条 / 35 概念 |
| 占位页检查 | `npm run check:stubs` | 通过 |
| 前端生产构建 | `npm run build` | 通过 |
| Rust 单元测试 | CI `cargo test --all-targets` | 通过（迁移、统计、快照导出导入） |
| Rust 检查 | CI `cargo check` | 通过；clippy 为 advisory（非发布门禁，取舍见工作流注释） |
| 打包冒烟（8 场景） | `scripts/smoke-test.ps1` | 见第 2 节 |
| Windows 便携构建 | GitHub Actions `portable-windows.yml` | 见第 3 节 |

## 2. 代理 / 路径场景矩阵

每个场景用全新解压副本，断言四件事：
① `frontend-ready.json` 出现且 `domNodes>20 && textChars>200`（真实渲染）；
② `data/wordroots.db` 非空；
③ `contentSource=external`（测得是要发布的课程包，不是内置兜底）；
④ 自检场景 `selftest.json` 的 `ok=true` 且作答数增加（真实交互）。

| # | 场景 | 构造 | 结果 |
|---|---|---|---|
| 1 | 无代理基线 | 清空 HTTP(S)/ALL_PROXY | 通过 |
| 2 | 死 HTTP 代理 | `HTTP_PROXY=HTTPS_PROXY=http://127.0.0.1:9` | 通过 |
| 3 | 死 SOCKS5 | `ALL_PROXY=socks5://127.0.0.1:9` | 通过 |
| 4 | 系统代理（WinINET） | 注册表 `ProxyEnable=1`、`ProxyServer=127.0.0.1:9`，结束恢复原值 | 通过 |
| 5 | PAC 自动配置 | 追加 `AutoConfigURL=http://127.0.0.1:9/proxy.pac` | 通过 |
| 6 | 中文 + 空格路径 | `%TEMP%\便携 测试 <rnd>\` | 通过 |
| 7 | 换路径二次启动 | 复制整目录到另一路径再启动，db 大小变化 ≤ 1 页 | 通过 |
| 8 | `--diagnose` | `startup-cli.json` 含 `wininet` + `webview2` | 通过 |

## 3. CI 与发布

- CI（typecheck / lint / test / content / build）与便携构建 + 8 场景冒烟：见 GitHub Actions 最新成功运行。
- 冒烟为**发布门禁**：失败时 `Publish immutable release` 被跳过（可在运行记录中核对 step 状态）。
- 发布只在 tag 上创建，`tag == v + package.json.version`，同名 release 已存在即失败，不再覆盖。

## 4. 本地实测（真实 Windows 11 桌面，非 CI）

| 测试 | 方法 | 结果 |
|---|---|---|
| 死代理启动 | `HTTP_PROXY/HTTPS_PROXY=http://127.0.0.1:9`、`ALL_PROXY=socks5://127.0.0.1:9` | 进入界面；自检 15 步、6 次作答、完成 1 课 |
| 渲染证据 | `app-data/logs/frontend-ready.json` | `domNodes=160, textChars=838, navItems=7` |
| 交互证据 | `app-data/logs/selftest.json` | `ok=true, attempts 0→6, completed 0→1, sawFeedback=true` |
| `--diagnose` | 命令行运行 | 生成 `startup-cli.json`（含 WebView2 运行时版本） |
| 便携目录 | 含中文与空格的路径 | 数据写在程序目录内，重启后仍在 |
| 课程包 | 打包 ZIP | 84 个 `day*.json`、12 周目录、`courses/manifest.json`（dayCount=84） |

## 5. 判题、计时、FSRS、数据

- Word Sum：必须 ≥2 个词素；集合、顺序、边界、拼写规则（去 e / y→i / 双写 / 同化）逐项校验。
  整词、词素错、顺序错、规则错给出不同反馈；照抄卡片里的 `a + b → word` 写法也能正确解析。
- 计时：只累计「可见且聚焦」的时间，单段上限 180 秒；阅读/练习/复习分别计时并写入 `attempts.duration_ms`。
- 统计曾恒为 0 分钟，真因是 SQL 查了 `attempt.elapsed_ms`（该表列名是 `duration_ms`）且异常被
  `unwrap_or(0)` 吞掉；已修并加 Rust 回归测试。
- FSRS：与 `ts-fsrs` 逐次比对 250 次复习，S 最大相对误差 < 1e-6、state 全部一致；期间修正 D0 公式、
  难度阻尼与稳定性更新所用的 D。
- 备份：导出含设置/进度/卡片/复习/作答/笔记/收藏 + `counts` 校验；导入先校验、再自动 pre-import 备份、
  后事务写入；v1 备份导入 v2 结构自动补默认值。

## 6. 未真实验证的项目（明确保留）

1. **真实 Clash Verge（系统代理 + TUN 同时开启）**：CI 只能模拟代理配置与死端口，TUN 的包级拦截无法在
   托管 runner 上复现，需用户本机双击实测。
2. 真实 SOCKS5 服务端（非死端口）行为。
3. 高 DPI 缩放（125%/150%）与多显示器布局。
4. v0.1.0 → v0.2.0 **真实二进制覆盖升级**（迁移逻辑与备份有测试，未在旧版真实数据上跑）。
5. 企业 PAC 脚本的真实求值（只验证了死 PAC 不影响启动）。
6. 数小时连续使用的计时精度与内存占用。
