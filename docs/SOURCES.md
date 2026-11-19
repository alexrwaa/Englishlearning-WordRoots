# 来源与许可（SOURCES）

本仓库只保存**派生事实**与**自有中文表述**，不保存任何教材原文（不含 PDF / EPUB / XML、不含原文段落、不含扫描页）。
本文件记录每份来源的取得状态、许可条件与署名义务，供复核与合规检查使用。

| ID | 来源 | 版本 | 角色 | 取得状态 | 许可 |
| --- | --- | --- | --- | --- | --- |
| S1 | *English Vocabulary Elements*（Oxford University Press） | 3rd | 主教材 | 已获取、已解析全文 | 用户自备副本，不在仓库内再分发 |
| S2 | *Essentials of Linguistics*（eCampusOntario Pressbooks） | 2nd | 补充教材 | 已获取、已解析（见下） | CC BY-NC-SA 4.0 |
| S3 | WordWorks / Structured Word Inquiry 资源 | — | 方法 | 5 份 PDF 已逐页解析 | 作者版权，仅本地分析，不再分发 |
| S4 | *New Word-Analysis*（W. Swinton, 1879） | — | 历史 | Gutenberg 纯文本已解析 | 公有领域（美国境内），仅保存派生事实 |

> 说明：本表是文档层面的登记，程序读取的登记表仍是 `src/content/textbook/sources.json`。两者若不一致，以解析证据（`analysis/` 下的产物）为准。

---

## S2 *Essentials of Linguistics*, 2nd edition

### 取得与解析状态

- 状态：**已获取、已解析**（形态学、语义学、历史语言学三块；其余章节只登记标题）。
- 取得形式：Pressbooks 导出的 WordPress WXR（`Essentials-of-Linguistics-2e-current.wxr.xml`，约 5.1 MB）。同目录另有 EPUB 与 PDF，仅作核对，**未打开、未复制**。
- 原始文件位置：`materials-v2/WordRoots教材资料包/02_Essentials_of_Linguistics_2e/`（仓库之外，只读）。
- 解析脚本（可重跑）：
  - `scripts/extract-s2.py` — 读 WXR，输出章节骨架与逐节纯文本到 `analysis/s2/`（该目录已 gitignore）。
  - `scripts/build-s2-topics.py` — 由人工撰写的知识点数据生成 `src/content/textbook/s2-topics.json` 与 `glossary-s2.json`，并做字段自检。
- 导出快照：WXR 生成时间 2026-09-16；原书 Revisions 页显示最近更新 2026-03-28，当前版本 2.5。
- 结构规模（仅计 status=publish）：20 个 part、165 个 chapter（导出内另有大量草稿与归档条目，不计）。重点三块共 **35 节**：Morphology 12 节、Semantics 15 节、Historical Linguistics 8 节。

### 解析范围与未纳入部分

- 纳入：Chapter 5（5.1–5.12）、Chapter 7（7.1–7.15）、Chapter 14（14.1–14.6、14.8–14.9）。
- 未纳入：14.7 *External change*、14.10–14.14 在导出中为草稿（`wp:status = draft`），故不取；Chapter 5 / 7 的练习节（5.12、7.15）只登记标题，不抽知识点。
- 其余 chapters（1–4、6、8–13、15–16、附录）只写入 `analysis/s2/outline.json` 供查，不进入课程知识点。

### 许可

- 许可协议：**Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International（CC BY-NC-SA 4.0）**。
- 允许：复制、再分发、改编、混合，包括商业以外的教学使用。
- 条件：
  1. **署名**（BY）——须标明作者、书名、版本、来源与许可，并说明是否作改动；
  2. **非商业**（NC）——不得用于商业目的；
  3. **相同方式共享**（SA）——改编作品须以同一许可分发。
- 本项目对 S2 的使用方式是「阅读后用自己的话写中文概括」，属改编；因此：
  - 本仓库整体许可以 `LICENSE` 为准，但凡源自 S2 的表述（`s2-topics.json`、`glossary-s2.json`）**同时受 CC BY-NC-SA 4.0 约束**，不得单独以更宽松条款再分发。
  - 若将来商业化，须先移除或替换 S2 派生内容。

### 署名（建议保留原文）

- 作者：Catherine Anderson、Bronwyn Bjorkman、Derek Denis、Julianne Doner、Margaret Grant、Nathan Sanders、Ai Taniguchi（Teaching in Linguistics Community of Practice, TiLCoP）。
- 书名：*Essentials of Linguistics*, 2nd edition。
- 出版方：eCampusOntario Pressbooks（由 Ontario 政府与 eCampusOntario Virtual Learning Strategy 资助）。
- 官方地址：https://ecampusontario.pressbooks.pub/essentialsoflinguistics2/
- 许可全文：https://creativecommons.org/licenses/by-nc-sa/4.0/

### 仓库内不含原文（合规声明）

