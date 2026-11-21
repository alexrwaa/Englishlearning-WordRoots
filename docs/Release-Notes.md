# WordRoots 0.8.0

**这一版不追求数字更大。** 它拆掉了 `verified` 这个含混标记，修掉三个让解析器判错的 bug，
把 7 个词的词源重写成分层证据，并为"学习者到底学到没有"建立了第一个可测量的入口。
上一版见 [`releases/v0.7.0.md`](releases/v0.7.0.md)。

## 一、`verified` 拆成六个问题（P0）

旧标签同时回答"词真不真、能不能拆、拆得对不对、词源有没有据"。结果：101 个 `verified` 词条里
**有成分根本解析不出 ID**，却仍在给 L4 供证据。

现在每个词带一个 `analysis` 块（`docs/WORD_STATUS.md`）：

| 字段 | 含义 |
| --- | --- |
| `lexical` | 这个词真实存在 |
| `analyzable` | 今天还能拆 |
| `segmentation` | verified / partial / unverified / none——每个成分都要有交代 |
| `unresolved[]` | 没 ID 的成分**及原因**：自由词干 / 正字法 / 确实缺记录 |
| `etymology.status` | documented / inferred / disputed / unknown（documented 必须有可定位来源） |
| `contested[]` | 学术分歧，保留多说 |
| `quizSafe` | 可自动判题 |

| 项目 | 数量 |
| --- | --- |
| 词条 | 1473 |
| segmentation = verified | **1286** |
| segmentation = partial | 161 |
| etymology documented / inferred / disputed / unknown | 1058 / 8 / 1 / 406 |
| quizSafe | 1286 |
| legacy `verified` | 972（0.7.0 是 925，其中 101 个解析不全） |

**verified 反而变多，是因为修了三个解析器 bug，不是放宽标准**：

1. `forms.json` 只索引 `form`，**没索引 allomorphs** → `spect`/`spic`/`miss`/`cept` 全查不到，
   `inspection`、`circumspect` 被判"缺成分"。
2. 同族候选（`cept` 被 cap/ceipt/cept 三条记录声明）本该折叠却被判歧义。
3. 消歧顺序错了：应**先看词自身的语源**，再看位置（词首才是前缀、词尾才是后缀），最后才看拼写。

修正后 exact 1121、ambiguous 14；`captain` 回到 caput「头」、`capture` 回到 capere「抓」
（此前两者都指向同一条记录）。剩余 161 个 partial 是**工作清单**，不是失败。

## 二、7 个词的词源纠错（P0）

`religion`、`intercom`、`credo`、`laptop`、`captain`、`lucid`、`psyche` 逐词区分四层：
**历史造词 / 现代共时结构 / 教学拆分 / 可归纳的生产性规律**。

- `intercom`：1918 年前后的截短复合（internal communication），**不是** inter- + com 的拉丁构词。
- `credo`：直接借拉丁第一人称 `credō`「我相信」，词尾 -o 是动词词尾，**不是**连接元音。
- `laptop`：现代英语复合词，**已从希腊 `top`「地方」剥离**，不再是 `cx-top`。
- `religion`：`religare`（重新绑定）与 `relegere`（反复诵读）两说并存，标 `disputed`，
  `contested` 记录两方证据与置信度。
- `captain`：caput「头」→ 首领；与 `capture` 的 capere「抓」分属两条记录。

`src/lib/etymology-regression.test.ts` 把每个词最容易写错的那一点钉成断言，防止回潮。

## 三、来源与 L7 双口径（P0）

- **补登记** `S5`（历史词典集）、`G1`（现代释义集）、`LEX`（项目规则，不是语言学证据）。
  此前 330 条引 `S5`、491 条引 `G1`，**注册表里根本没有这两个 ID**。
- 新增 `scripts/audit-reviews.mjs`：核查"引用的页码在教材成分表里是否真有该成分"。
  **208 条审校中 193 条页码对得上**，15 条无页码。

| 口径 | 含义 | 条数 |
| --- | --- | --- |
| L7a（0.7.0） | 有可定位来源 | 208 |
| L7b（0.8.0） | 页码对得上 **且** 有词典独立交叉核验 | **0** |

L7b 是 0，这是本轮最重要的负面结论：**208 条审校全部只引教材，没有一条做过词典交叉核验**。
本环境无法访问词典站点，因此只建了机制、没有伪造数据。两个口径并列报告，避免"改定义"被读成"进步"。

## 四、词族档案（P1）

12 个族（spect / struct / port / fer / duct / mit / cap / scrib / graph / phon / chron / form），
**171 个真实成员**，每个族一份 `src/content/families/*.json`：核心义、语源、成员（派生 / 同源异途分层）、
异形与拼写规律、多层派生链、语义演变、**同形异源反例**、归纳提问、迁移检验题、来源。

词族页新增"词族档案"面板，直接渲染这些数据——解决"打开词族页只有两三个结果"的问题。

诚实说明：`phon`（5 成员）、`mit`（10 成员）在英语中真实成员本就少，档案里写明，**没有凑数**。

## 五、四组教材覆盖（P1）

| 教材 | 覆盖 | 方法 |
| --- | --- | --- |
| S1（主教材） | 283/283 显式关联 + **抽样 30 个：27 pass / 3 partial / 0 fail** | 逐条核对正文、例词、练习 |
| S2（构词学理论） | 43 个概念：**taught 33（76.7%）/ partial 7 / missing 3** | 缺的是理论框架类概念 |
| S3（SWI 方法） | 五步：**4/5 taught**，观察一步只做到一半 | 检查是否要求学生自己归纳 |
| S4（历史构词） | 内容 16/16；旧说 7 条中 **2 条显式隔离、2 条部分、3 条未隔离** | 逐条标注"教材说法 / 现代共识 / 有争议" |

报告：`docs/TEXTBOOK_S2_S3_S4.md`、`analysis/textbook/*.json`。

## 六、能力测评（P1）

新增 `/assessment` 页面与 `src/content/assessment/items.json`（**60 题**，5 维：词素记忆、边界判断、
词源与现代构词区分、陌生词推理、语境修正；每维 12 题、3 个难度档）。

- 题池与课程**隔离**：题库里的词不出现在任何课时里，测的是迁移而非记忆。
- 三种模式：`baseline` / `checkpoint` / `retest`（延迟复测），本地保存历史，可对比同一人不同时间。
- 页面上明确写着：**这是测评工具，不是学习效果实验**；分数变化不等于教学有效。

## 七、门禁

新增并进入 CI：

- `migrate-word-status --check`：状态漂移即失败（防止绕过推导直接改标记）
- `audit-reviews`：审校引用完整性
- `word-status.test.ts`（8 条不变量）、`etymology-regression.test.ts`、`assessment.test.ts`
- 合计 **268 条单测**，12 个测试文件

## 八、仍未完成（明确写出）

1. **L7b = 0**：词典交叉核验一条都没做。需要在能访问词典的环境里补，不能靠"看起来对"。
2. **161 个 partial 词条**：缺具体词素记录或自由词干未入词库。
3. **S2 缺 3 个概念、S3 缺"发现问题"环节、S4 有 3 条旧说未隔离**（w29d2 的两处断言需改）。
4. **学习效果没有实验数据**：只有测评工具与自动化测试，两者都不等于教学有效。
5. 课标时长仍为内容量估算（同侪相对偏差），没有真实完成耗时。
