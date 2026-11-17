# WordRoots 课程内容规范（v1）

本文件是课程内容作者（含子智能体）的**唯一格式契约**。任何不符合本规范的内容都会在 CI 的
`npm run validate:content` 中失败。

## 1. 文件位置

| 内容 | 路径 |
|---|---|
| 每周主题 | `src/content/weeks/weekNN/meta.json` |
| 每日课程 | `src/content/weeks/weekNN/day1.json` … `day7.json` |
| 词素词典 | `src/content/lexicon/morphemes.json` |
| 词条词典 | `src/content/lexicon/words.json` |
| 概念词典（已存在，勿改 id） | `src/content/lexicon/concepts.json` |

一天一个文件，便于多人并行写同一周的不同天，也让 diff 可读。

类型定义见 `src/lib/types.ts`（`Week` / `Lesson` / `Card` / `Exercise`）。
完整范例：`src/content/weeks/week01/day1.json`（照此质量与密度写作）。

## 2. 文件结构

`weekNN/meta.json`：

```json
{
  "week": 1,
  "theme": "词素、词根、词基与构词基础",
  "intro": "2–4 句中文导语，说明本周要解决的问题，以及它与前后周的关系。"
}
```

`weekNN/dayN.json` = 一个 `Lesson` 对象（见第 3 节）。`id` 必须为 `w{周两位}d{日一位}`，
例如第 3 周第 2 天 = `w03d2`；`week` 与目录一致，`day` 与文件名一致（`day3.json` → `day: 3`）。

## 3. Lesson 字段

```json
{
  "id": "w01d1",
  "week": 1,
  "day": 1,
  "title": "词素：比单词更小的意义单位",
  "tagline": "一句话说明今天能获得什么能力",
  "objectives": ["能判断一个词能否继续切分", "能区分自由词素与粘着词素"],
  "prereqs": ["w01d0 不存在；第一天可写 c-morpheme"],
  "concepts": ["c-morpheme", "c-root"],
  "minutes": { "review": 5, "learn": 8, "practice": 7, "apply": 5 },
  "level": "B1",
  "cards": [],
  "practice": [],
  "apply": [],
  "sources": [{ "id": "S1", "title": "English Vocabulary Elements", "detail": "第 1 章 词汇的来源" }]
}
```

规则：

- `objectives` ≥ 2，且都必须是**可检验的行为**（“能……”“能区分……”），不要写“了解”。
- `prereqs`：前一天的 `w##d#`，或概念 id（`c-` 开头）。第 1 天可为空数组。
- `concepts`：**只能**使用 `concepts.json` 中已有的 id 和 `morphemes.json` 中已有的形态（去掉连字符的字符串）。
  这是复习调度的键：一门课教了哪个词素，就用它的形态（如 `"struct"`, `"un"`, `"tion"`）。
- `minutes` 四项之和必须在 15–35 之间，默认 5/8/7/5。
- `level`：A2/B1/B2/C1。第 1–4 周以 B1 为主，5–8 周 B1/B2，9–12 周 B2/C1。
- `sources` ≥ 1，`id` 仅可为：S1 教材一、S2 Essentials of Linguistics、S3 WordWorks SWI、S4 New Word-Analysis、S5 现代辞书/词源参考。

## 4. 卡片（cards）

3–6 张，`body` 至少 70 字符，中文讲解为主、英文术语与例句为辅。可用轻量标记：

- `**加粗**`、`*斜体*`
- `` `struct` `` → 渲染为可点击词素（必须能在 morphemes.json 中找到，否则显示为普通代码）
- `[[morpheme|中文释义]]` → 术语悬停释义
- 空行分段；`- ` 无序列表；`1. ` 有序列表；`### ` 小标题

六种卡片，按需选用：

```json
{ "kind": "text", "title": "…", "body": "…", "terms": [{ "term": "bound morpheme", "zh": "粘着词素", "en": "bound morpheme" }], "morphemes": ["struct"] }
{ "kind": "etym", "title": "…", "body": "…", "steps": [{ "period": "拉丁", "form": "struere", "note": "堆叠、建造" }] }
{ "kind": "table", "title": "…", "body": "…", "head": ["词素", "来源", "含义"], "rows": [["struct", "拉丁 struere", "建造"]] }
{ "kind": "matrix", "title": "…", "body": "…", "base": "struct",
  "prefixes": [{ "text": "con", "glossZh": "共同、一起" }],
  "suffixes": [{ "text": "ion", "glossZh": "名词后缀" }],
  "words": [{ "w": "construction", "parts": ["con", "struct", "ion"], "glossZh": "建造、构造" }] }
{ "kind": "sum", "title": "…", "body": "…", "sums": [{ "parts": ["un", "help", "ful"], "result": "unhelpful", "glossZh": "无帮助的", "note": "可选" }] }
{ "kind": "compare", "title": "…", "body": "…", "a": "词源关系", "b": "形态关系", "rows": [{ "label": "判断依据", "a": "…", "b": "…" }] }
{ "kind": "passage", "title": "…", "body": "…", "excerpt": "英文原文片段", "glossZh": "可选中文对照", "questions": [{ "q": "…", "a": "…" }] }
```

`matrix.words` 中的每个词必须是**真实存在**的英语词，`parts` 按拼写顺序给出词素。
如果没有把握，宁可不放。

## 5. 练习（practice / apply）

`practice` ≥ 4 题，`apply` ≥ 1 题（必须是 `infer`，训练迁移推理）。
每题必须有 `explain`（≥ 12 字符，说明为什么，而不是重复答案）与 `concepts`（用于复习调度）。

