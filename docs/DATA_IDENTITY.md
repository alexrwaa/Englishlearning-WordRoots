# 数据身份规范（v0.4）

词素（morpheme）是 WordRoots 的主键实体。它的身份必须满足三条，否则矩阵、词族、课程与统计
会各自用「拼写」当身份，同形异源必然被合并或指错。

1. **全局唯一**：一个 ID 只对应一个语言学实体（形式 + 语源 + 语义）。
2. **稳定**：ID 一旦分配就不再变；改名只允许追加别名，不允许重写历史 ID。
3. **可分派**：`form → [id...]` 是一对多；任何"用形式取词素"的地方都必须显式处理歧义。

## 1. ID 格式

```
{kind}-{form}            形式在全库唯一时（绝大多数，保持现状不变）
{kind}-{form}-{origin}   形式跨语源冲突时（如 plac：拉丁 'please' / 希腊 'flat'）
{kind}-{form}-{origin}-{n}  同形式同语源仍冲突时，按 gloss 排序编号
```

`kind`：`rx` 词根 / `px` 前缀 / `sx` 后缀 / `cx` 组合形式。

规则：
- 已有记录的 ID **不得重写**。冲突时，先出现的记录保留原 ID，后出现的加后缀。
- 任何重命名都必须写进该记录的 `legacyIds`，并由 `scripts/identity-migrate.ts` 生成迁移表。
- 冲突判定不靠人工：由 `form + origin + glossEn` 三元组决定，脚本可复算。

## 2. 记录字段

在现有字段（`id/form/type/origin/glossZh/glossEn/allomorphs/examples/note/sources`）之上追加：

| 字段 | 含义 |
| --- | --- |
| `formKey` | 归一化拼写（小写、去首尾连字符），join 用，**不是身份** |
| `senseKey` | 该实体的最短区分标签（如 `please` / `flat`），用于 UI 消歧 |
| `homographs` | 同形但不同源的 ID 列表，双向可查 |
| `identityStatus` | `verified`（语源与语义均可核对）/ `provisional`（暂定） |
| `review` | `{ by, at, note }` 语言学审校记录，没有就是未审校 |

## 3. 词条与课程引用

- `WordEntry.parts`（string[]）保留，供 UI 展示表面切分。
- 新增 `WordEntry.partIds`（string[]），与 `parts` 等长，元素是**词素 ID**。
- 新增 `WordEntry.partResolution`：`exact` / `ambiguous` / `unresolved`。
  只有 `exact` 才允许进入"已核验"统计。
- 课程卡片 `Card.morphemes`（形式）保留；新增 `Card.morphemeIds`，同样只在无歧义时填，
  歧义时留空并在 `notes` 标注，**不允许猜**。

## 4. 索引

`src/content/lexicon/forms.json`：`{ "form": ["id1","id2"] }`，由脚本生成，随词库一起发布。
运行时由 `src/lib/identity.ts` 读取并构建：
- `idsForForm(form): string[]`
- `morphemeById(id): Morpheme | undefined`
- `resolveForm(form, hint?): { id?: string; candidates: string[]; ambiguous: boolean }`

`hint` 允许传 `{ lessonConcepts, wordParts, origin }` 等上下文；**不传就绝不猜**。

## 5. 覆盖率七级（替代原来的四格）

| 级别 | 判据 | 数据来源 |
| --- | --- | --- |
| L1 已登记 | 出现在 s1-elements.json | 教材清单 |
| L2 已关联 | 元素 → 词素 ID，且 `form + origin` 一致 | forms.json |
| L3 释义已核 | `glossZh` 与 `glossEn` 均非空且无占位符 | 词库 |
| L4 例词充分 | ≥2 个 `verified: true` 的词条含该 ID | words.json |
| L5 有讲解 | 覆盖该成分的知识点被某课 `knowledgePoints` 引用 | 课时 |
| L6 有练习 | 该课的 practice/apply 中至少一题用到该 ID | 课时 |
| L7 已审校 | 该词素 `review.by` 非空 | 审校记录 |

报告中每一级都要给出数量、百分比与**差异清单**（哪些成分卡在哪一级、原因是什么）。
`L2` 不得用"拼写相同"冒充：必须 ID 命中。

## 6. 迁移兼容

- 学习记录、收藏、复习卡片若存的是旧 ID，通过 `legacyIds` 与 `analysis/identity-migration.json` 映射。
- 迁移脚本必须幂等：重复运行不产生新 ID、不改已迁移记录。
- 迁移前自动备份 `morphemes.json` / `words.json` / 数据库 schema 版本号。

## 7. 回归用例（必须进测试）

| 形式 | 期望 |
| --- | --- |
| `plac` | 两个 ID：拉丁 `please`、希腊 `flat`；`placate`→拉丁，`placoid`→希腊 |
| `bi` | 两个 ID：拉丁 `two`（binary）、希腊 `life`（biology，若收录为 `bio` 则记录映射） |
| `in-` | 两个 ID：否定 `not`、方位 `in/into`；`invisible`→否定，`inject`→方位 |
| `ver` | 若存在 `true`（verus）与 `fear`（vereri）两支，必须分开；`verify` vs `revere` 各归其位 |
