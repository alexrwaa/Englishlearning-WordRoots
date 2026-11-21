# WordRoots 0.9.0

**这一版的核心是"证据能不能被复核"。** L7b 从 0 变成 14 个词素——每一个都带可重新抓取的词典
URL 与原文引文；测评历史从 WebView 的 localStorage 搬进 SQLite，并进入备份、恢复与便携迁移。
上一版见 [`releases/v0.8.0.md`](v0.8.0.md)。

> **关于 0.8.1**：原计划独立发布，但它的新冒烟场景当场抓到一个真 bug——词族档案面板在生产包里
> 从未渲染过（页面按词素 ID 查档案，档案却按族 ID 存放）。0.8.1 的修复（打包资源强制校验、
> 恢复 `w38d2` 场景、词族与测评冒烟、文档统计自动生成）因此并入 0.9.0 一起交付，
> 而不是先发一个"门禁能过但功能仍是坏的"版本。0.8.1 标签已删除，从未产生 Release。

## 一、词源核验：从"填了字段"到"可复核"

0.8.0 的 `documented` 只看"有没有来源字段"。0.9.0 把核验拆成五级，每条记录必须逐级通过：

| 级别 | 判据 | 当前 |
| --- | --- | --- |
| 来源已登记 | 来源 ID 在 `sources.json` 注册 | 211 / 211 |
| 已定位到具体条目 | 带可复现 URL 或教材页码 | 200 / 211 |
| 条目内容支持主张 | 存有原文引文且 `supports: true` | **14** |
| 独立来源交叉验证 | ≥2 个不同词条，或教材页 + 词典 | **14** |
| 审校者确认无疑义 | 署名校校者且非 conflict | 211 |

**L7b = 14 个词素**（0.8.0 是 0）。每个都来自实际抓取的 Wiktionary 原文，形如：

```
rx-spec  ·  inspect  ·  https://en.wiktionary.org/w/index.php?title=inspect&action=raw
quote: "From Latin inspectum … from in- + specio, specere 'to look at'"
```

任何人都能重新打开该 URL 核对。工具链：`scripts/merge-etymology-verification.mjs` 把记录并入
`reviews.json`，`scripts/audit-reviews.mjs` 按五级判定，两者都进 CI。

**核验过程中查出的真错**：

- `salary`「士兵买盐津贴」是流行说法，缺同时代文献支持 → 已改为争议说法并标注 `contested`。
- `cx-leg` 原把 `lex`（法）、`log`（说话）、`lig`（捆绑）并作同一词根的变体 → 已拆正，只保留
  `lex/leg`，并注明拉丁 `lēx`「法律」与 `legere`「读、选」同形不同源。
- `territory` 无法用该词素取证 → 改用 `terrain/terrestrial`，不硬凑。

## 二、词条状态：quizSafe 收紧

`quizSafe` 不再等于"成分都解析出来了"。现在要求：切分已核验 **且** 词源状态已知 **且** 无争议
**且** 没有真正缺失的词素记录。**1305 → 989**。

理由是：词源未知时，自动判题无法区分真分析与"看起来像"的分析；来源有争议时，系统可能把败方
判成正确答案。不被 `quizSafe` 的题仍可人工审阅或在课堂上讲解，只是不进自动评分。

## 三、测评数据进入 SQLite

- 新表 `assessment_runs`（`id / mode / item_bank_version / started_at / finished_at / duration_ms / payload / created_at`）。
- 首次启动把 `localStorage` 的历史一次性导入，写 `wordroots.assessment.migrated.v1` 标记；
  导入幂等，重复运行不产生重复行；旧数据保留作回滚。
- 损坏的单条 `payload` 不会拖垮启动：`assessment_list` 返回 `{runs, skipped}`，坏记录计数跳过。
- 导出/导入带上 `assessment_run`；旧备份（无该字段）仍可导入，不会清空历史。
- `item_bank_version` 随记录保存，换题后历史分数的解释依据仍在。

## 四、覆盖率（证据制，未改口径）

| 级别 | 数值 |
| --- | --- |
| L2 已关联 | 518 / 559（93%） |
| L4 例词充分 | 252（45%） |
| L5 有讲解 | 229（41%） |
| L6 有练习 | **211（38%）**（0.8.0 是 207） |
| L7 有审校记录 | 234（42%） |
| **L7b 独立交叉核验** | **9 / 559（2%）** |
| 知识点 | 283 / 283 |

L6 上升来自解析器修复（allomorphs 索引 + 证据优先），不是新增题目。

## 五、门禁

`migrate-word-status --check`（状态漂移）· `word-status-report --check`（文档与数据一致）·
`audit-reviews`（证据分级）· 课程索引 · 课程包一致性 · 课时负担 · 内容校验 · 275 条单测（13 文件）。

## 六、仍未完成

1. **L7b 只有 14 个词素**（9 个成分）。把 559 个成分全部核验是长期工作，本轮只做了高价值词根。
2. **S2 仍有 3 个 missing 概念、7 个 partial；S3 缺"从材料中自己发现问题"；S4 有 3 条旧说未隔离**
   （含 w29d2 两处强断言）。这些是课程写作，本轮未动。
3. **142 个 partial 词条**未逐条分类处理。
4. **没有学习效果实验**：只有可导出的结构化数据与测评工具。
5. 课标时长仍是同侪相对估算，没有真实完成耗时。
