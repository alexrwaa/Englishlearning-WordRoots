# 希腊语参考源（GREEK_SOURCES）

本文件记录希腊语词源核验所用参考文本的**许可、数据形状与索引方法**，供复核与合规检查使用。
配套产物：

| 产物 | 位置 | 是否入库 |
| --- | --- | --- |
| 下载的 LSJ 分卷 | `analysis/reference/greek/lsj/greatscott01–86.xml` | 否（`analysis/` 已在 `.gitignore`） |
| 下载的 Middle Liddell | `analysis/reference/greek/perseus/middle-liddell.xml` | 否 |
| 词头索引 | `analysis/greek-index.json`（31 MB） | 否（同上） |
| 索引构建脚本 | `scripts/build-greek-index.mjs` | 是 |
| quote 回验脚本 | `scripts/check-greek-records.mjs` | 是 |
| 核验记录 | `analysis/greek-verification/*.json` | 否（同上；如需入库须 `git add -f` 或给 `.gitignore` 加例外） |

> ⚠️ 本仓库 `.gitignore` 忽略了整个 `analysis/`，因此上表中「否」的产物默认不提交。核验记录若要随仓库发布，需要显式处理，见文末「入库与再分发」。

---

## 1. 许可证

### G3 · LSJLogeion（主用）

| 项 | 内容 |
| --- | --- |
| 仓库 | https://github.com/helmadik/LSJLogeion |
| 固定版本 | commit `e15ac7b194ace23b8fd3e568323c107395f3e996`（2026-11-18） |
| `LICENSE.md` 原文 | “This work is licensed under Creative Commons Attribution-ShareAlike 4.0 International” |
| SPDX | **CC BY-SA 4.0** |
| 注意 | GitHub API 的 `license` 字段返回 `NOASSERTION`（因为 `LICENSE.md` 只是链接文本，不是标准许可证全文）。以仓库内 `LICENSE.md` 与 README 为准，判定为 CC BY-SA 4.0。 |
| 署名要求（README 原文） | “If using these files, please credit Perseus Tufts *and* Helma Dik/Logeion, and please report issues.” |
| 文本来源与编纂信息 | Perseus 版 LSJ 电子本的地方修订版；底本 *A Greek-English Lexicon*，Liddell–Scott–Jones 第 9 版（Clarendon Press, 1940，ISBN 0198642261），出版方 Trustees of Tufts University；修订记录署 Helma Dik。 |

### G4 · Perseus canonical-pdlrefwk（仅作对照，不用于下结论）

| 项 | 内容 |
| --- | --- |
| 仓库 | https://github.com/PerseusDL/canonical-pdlrefwk |
| 固定版本 | commit `02768b0c37d6102be4899fc0eb57f9d348195243`（2025-01-22） |
| 许可 | **CC BY-SA 4.0**（`license.md` 为 CC BY-SA 4.0 全文；README 亦声明 “Unless otherwise indicated, all contents of this repository are licensed under CC BY-SA 4.0”） |
| 附加条款 | 须保留 Perseus 的可得性声明原文；须把修改回馈给 Perseus；须在可能时保留 `<fileDesc>`/`<sourceDesc>` 中的题名、作者、出版方、ISBN |
| 实际内容 | 它不是 LSJ 全文库，而是**参考工具书**仓：`viaf66541464.001.perseus-eng1.xml` = *An Intermediate Greek-English Lexicon*（Middle Liddell, 1889），另有 Smith 三部词典、Allen & Greenough 拉丁语法、Zoega 古冰岛语词典 |

### MIT 项目里能不能引用摘录？

- 本仓库整体许可是 **MIT**（见 `LICENSE`）。MIT 只覆盖本项目自有代码与自写文本，**不能覆盖** CC BY-SA 4.0 的第三方词典文本。
- CC BY-SA 4.0 **允许**复制与改编（含商业使用），条件是 **BY（署名）+ SA（相同方式共享）**。
- 因此可行的用法是：①每条引用都是**极短摘录**（本仓库每条 ≤ 一句话）；②逐条标注来源、版本、许可与永久链接；③在文件层面声明「该摘录文本按 CC BY-SA 4.0 提供，不适用本仓库的 MIT」；④**不整体收录**词典文件。
- 不建议的做法：把 LSJ 全文或大段条目打包进发行物再以 MIT 分发——那会把 SA 义务传染到不该覆盖的部分，也违背 LLM/OCR 文本的再分发审慎原则。
- 本仓库当前做法：**只在 `analysis/` 本地保留下载文件（已 gitignore），仓库里只提交派生事实（词头、义项短引、判定）与自写说明**。

---

## 2. 数据结构

### 2.1 文件组织

- LSJLogeion 的正文是 86 个分卷 `greatscott01.xml … greatscott86.xml`（合计约 111 MB），按字母顺序切分，**不是**按词切分；同一字母常跨多个文件（α 占 01–11，ε 占 20–30，σ 占 68–73）。
- 每个文件是一个独立 TEI.2（P4）文档，头部含 `<teiHeader>`（题名、责任者、出版信息、修订日志），正文从 `<div2>` 开始。
- Middle Liddell 是单文件 TEI.2（约 20 MB）。

