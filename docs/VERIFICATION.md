# 验收记录（v0.1.0）

本文件记录**实际执行过**的验证，以及无法自动验证、需要人工确认的项目。数字均来自命令输出与 CI 日志，
不做估算。

## 1. 自动化验证

| 项目 | 命令 / 位置 | 结果 |
|---|---|---|
| TypeScript 类型检查 | `npx tsc -b` | 通过，0 error |
| ESLint | `npx eslint .` | 通过，0 error 0 warning |
| 单元测试 | `npx vitest run` | 37 passed |
| 课程内容校验 | `npx tsx scripts/validate-content.ts` | ✓ content valid；12 周 / 84 课 / 423 卡片 / 559 练习 / 206 词素 / 473 词条 / 35 概念 |
| 占位页检查 | `npm run check:stubs` | 通过（无 STUB 页面） |
| 前端生产构建 | `npm run build` | 通过（dist 约 930 KB JS / 13 KB CSS） |
| Rust 后端检查 | CI `cargo check` + `cargo clippy` | 通过（clippy 非阻塞） |
| 端到端页面渲染 | `node scripts/ui-smoke.mjs` | 12 条路由全部渲染，无运行时异常 |
| 端到端学习流程 | `node scripts/e2e-session.mjs` | 完成 3 课、18 次作答、60 次复习评分、24 张卡片；刷新后记录仍在 |
| Windows 便携构建 | GitHub Actions `portable-windows.yml` | 全 14 步成功，含启动冒烟测试 |
| 发布 | GitHub Release `v0.1.0` | ZIP 2,052,220 字节 + SHA256 文件 |

CI：<https://github.com/alexrwaa/Englishlearning-WordRoots/actions/runs/44109990347>
构建：<https://github.com/alexrwaa/Englishlearning-WordRoots/actions/runs/44109990342>
发布：<https://github.com/alexrwaa/Englishlearning-WordRoots/releases/tag/v0.1.0>

## 2. 便携式存储实测（本机 Windows 11 x64）

从 Release 下载 ZIP 解压后：

1. **含空格与中文的路径** `…\portable-test\便携 测试\WordRoots.exe` 正常启动。
2. 启动后程序目录内生成：
   - `data/wordroots.db`（SQLite，WAL 模式）
   - `app-data/logs/wordroots.log`：`WordRoots starting` / `schema migrated to v1`
   - `app-data/cache/webview2/EBWebView`（8.9 MB）——WebView2 用户数据目录被重定向到程序目录内
3. `%LOCALAPPDATA%\com.wordroots.learning` 只出现一个 **0 字节空目录**，没有任何学习数据或缓存写入。
4. **迁移测试**：把整个 `便携 测试` 文件夹复制为 `移动 测试`，从新路径启动 →
   日志只出现 `WordRoots starting`（无重复迁移），`data/wordroots.db` 可读，`PRAGMA` 查询得到
   `schema_version = 1`、10 张表。学习记录随文件夹迁移。
5. **重启测试**：同一目录二次启动不重新建库、不重复迁移。

## 3. 发布包内容核对

`WordRoots-Portable-Windows-x64.zip` 解压后：

```
WordRoots/
├── WordRoots.exe          4,561,920 bytes
├── README.txt
├── data/                  空（首次启动建库）
├── courses/weeks/*.json   84 个课程文件
├── courses/lexicon/*.json 词库
├── app-data/{cache,config,logs}
└── backups/
```

`scripts/package-portable.ps1` 在打包时校验：ZIP 中必须含 `WordRoots/WordRoots.exe`，且不得含
`.epub` / `.pdf`（防止版权教材被打包）。

本机下载该 ZIP 后的 SHA-256：`1c53dd2fe1b101a52db0bec0c2ee252c4a8fe9db8b113cd42ea4e3ac59edf210`
（与 Release 页 `WordRoots-SHA256.txt` 同源生成，后者由构建作业计算）。

## 4. 未能自动验证的项目（如实标注）

| 项目 | 原因 | 现状 |
|---|---|---|
| 真实点击/拖拽等 GUI 交互 | GitHub Actions Windows Runner 无交互桌面，本机自动化也无法稳定驱动 Tauri 窗口 | 在浏览器中以同一份前端代码完成端到端点击流程（`scripts/e2e-session.mjs`），Tauri 侧仅验证启动与落盘 |
| 高 DPI / 多显示器缩放 | 需要人工在不同缩放比下目视 | 未验证 |
| WebView2 渲染差异 | CI 与本机版本可能不同 | 已在本机 WebView2 上启动成功；细节像素未比对 |
| 数据库损坏恢复路径 | 需要人为破坏 DB 文件 | 代码中实现了“打开失败→改名为 `.corrupt-<ts>.db` →重建”的分支，但未在真实二进制上演练 |
| 升级覆盖安装 | 需要两个版本二进制 | 已实现 `schema_version` 迁移与迁移前自动备份；跨版本升级未实测 |
| 断网使用 | 需要断网环境 | 前端资源全部内置于 EXE，无运行时网络请求；未做真实断网演练 |

## 5. 课程内容质量抽查

自动校验覆盖：答案下标范围、选项去重、目标词必须出现在 infer 段落中、卡片正文最小长度、
占位文本检测、概念/词素引用完整性、矩阵词是否存在于词库、时长预算 15–35 分钟。

人工抽查（本次交付中执行的抽样）：

- 第 6 周 `hydrogen`：确认写作“1787 年拉瓦锡团队造的科学拉丁语”，未与古英语词根混为同源。
- 第 8 周 `island` / `debt` / `receipt`：确认为“拼写史人为插入的字母”，并明确“非词素、不发音”。
- 第 9 周 `robot`（捷克语 robota）、`tea`（闽南语经荷兰语）、`nice`（拉丁 nescius）：来源与语义路径一致。
- 第 11 周 `localization`：定位（机器人）与本地化（软件）两个义项分列，未合并。
- 词库 `token` / `gate` / `network` / `model`：`ety.note` 均说明现代义与历史来源的关系，未反向推导。

仍存在的风险：词源细节（尤其是年代、首见文献）依赖现代辞书的通行说法；个别传统词根分类（S4 来源）
仅作历史对照，已避免作为结论使用。
