# 词条状态模型（0.8.0）

`verified: true` 曾经同时回答四个问题：词是不是真的、能不能拆、拆得对不对、词源有没有据。
结果是 101 个 `verified` 词条里**有成分解析不出 ID**，而这些词仍在给 L4 供证据。
0.8.0 把这四个问题拆开，每个词带一个 `analysis` 块，由 `scripts/migrate-word-status.mjs` 推导，**不手工编辑**。

## 字段

| 字段 | 取值 | 判据 |
| --- | --- | --- |
| `lexical` | true / false | 这个词在英语里真实存在 |
| `analyzable` | true / false | 今天的母语者还能拆出成分 |
| `segmentation` | verified / partial / unverified / none | 每个成分都有交代（词素 ID、自由词干、或正字法成分）才算 verified |
| `unresolved[]` | `{part, reason}` | 没有 ID 的成分，以及原因：`free-base`（自由词干）、`orthographic`（静音 e/连接元音）、`unresolved`（确实缺记录） |
| `etymology.status` | documented / inferred / disputed / unknown | 有**可定位**来源才算 documented；有分歧记 disputed |
| `etymology.sources` | 来源 ID 列表 | 必须在 `sources.json` 注册过（S1–S4 教材、S5/G1 词典集、LEX 项目规则） |
| `contested[]` | `{view, evidence, confidence}` | 学术分歧，保留多说，不合并成一个故事 |
| `quizSafe` | true / false | 可以自动判题（结构已核验） |

旧字段 `verified` 保留为 `segmentation === 'verified' && etymology.status !== 'unknown'`，供旧读取方兼容。

## 当前分布（`node scripts/migrate-word-status.mjs`）

| 项目 | 数量 |
| --- | --- |
| 词条 | 1473 |
| segmentation = verified | 1272 |
| segmentation = partial | 174 |
| segmentation = unverified | 27 |
| etymology documented | 1000 |
| etymology inferred | 66 |
| etymology unknown | 407 |
| quizSafe | 1272 |
| legacy `verified` | 975 |

0.7.0 的 `verified` 是 925，且其中 101 个其实解析不全。0.8.0 的 975 每一个都能说明"每个成分去哪了"。

## 为什么 verified 反而变多了

因为 0.8.0 修了三个**解析器**问题，而不是放宽标准：

1. **`forms.json` 只索引了 `form`，没索引 `allomorphs`**。`spect`、`spic`、`miss`、`cept` 全都查不到，
   于是 `inspection`、`circumspect` 这类词被判"缺成分"。这是数据索引 bug，不是语言学判断。
2. **同族歧义**：`cept` 同时被 `cap`/`ceipt`/`cept` 三条记录声明。同一 familyId 内部的选择不构成
   语言学主张，因此按"规范形式相符者优先"折叠。
3. **位置与拼写**：词的第一个成分才可能是前缀、最后一个才可能是后缀；成分拼写与某条记录的规范形式
   完全相同时优先。`al` 在词尾是 `-al`，在词首才可能是 `ad-`。

修完之后 exact 从 1100（其中含大量错误匹配）变成 1087，ambiguous 从 36 变成 50，
但**每个 verified 都可复核**——这是本轮唯一在意的方向。

## 剩余 174 个 partial 是工作清单，不是失败

它们大多缺一个具体记录（如 `-ual`、`-ibil`、`posit`），或自由词干未进词库（`agree`、`care`）。
补这些记录会让数字上升，但**必须一条一条补**，不能靠放宽匹配。

## 相关命令

```bash
node scripts/migrate-word-status.mjs           # 推导并写入
node scripts/migrate-word-status.mjs --check   # CI：状态漂移则失败
node scripts/audit-reviews.mjs                 # 审校证据核查（页码是否真有该成分）
npx vitest run src/lib/word-status.test.ts     # 8 条不变量
```
