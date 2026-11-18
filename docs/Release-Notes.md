# WordRoots 0.2.0

修复「开启 VPN / 系统代理时 EXE 打不开」的核心故障，并把上一轮代码审查发现的问题逐项修掉。
本次发布**更换了发布流程**：只从 `v0.2.0` 标签的固定提交构建，同一个版本不再覆盖重发。

## 修复

### 启动（P0）

- **WebView2 强制直连**：通过 `additionalBrowserArgs` 让应用内的浏览器控件绕过系统代理
  （`--proxy-server=direct:// --proxy-bypass-list=*`）。只作用于本进程，不修改也不依赖系统代理设置，
  因此 Clash / v2ray / 公司 PAC / TUN 模式都不再影响启动。
- **启动可诊断**：新增 `app-data/logs/startup-boot.json`、`startup-failed.json`，
  记录代理环境变量、WinINET 注册表项、WebView2 运行时版本、便携目录与 WebView2 用户数据目录。
  新增 `WordRoots.exe --diagnose` 命令行模式。
- **失败可见**：前端 12 秒内未上报挂载，窗口标题会变为「启动异常（请查看 app-data/logs）」并写
  `STARTUP-FAILED.txt`，而不是留一个白屏。
- **渲染有证据**：前端挂载后通过 IPC 回报 `domNodes` / `textChars` / 路由，写入
  `frontend-ready.json`；打包冒烟测试以此为准，不再以「生成了 SQLite 文件」当作启动成功。

### 打包与发布

- **课程真正进包**：此前 `courses/weeks` 因复制模式不递归而为空。现在递归复制并断言
  **12 周 / 84 天**、每周 7 天、词库 3 个文件、ZIP 内 84 个 `day*.json`，任一不满足直接失败。
- **课程包清单**：随包生成 `courses/manifest.json`（contentVersion、schemaVersion、gitCommit）与
  `BUILD-INFO.json`。
- **外部课程加载**：程序目录 `courses/` 的课程包与本程序 schema 一致且完整时才会替换内置课程，
  否则回退内置并记录原因；设置页显示当前课程来源与版本。
- **不可变发布**：release 只在 tag 上创建，要求 `tag == v + package.json.version`，
  已存在同名 release 直接失败，不再 `--clobber`。
- **冒烟测试成为发布门禁**：去掉 `continue-on-error`。

### 判题与统计

- **Word Sum 堵住整词绕过**：必须切成 ≥2 个词素，顺序、边界、拼写规则（去 e / y→i / 双写 / 同化）
  全部校验；直接输入整词、词素错、顺序错、规则错分别给出不同反馈。
- **统计 SQL 修复**：总时长与每日时长原先查询 `attempt.elapsed_ms`（该列名只存在于
  `lesson_state` / `review`），错误被 `unwrap_or(0)` 吞掉，导致学习时长恒为 0；改为 `duration_ms` 并加回归测试。
- **真实计时**：按「可见且聚焦」累计，单段空闲上限 180 秒，阅读 / 练习 / 复习分别计时。
- **FSRS 交叉验证**：与参考实现 `ts-fsrs` 就同一串评分比对 S / D / state / due。

### 数据

- **完整备份恢复**：导出包含设置、进度、卡片、复习、作答、笔记、收藏，带 `counts` 与版本号；
  导入先校验、再自动生成 pre-import 备份、最后在事务中写入。
- **数据库 schema v2**：新增 `lesson_state.last_seen_at` 与三个索引；迁移前自动备份，
  迁移幂等，v1 数据完整保留（有 Rust 单测）。

### 安全

- **CSP 收紧**：从 `null` 改为 `default-src 'self'` 白名单，关闭未使用的 asset 协议。
- **文件读取越界修复**：`read_course_file` 现在拒绝绝对路径、`..`、非 `.json`，并做规范化前缀校验。

### 课程内容

- 两周审校覆盖 84 天课程：词源与共时构词区分、年份（发现 / 命名 / 首见文献）、
  缩略词与混成词分类、练习答案与解析。
- 重点修正：`hydrogen` 命名年份统一为 **1787**（Lavoisier 团队《Méthode de nomenclature chimique》，
  1766 为 Cavendish 发现）；`LASIK` 归类为 **acronym**（可读 /ˈleɪsɪk/），不是混成词。

## 已知限制

- 真实 Clash Verge / TUN / SOCKS5 的用户环境无法在 CI 中复现：CI 用注册表模拟系统代理、
  PAC 与死代理端口验证可自动化部分，真实 VPN 场景仍需人工实测。
- 高 DPI 缩放、跨版本覆盖安装（v0.1.0 → v0.2.0 的真实二进制）仍需人工确认。

完整证据与未验证项见 `docs/VERIFICATION.md`。