- 未提交 WXR / EPUB / PDF，也未提交任何原文段落、原文例句串或图片。
- 提交的 S2 派生文件只含：章节与节的编号标题（结构性标签，用于回指）、中文概括、术语的中英对应、以及**单个词形或极短示例串**（如 `unhelpful`、`arrive`、`p : pʰ : b`）——语言事实与最小数据串，不构成原文摘录；凡需要例句说明的地方一律另造。
- 每条知识点到原节的对应关系保存在 `analysis/s2/kp-source-map.json`（含 `postId` 与官方 URL），该目录不入库，供本地复核。

---

## S3 WordWorks / Structured Word Inquiry 讲义

### 取得与解析状态

- 状态：**已获取、已逐页解析**（方法层，不作为词表来源）。
- 取得形式：5 份 PDF，位于 `materials-v2/WordRoots教材资料包/03_WordWorks_SWI_Resources/`（仓库之外，只读）。
  - `Bowers-Kirby-2010-morphological-instruction-study.pdf`（23 页）
  - `Handout-Gina-Baltimore.pdf`（12 页）
  - `Handout-IDA-Fall-2012.pdf`（11 页）
  - `Spelling-out-and-writing-out-word-structure-2018.pdf`（5 页）
  - `Workshop-Booklet-IBIDA-Nov-2012.pdf`（20 页）
- 解析方式：逐页阅读后，把可操作流程、矩阵规则、word sum 规则与立场转写为中文条目，每条附文件名与 PDF 页码。
- 产物：`src/content/textbook/s3-method.json`（14 条 practice、11 条矩阵规则、12 条 word sum 规则、7 条原则、3 条研究依据）；本地索引 `analysis/s3/extraction-report.json`（gitignore）。
- 页码约定：讲义页脚编号（“Structured Word Inquiry N” / “… N”），不是 PDF 阅读器的物理页序。

### 许可与使用边界

- 讲义标注 Susan / Peter Bowers 等作者版权；公开可访问不等于可再分发。
- 仅作个人学习与课程设计参考；未提交 PDF，未复制原文段落，引用仅限 ≤8 词短语并标页码。
- `s3-method.json` 中的条目是本项目自行撰写的教学流程说明，不是讲义译文。

### 已知限制

- 讲义没有把“四问”写成编号列表；`swi-four-questions` 的四个维度分别取自 p.2、p.6-7、p.3、p.5，编号形式是本项目为软件流程做的整合，已在 `note` 中说明。
- 讲义的流程图、矩阵版式以图片为主，提取的是文字说明与文字示例，未复原版式。

---

## S4 *New Word-Analysis*（William Swinton, 1879）

### 取得与解析状态

- 状态：**已获取、已解析**（历史对照层）。
- 取得形式：Project Gutenberg eBook #19346 的 UTF-8 纯文本，位于 `materials-v2/WordRoots教材资料包/04_New_Word_Analysis/`（仓库之外，只读）。
- 解析脚本：`scripts/extract-s34.py`，读取纯文本中的拉丁/希腊前缀表、后缀表与编号词根条目；盎格鲁-撒克逊前缀/后缀由同一脚本内的整理表生成。
- 产物：`src/content/textbook/s4-elements.json`（608 条：前缀 67、后缀 66、词根 475；拉丁 327、希腊 252、古英语 29）；本地 `analysis/s4/{summary,overlap}.json` 与 `obsolete-claims.md`（gitignore）。

### 范围

- 收录：Part II 拉丁前缀、后缀、词根；Part III 希腊前缀、词根；Part IV I-II 盎格鲁-撒克逊前缀、后缀。
- 不收录：Part IV 的盎格鲁-撒克逊词根表（约 600 条古英语词源及派生词，属历史词源清单，不是现代能产词素）、Part V 杂项派生词与人地名来源词。
- 定位：Gutenberg 纯文本无页码，`page` 为 `null`；用 `locator`（章节 + 条目号 + 行号）与 `bookEntry`（原书编号）回指。

### 许可与历史结论处理

- Project Gutenberg 标注该作品在美国境内为公有领域；美国境外使用者需自行核查当地法律。
- 仓库只保存派生事实（词素形式、释义、章节定位），不保存原文、不保存例句段落。
- 1879 年的词源结论逐条对照现代词源学：确认过时的 7 条加 `obsolete: true` 与 `note`（希腊 `dis-` 实为 `di-`、`n-` 不是能产前缀、`-fold` 非借自拉丁、`-hood/-ness` 来源已明、`-ic/-ics` 非希腊专属、`-ish` 非“to make”）。清单见 `analysis/s4/obsolete-claims.md`。
- 未标 `obsolete` 的条目不等于已确证正确；进课堂前仍需按现代词典逐条复核。
- 与 S1 的同形异源冲突（18 组）记在 `analysis/s4/overlap.json` 的 `conflicts`，禁止按形式直接合并。
