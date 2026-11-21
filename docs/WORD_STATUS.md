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

## 当前分布（自动生成）

<!-- status:begin -->

| 项目 | 数量 |
| --- | --- |
| 词条 | 1506 |
| segmentation = verified | 1393 |
| segmentation = partial | 87 |
| segmentation = unverified | 26 |
| etymology documented | 1091 |
| etymology inferred | 8 |
| etymology disputed | 1 |
| etymology unknown | 406 |
| quizSafe | 1046 |
| legacy `verified` | 1048 |

剩余未解析成分按出现次数：care（3）、gen（3）、up（3）、agree（2）、mat（2）、back（2）、fit（2）、coupl（2）。

> 以上数字由 `node scripts/word-status-report.mjs` 从 `words.json` 计算，
> CI 会跑 `--check`，文档与数据不一致时构建失败。

<!-- status:end -->