### 2.2 条目形状（实测，全库 `<div3>`/`<div4>` 计数为 0，`<div2>` 之间是平级关系）

```xml
<div2 id="crossgra/fw" orig_id="n22825" key="gra/fw" type="main" opt="n">
  <head extent="full" lang="grc" opt="n" orth_orig="γράφω">γράφω</head> <pron …>[ᾰ]</pron>, <tns>fut.</tns> …
  <sense id="n22825.0" n="" level="1"><i>scratch, graze,</i> <cit><quote lang="grc">…</quote><bibl>…</bibl></cit>
    <sense n="II" level="2"><i>express by written characters, write,</i> …
```

| 用途 | 字段/元素 | 说明 |
| --- | --- | --- |
| 词头（可读） | `<head>` 的文本内容 | 已转 Unicode，带 polytonic 变音；部分条目带连字符与音量符号，如 `ψῡχ-ή` |
| 词头（原始拼写） | `<head>/@orth_orig` | 保留印本的 `[]`、`-`、长短音记号 |
| 检索键 | `<div2>/@key` | **beta-code**：`/`=锐音，`\`=重音，`=`=抑扬，`^`=长音，`_`=下标，`|`=分音。如 `gra/fw`、`yu_xh/` |
| 条目唯一 id | `<div2>/@id` | `cross` + key，如 `crossgra/fw`，可作稳定锚点 |
| 条目类型 | `<div2>/@type` | `main` / `gloss`（交叉引用占位）等；**建索引只取 `main`** |
| 义项层级 | `<sense>/@n`、`<sense>/@level` | `level="1"` 为总义，2/3/4 逐级细分；`n` 为印本编号（罗马数字或阿拉伯数字） |
| 英文对译 | `<sense>` 内的 `<i>…</i>` | LSJ 用斜体排英文释义，这是抽取 gloss 的唯一可靠信号 |
| 语料引证 | `<cit><quote>` + `<bibl>` | 希腊语例句与出处，**抽取 gloss 前必须剥离**，否则会混入例句 |
| 词形变化 | `<tns>` `<gramGrp>` `<gen>` `<number>` | fut./aor./pf.、Med./Pass.、ὁ/ἡ/τό 等 |

### 2.3 索引方式（`scripts/build-greek-index.mjs`）

1. 顺序扫描 `<div2 …>`，按出现位置切块（平级结构，无需 DOM 解析器）。
2. 只要 `type="main"` 且有 `<head>`；词头取 `<head>` 纯文本。
3. **检索键 = 规范化词头**：`NFD` 去组合变音符 → `ς→σ` → 小写 → 只保留 `α-ω`。
   - 这一步是必需的：`ψῡχ-ή` 与 `ψυχή`、`γράφω` 与查询串 `γραφω` 必须命中同一键。
4. gloss = 第一个 `<sense>` 块内、剥离 `<cit>/<bibl>` 后的 `<i>` 斜体串拼接（截断 400 字符）。
5. 同键冲突（同形异词、分合条目）保留 gloss 更长的一条，并计入 `stats.collisions`。
6. 每条的 `sourceUrl` 指向固定 commit 的 `blob#L<行号>`，行号由扫描时的换行位置二分查找得到，可点击复核。

当前规模：

```
86 个分卷 / 112,307 个 type="main" 条目 / 110,938 个规范化词头 / 1,369 次同键冲突 / 索引 31.3 MB
```

查询：

```bash
node scripts/build-greek-index.mjs                # 重建（约 2 秒）
node scripts/build-greek-index.mjs --query ψυχή   # 查单个词头
```

索引里 `license`/`licenseUrl`/`licenseNote` 只在**顶层 `source`** 记一次，不逐条重复；逐条记录的许可与判定见 `analysis/greek-verification/*.json`。

### 2.4 复现下载

```bash
mkdir -p analysis/reference/greek/lsj analysis/reference/greek/perseus
for i in $(seq -w 1 86); do
  curl -s -o analysis/reference/greek/lsj/greatscott$i.xml \
    https://raw.githubusercontent.com/helmadik/LSJLogeion/master/greatscott$i.xml
done
curl -s -o analysis/reference/greek/perseus/middle-liddell.xml \
  https://raw.githubusercontent.com/PerseusDL/canonical-pdlrefwk/master/data/viaf66541464/001/viaf66541464.001.perseus-eng1.xml
```

（Windows Git Bash 下 `xargs -P` 会因 `bc_ctl.arg_max` 断言崩溃，请改用 `for … & wait` 分批并发，如上。许可全文另存于 `analysis/reference/greek/perseus/LICENSE.md` 与 LSJLogeion 的 `LICENSE.md`。）

---

## 3. 同一 LSJ 文本的多个镜像不算独立来源

必须写清，且已在 `analysis/greek-verification/*.json` 的 `note`/`borrowingPathNote` 中逐条体现：

