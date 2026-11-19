# WordRoots 0.4.1

本版不增加功能，只保证 0.4.0 **能被正确地打出来、装出来、验出来**。
上一个版本源码没问题，但便携包在 CI 的「Assemble portable folder」一步失败：
打包脚本断言「每周必须正好 7 个课时」，而 0.4.0 新增的 C9/C11 是两个 6 天的周。
0.4.0 的内容说明见 [`releases/v0.4.0.md`](releases/v0.4.0.md)。

## 打包校验：从"数量够"改为"逐项对得上"

旧的校验只能发现"少了大半"的灾难，发现不了"少了一课"、"某周被复制两次"、
"lesson id 与文件夹对不上"。现在有一个唯一的课程清单：

`src/content/course-index.json`（由 `scripts/build-course-index.mjs` 生成）列出
16 周、110 课、每课 id/周/日、卡片与练习数量。打包时逐项比对：

| 检查 | 旧行为 | 新行为 |
| --- | --- | --- |
| 周数 | ≥ 12 | 等于索引的 16，且周目录名与 `meta.week` 一致 |
| 课时数 | ≥ 84 | 等于索引的 110 |
| 每周课时 | 恰好 7 | 5–7，且日号连续、文件名与 `lesson.day` 一致 |
| 课程内容 | 不查 | 每课必须有 14 个必备字段、卡片 ≥4、练习 ≥4、apply ≥1、每题有 `explain`、时长 24–28 分钟 |
| 词库 | 只看文件在不在 | 四份 JSON 必须能解析；`forms.json` 与 `morphemes.json` 双向可达（不能有孤儿词素，也不能指向不存在的 ID） |
| manifest | 不校验 | `weekCount`/`dayCount` 必须等于索引与目录实际数量 |
| ZIP | 只数课时 | 逐课核对条目名、周目录数、词库与 manifest 条目，并拒绝任何 epub/pdf |

清单过期会被 CI 拦下：`npm run validate:course-index` 已成为 CI 的一个步骤，
加了课却忘记重新生成索引会直接失败，而不是等到打包。

## 顺带修掉的三个打包缺陷

1. **stale 断言**：「每周 7 课」写死在脚本里，与课程设计脱节（本版根因）。
2. **BOM**：`Out-File -Encoding utf8` 在旧版 PowerShell 会写 BOM，`manifest.json` 带 BOM 后
   `JSON.parse` 直接抛错。改为 UTF-8 无 BOM 写入，并让校验脚本容忍 BOM。
3. **ZIP 路径分隔符**：`Compress-Archive` 在 Windows 上记录的是反斜杠，
   而校验用的是正斜杠，两者永不相等——这条在 0.4.0 里被前一个错误挡住，没暴露出来。
   现在统一归一化后再比对。

这三条都是"一旦失败就永远通过不了"的静默问题，值得写进发布门禁而不是靠人盯。

## 版本与文档

- 版本号统一为 `0.4.1`（`package.json` / `tauri.conf.json` / `Cargo.toml` / `Cargo.lock`）。
- 新增 [`RELEASE-STATUS.md`](RELEASE-STATUS.md)：把「已开发 / 已测试 / 已发布 / 用户环境已验证」
  四件事分开记录，避免把"代码写完"当成"已经交付"。
- 教材覆盖率报告随源码重新生成（`docs/TEXTBOOK_COVERAGE.md`、`docs/coverage.json`）。

## 验证

- `tsc` / `eslint` / `vitest`（9 文件 163 条）/ `validate:content` / `validate:course-index` / `vite build` 全绿。
- 本地用桩 exe 跑通完整打包：`course check ok: weeks 16, lessons 110` →
  `package matches index` → `zip verified: 141 entries, 110 lessons`。
- Windows 真机验收（EXE 启动、代理场景、C9/C11 可答题、记录持久化、换路径迁移）
  由 CI 的 `portable-windows.yml` 执行，结果记录在 `RELEASE-STATUS.md`。

## 已知缺口

与 0.4.0 相同，未在本版处理：L5/L6 覆盖 30%/11%、L7 仅 4%、
328 个词条 `unresolved`、同源异形（`cap`/`cept`）未合并为一个词素。
