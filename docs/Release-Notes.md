# WordRoots 0.12.0

**探究记录进了 SQLite，Word Sum 判题改成有语言学依据的规则，词族可以一轮一轮往深走。**
上一版见 [`releases/v0.11.1.md`](v0.11.1.md)。

## 一、P0：探究记录迁到 SQLite

`wordroots.family.inquiry.v1`（localStorage）不再权威。新表 `inquiry_progress`，库 schema 3→4，
行级 `schema_version=1`：

| 字段 | 内容 |
| --- | --- |
| `family_id` | 稳定族 id（`fam-spect`），主键 |
| `step` / `done` | 当前步骤、已完成步骤 |
| `hypothesis` | 学习者写的假设原文 |
| `picks` | 发现阶段选择、验证答案、已见词、探索轮次、修改次数 |
| `sums` | Word Sum 输入 |
| `hints` / `elapsed_ms` | 提示级别、实际用时 |

- **迁移**：localStorage 一次性搬入（marker `…migrated.v1`），库非空则库胜、不合并；跑两次不变。
- **失败可见**：保存被拒时界面显示「进度未保存…重试」，**不再**出现"已保存"。
  读失败不武装自动保存，避免用空状态覆盖读不到的数据。
- **多族串进度已修**：`loaded: boolean` 改成 `{familyId, loadedFor}` 状态机，
  快速切族时 A 的 `true` 不会让 B 存下 A 的答案。
- **备份**：快照新增 `inquiry_progress`，**只有备份文件里带这个键时**才清空重灌——
  旧备份没有这个字段时保留现有进度，不会被"恢复"清掉。
- 浏览器预览仍走 localStorage shim，错误语义一致。

## 二、P0：Word Sum 判题重写

旧 `checkSum()` 把所有连续双写字母压成一个，于是 `press → pres`、`miss → mis` 被判等价。

现在只有 5 条具名规则能改字母，其余必须逐字符相同：

| 规则 | 例子 | 不适用 |
| --- | --- | --- |
| `e-drop` | `create + ion → creation` | `care + ful` |
| `y-to-i` | `happy + ness → happiness` | `play + ing` |
| `consonant-doubling` | `admit + ed → admitted` | `visit + ed`（非重读） |
| `assimilation` | `ad + ferent → afferent`（白名单） | 白名单外一律不认 |
| `connective-vowel` | `spectr + o + meter` | 任意元音不套用 |

判题结果分三层：`structure`（切分对不对）/ `spelling`（拼写是否合法）/ `ruleIds`（命中了哪条）。
无法判断时返回 `unresolved` 并说明原因，不判错：空输入、词库无此词素、差异 ≥2 字母无法归因。

`press/pres`、`miss/mis`、`add/ad`、`occ/oc`、`curr/cur` 现在全部判错，并给出
"双写是词本身的拼写，删掉一个不是任何规则允许的变化"。

## 三、P1：词族可以一轮一轮往深走

- 成员按**层**选：基础（词根+一个词缀）/ 变化（多词缀）/ 进阶（同源词）。
- 观察、验证、Word Sum 都随**轮次**轮换，已见词记在记录里，下一轮优先给没见过的。
- 第六步给「再探一次」按钮：保留见过的词，清掉这一轮的作答。
- 验证用的词**不会**是刚在观察里出现过的。
- Word Matrix 不再只显示前 3 条派生链；Word Sum 最多 3 条但按轮次轮换。
- 同源词在验证里明确写"历史同源，不是现代派生"。

## 四、P1：S1/S2 缺口清零

44 条 partial 逐条归因，不是一律加题：

| 归因 | S1 | S2 |
| --- | --- | --- |
| 有题但审计没识别 | 23 | 1 |
| 讲了但缺定点练习 | 14 | 1 |
| 真的没讲 | 4 | 1（缺例词） |
| 内容事实错误 | 0 | 0 |

新增 18 道原创题（都带 ≥60 字 explain 与错因）、4 张正文卡、2 处补句，动 18 个课时。
审计新增 25 条 `S1_PRACTICE_ANCHORS`（必须命中题干/选项/答案才算），改 `selection` 的匹配正则
覆盖「宿主必须」。**taught 门槛与 0.35 阈值一个字没动。**

结果：**S1 283/283、S2 43/43、S3 5/5、S4 16/16，0 missing。**
逐条记录见 `docs/GAP_CLOSURE.md`；抽样 3 条复核写在报告里。

## 五、P1：主张级核验继续深入

| 主张 | 有证据 | 单一来源 | 跨来源 |
| --- | --- | --- | --- |
| root-sense | 18 | 4 | 14 |
| classical-derivation | 0 | 0 | 0 |
| **borrowing-path** | **13** | 13 | 0 |
| **modern-structure** | **12** | 12 | 0 |
| modern-sense | 0 | 0 | 0 |

12 个深度词族各补了两类主张，证据是 Wiktionary 词源模板原文（如
`Borrowed from {{bor|en|la|spectātor}}`）。**全部单一来源**——这是实话，不是进度。

顺带查出一处教学数据问题：`spectator` 的共时切分是 `spectate + -or`，
不是族里写的 `spect + -ator`。历史形态 ≠ 现代能产切分，已标为 `modern-structure: partial`。

希腊索引：1187 组同键冲突不再合并成一条，改为多候选（原始词形、词条 id、定位都保留）；
`--disambiguate` 报告 198 组可完整消歧、13 组部分、**976 组无法消歧就保留多候选，不猜**。
`docs/GREEK_SOURCES.md` 已改正「核验记录未入库」的过期说法。

## 六、P2：口径与埋点

- **修了日期口径不一致**：学习报告按 UTC 切活跃天数，统计页按本地日期，午夜前后会差一天。
  统一为本地日期，加三条时区测试。
- 探究记录新增「修改次数」（改过几次答案），与提示级别、实际用时一起落库。
- **没做**：题目级"点开提示"事件。需要独立的 `hint_event` 表 + 迁移 + 备份路径，
  本轮没有铺开，写在这里而不是假装有。

## 七、测试与冒烟

- **453 条单元测试**（25 个文件）：新增 `word-sum` 45 条、`inquiry-store` 16 条、分层 6 条、时区 3 条。
- Windows 冒烟 12 场景，第 12 场景**新增关闭重开**：同目录连续启动两次，
  第二次断言 `restored=true`（第一轮存下的记录被读回）且 `isolated=true`（没访问的族没有记录）。

## 八、仍未完成

1. 借词路径与共时结构**没有一条跨来源证据**（都只有 Wiktionary）。
2. `classical-derivation`、`modern-sense` 仍为 0。
3. 题目级提示事件未埋点。
4. S3「观察」环节的现象仍由课程挑选，不是学生自选语料（报告里已注明）。
5. 没有真人学习效果数据。