```json
{ "id": "w01d1-p1", "kind": "mcq", "prompt": "…", "choices": ["…","…","…"], "answer": 0, "explain": "…", "concepts": ["c-morpheme"], "hint": "可选" }
{ "id": "w01d1-p2", "kind": "cloze", "prompt": "…", "sentence": "The results are ___ .", "answer": "predictable", "accept": ["unpredictable"], "explain": "…", "concepts": ["able"] }
{ "id": "w01d1-p3", "kind": "wordSum", "prompt": "把词素拼成单词", "parts": ["happy","ness"], "answer": "happiness", "explain": "…", "concepts": ["c-spelling-rule"] }
{ "id": "w01d1-p4", "kind": "matrix", "prompt": "…", "base": "struct", "prefix": "con", "suffix": "ion", "answer": "construction", "explain": "…", "concepts": ["struct"] }
{ "id": "w01d1-a1", "kind": "infer", "prompt": "推测划线词的意思", "passage": "英文段落，目标词必须原样出现在其中", "word": "unprecedented", "choices": ["…","…","…"], "answer": 1, "strategy": "拆分 + 语境线索 + 词性判断", "explain": "…", "concepts": ["un","cedent"] }
```

### 出题质量底线

- 干扰项必须是**同类同形**的真实误区（同族词、形近词、反义后缀），不能是明显荒谬的选项。
- 不要出现“以上都对”“以上都不对”。
- `infer` 的 `passage` ≥ 40 字符，且是自然英文（可来自科研语域），目标词必须出现在段落中。
- `cloze` 句子必须含 `___`。
- `wordSum` 的 `answer` 是**正确拼写结果**，允许与直接拼接不同（happiness）。
- 同一课内 `id` 唯一，建议 `w01d1-p1` 这种前缀。

## 6. 12 周主题与约束（必须遵守顺序，先修关系不能断）

| 周 | 主题 | 必须先建立的能力 | 关键词素/概念 |
|---|---|---|---|
| 1 | 词素、词根、词基与构词基础 | 切分意识 | c-morpheme, c-root, c-base, c-affix；un, re, help, act |
| 2 | Word Sum、Word Matrix 与 SWI 探究 | 会写构词算式 | c-word-sum, c-word-matrix, c-word-family, c-spelling-rule |
| 3 | 前缀及其语义功能 | 否定/方向/程度/时间四类前缀 | un, in/im/il/ir, dis, non, pre, post, sub, super, trans, inter |
| 4 | 后缀、派生与词性变化 | 由后缀判词性 | tion, ment, ness, ity, able, ive, ous, ify, ize, ly |
| 5 | 拉丁语词根与词族 | 词族扩展 | struct, form, port, duc, spect, scrib/script, fer, mit/miss |
| 6 | 希腊语词根与科学术语 | 组合形式 -o- 连接 | bio, geo, therm, hydro, phon, graph, logy, meter, micro, macro, tele |
| 7 | 复合、转换与构词方式 | 分辨复合/转换/混成/截短/缩略 | c-compound, c-conversion, c-blend, c-clipping, c-acronym |
| 8 | 词素变体、拼写与读音 | 解释拼写变化 | c-allomorph, c-spelling-rule；in-/im-/il-/ir-, -s 三读 |
| 9 | 词源学、借词与词义历史 | 能读词源条目、区分词源与共时分析 | c-etymology, c-borrowing, c-cognate |
| 10 | 多义词、隐喻、转喻与语义扩展 | 能解释一个词的义项扩张 | c-metaphor, c-metonymy, c-broadening, c-narrowing, c-amelioration, c-pejoration |
| 11 | 技术术语、现代新词与词义推断 | 能拆解科研术语 | c-scientific, c-inference, c-register；token, model, gate, network, hydrogen, localization |
| 12 | 综合构词分析与科研英语阅读 | 独立完成长词分析 | 综合复现前 11 周 |

第 11–12 周需覆盖用户的科研方向：机器人、SLAM、localization、LiDAR、IMU、计算机视觉、
机器学习。用构词学解释这些术语，而不是讲专业课。

## 7. 内容事实标准（会被人工复核）

1. **区分三种性质**：历史词源（etymology）、现代共时构词（synchronic morphology）、
   辅助记忆拆分（mnemonic）。三者不能混为一谈。例：`hydrogen` 不是“hydro+gen 的英语本土复合”，
   而是 18 世纪科学拉丁语的人造术语；`nice` 的现代义与拉丁 `nescius` 无共时形态关系。
2. **不得只凭拼写相似断定同源**。`have` 与 `habere` 不同源；`island` 的 s 是 16 世纪误加的。
3. **词源主张要有来源**。`sources` 只写你确实依据的层级（教材/SWI/现代辞书），
   不确定的不写，或写“词源存争议”。
4. **词族成员必须真实且语义可追溯**。不要把 `reject`/`inject` 的 `-ject` 与无关词混族。
5. **中文解释面向四六级读者**：避免未解释的语言学行话；首次出现术语时给中英对照。
6. **英文例句必须自然**，符合学术/通用语域；不要生造搭配。
7. 科技术语以现代用法为准（`localization` 在机器人语境指定位，在软件语境指本地化，两者都要讲）。

## 8. 每日 25 分钟节奏（内容必须匹配）

- 复习 5 分钟：由 FSRS 抽旧卡，内容作者只需保证新卡可被单独提问（不要依赖当天上下文）。
- 学习 8 分钟：3–6 张卡片，单张正文 80–260 字，避免长段英文。
- 练习 7 分钟：4–6 题，难度递进，最后一题要求组合运用。
- 应用 5 分钟：1–2 道 `infer`，语料尽量贴近科研阅读。

## 9. 自检命令

```bash
npx tsx scripts/validate-content.ts        # 单周开发时
STRICT=1 npx tsx scripts/validate-content.ts  # 交付前（要求 12 周 / 84 课）
```