1. **LSJLogeion 与 Perseus 的 LSJ 是同一编纂来源。** LSJLogeion 的 README 自述为 “the heavily edited local Chicago version of the Perseus LSJ”；两者底本都是 LSJ 第 9 版（1940）。前者只是后者的校订转写。
2. **Middle Liddell 也不是独立来源。** 它是 Liddell–Scott 系列的缩编本（*An Intermediate Greek-English Lexicon*, 1889），与 LSJ 同一编者谱系、同一词书传统。LSJ 与 Middle Liddell 释义一致，只能说明「同一传统的转写没有分歧」，**不能**当作交叉核验。
3. **因此本次 6 个成分的 verdict 全部只由 G3 单源支撑**，`coverage.borrowing-path` 一律 `not-covered`。要真正交叉核验希腊语义项，需要**不同编纂者**的词书（如 Pape, Bailly, DGE, Cambridge Greek Lexicon），本仓库尚未引入。
4. **更关键的一条**：即便有两个独立的希腊语词书，也只能证明「希腊语词 X 有此义」，**不能**证明「英语词素 Y 借自 X」。`borrowing-path` 必须另有拉丁/法语/英语词书或英语词源词典证据；本次一律记为 `not-covered`。

### 已识别的「易夸大点」

| 成分 | 容易说过头的话 | 实际证据边界 |
| --- | --- | --- |
| cx-psych | 「查到 ψυχή = soul/mind，所以 psychology 来自 ψυχή」 | LSJ 只证明 ψυχή 有「生命/灵魂/自我」义；psychology 的拉丁—英语构词链未取证。且 ψυχή ≠ mind（mind 常对应 νοῦς） |
| cx-logy | 「λόγος = 学科」 | LSJ 的 λόγος 无「学科」义；「学科」是 19 世纪英语 -logy 的后缀义 |
| cx-metr | 「μέτρον = 格律，所以 -meter 是格律」 | μέτρον 的 sense I 是「量度」，sense II 才是「格律」；-meter/-metry 取 sense I |
| cx-graph | 「graphein 就是 -graph 的词干」 | -graph 经法语/拉丁 -graphus 进入英语，不是直接截取希腊语动词词干 |
| cx-phon / cx-chron | 相对干净 | 义项单一、直接对应；但借词路径同样未取证 |

---

## 4. 本批核验结果（G3 单源）

| 成分 | 词库 ID | claim.type | verdict | 说明 |
| --- | --- | --- | --- | --- |
| γράφω | `cx-graph` | root-sense | supports | sense I「scratch, graze」→「represent by lines」；sense II「express by written characters, write」 |
| φωνή | `cx-phon` | root-sense | supports | sense 1「sound, tone / the sound of the voice」；I「speech, voice, utterance」 |
| χρόνος | `cx-chron` | root-sense | supports | sense 1「time in the abstract」；sense 2「a definite time, period」 |
| μέτρον | `cx-metr` | root-sense | supports | sense 1「that by which anything is measured」；I.1「measure, rule」 |
| λόγος | **`cx-logy`** | root-sense | supports | sense VI「verbal expression or utterance」；III.5「reason, ground」 |
| ψυχή | `cx-psych` | root-sense | supports | sense II「departed spirit, ghost」；III「the immaterial and immortal soul」 |

> **ID 更正**：任务书写的 `cx-log` 在 `src/content/lexicon/morphemes.json` 中不存在；实际条目为 **`cx-logy`**（`form: "logy"`，`allomorphs: ["ology","log"]`）。核验记录按实际 ID 命名，并在 `cx-logy.json` 的 `idNote` 中注明。`cx-leg` 是拉丁来源（`rx-legal` 系），不在本批。

回验（本地运行，字典文件不入库）：

```
$ node scripts/check-greek-records.mjs
检查 6 份记录、12 条 record、回验 12 条 quote
全部通过：quote 均为参考文本原文子串，quoteNormalized 可复算，verdict 自洽。
```

负向测试：把 `cx-metr.json` 的 quote 改一个词（`anything`→`everything`），脚本以非零码退出并同时报出「quote 非原文子串」与「quoteNormalized 与规范化结果不符」；改回后恢复通过。

---

## 5. 入库与再分发

- 下载的 `*.xml`、`analysis/greek-index.json` 均**不提交**（`analysis/` 已 gitignore），符合「不提交下载的字典文件」。
- 但 `.gitignore` 也一并忽略了 `analysis/greek-verification/*.json`。若需把核验记录作为可复核产物提交，需二选一：`git add -f analysis/greek-verification/`，或先在 `.gitignore` 放开父目录（`!analysis/`）再加子目录例外——父目录被排除时，子目录的 `!` 规则不生效（本任务未改动 `.gitignore`）。
- 任何被提交的 LSJ 摘录文字仍受 CC BY-SA 4.0 约束，须保留：LSJ 版本信息、Perseus Tufts 与 Helma Dik/Logeion 署名、条目永久链接、许可声明。
