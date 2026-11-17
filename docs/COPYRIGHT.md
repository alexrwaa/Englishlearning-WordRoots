# 版权与内容来源说明

WordRoots 是公开开源项目，代码采用 MIT License。**软件代码与第三方教材内容的授权必须分开处理。**

## 1. 代码

`src/`、`src-tauri/`、`scripts/` 下的源代码为原创作品，MIT License。

## 2. 课程内容

`src/content/**` 下的课程 JSON 为**原创撰写**的中文讲解、原创例词分析、原创练习题。
写作时参考了下列资料的知识框架与事实，但**未复制、未摘录、未改写整段原文**：

### 2.1 English Vocabulary Elements (3rd ed.), Oxford University Press

- 仅作个人学习与**事实核对**来源。
- 该书的 EPUB、正文、摘录**不在本仓库、发布包或 Actions Artifacts 中**。
- 引用方式：课程 `sources` 中标注 `S1` 与章节名，用于说明知识点依据。

### 2.2 Essentials of Linguistics, 2nd ed.（CC BY-NC-SA 4.0）

- 作者：Catherine Anderson, Bronwyn Bjorkman, Derek Denis, Julianne Doner, Margaret Grant,
  Nathan Sanders, Ai Taniguchi。
- 来源：https://ecampusontario.pressbooks.pub/essentialsoflinguistics2/
- 使用方式：参考其 Morphology / Semantics / Historical Linguistics 的概念框架，
  课程中以 `S2` 标注。
- 未收录原书正文。若后续引入改编内容，必须保留署名、许可声明、修改说明，并以相同许可共享。

### 2.3 WordWorks / Structured Word Inquiry

- 来源：https://www.wordworkskingston.com/WordWorks/
- 使用方式：参考其 Word Sum、Word Matrix、四问探究法的**方法论**，并据此自行设计交互与练习。
- 未复制、未分发其讲义 PDF。公开可访问不等于可再分发。

### 2.4 New Word-Analysis（William Swinton, 1879）

- 来源：Project Gutenberg #19346（美国境内为公有领域）。
- 使用方式：仅作历史对照，用于说明 19 世纪词根教学法的分类方式。
- **其词源结论不作为现代语言学结论**：所有涉及词源的主张均按现代参考复核，
  无法复核的不写入课程。

### 2.5 现代参考（S5）

- 词源与语义演变以现代辞书与词源参考为准（如在线词源词典、OED 等公开条目），
  课程中标注 `S5` 并在 `detail` 写明具体条目。

## 3. 构建与分发

- GitHub Actions 不下载、不缓存、不上传任何受版权保护的教材原文。
- 发布 ZIP 仅包含：可执行文件、原创课程 JSON、说明文件。`scripts/package-portable.ps1`
  会校验压缩包中不含 `.epub` / `.pdf`。
- 仓库 `.gitignore` 排除了本地资料目录（`.materials/`）。

## 4. 侵权处理

如权利人认为本仓库内容侵犯其权利，请提交 issue，我们会在核实后移除相关内容。
