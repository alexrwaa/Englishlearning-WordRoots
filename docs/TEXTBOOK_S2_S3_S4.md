# 四组教材的教学覆盖审计（由脚本生成）

<!-- 本文件由 `node scripts/audit-textbook.mjs` 生成，请勿手改；改口径请改脚本后重跑。 -->
<!-- audit-digest: sha256:47576ff60f83623b -->

审计对象：`src/content/weeks/week01..week39`，**243 节课 / 1234 张卡 / 1543 道练习**。

判定口径（三段式，四组共用）：

| 门槛 | 机器判定 |
| --- | --- |
| taught | 卡片正文有实质讲解（正文 ≥120 字，或 ≥80 字且含定义句），且至少出现 1 个真实例词；card.terms 术语表不算 |
| practiced | 练习的题干（prompt/sentence/parts）直接问该点；或在讲过该点的课时里，正确选项/答案本身就是该点（术语填空、判断哪一项属于该类）。只在解析里提一句不算 |
| feedback | 该练习的 explain 或 whyNot ≥40 字，能说明对错理由 |

**complete** = 三者齐；**partial** = 有讲解，但缺例词、或缺定点练习、或缺解析；**missing** = 正文没有讲解。术语表（`card.terms`）不计入讲解；只在解析里提一句不算 practiced；题干里有词、但题目问的是别的事，也不算。

## 总览

| 教材 | 总体 | complete / partial / missing | 教学覆盖率 |
| --- | --- | --- | --- |
| S1 *English Vocabulary Elements* (3e) | 283 个知识点（全量） | **283** / 0 / 0 | 283/283 = 100.0% |
| S2 *Essentials of Linguistics* (2e) | 43 个概念 | **43** / 0 / 0 | 43/43 = 100.0% |
| S3 WordWorks（SWI） | 5 个环节 | **5** / 0 / 0 | 5/5 = 100.0% |
| S4 *New Word-Analysis* (1879) | 16 项内容 + 7 条旧说 | **16** / 0 / 0 | 16/16 = 100.0% |

S4 的 complete 表示「内容教到且旧说已显式隔离」；隔离档位另见第四节。

## 一、S1：283 个知识点的全量判定

口径说明：S1 的知识点只有中文标题、没有统一概念名。脚本用「标题的**区别性汉字**在卡片正文中的覆盖比例」锁定讲解卡（汉字按 283 个标题的 IDF 加权，覆盖 ≥0.10 视为相关卡），再要求相关正文合计 ≥120 字且出现例词；练习用同一比例，≥0.35 才算练到。这是全量机器统计，不是人工逐条核对，误差见下方抽样校准。

| 章 | complete | partial | missing |
| --- | --- | --- | --- |
| S1-C1 | 16 | 0 | 0 |
| S1-C10 | 35 | 0 | 0 |
| S1-C11 | 23 | 0 | 0 |
| S1-C2 | 31 | 0 | 0 |
| S1-C3 | 38 | 0 | 0 |
| S1-C4 | 19 | 0 | 0 |
| S1-C5 | 11 | 0 | 0 |
| S1-C6 | 23 | 0 | 0 |
| S1-C7 | 31 | 0 | 0 |
| S1-C8 | 36 | 0 | 0 |
| S1-C9 | 20 | 0 | 0 |

**与 0.8.0 的 30 条人工抽样对照**：一致 27/30。不一致条目：

- kp-s1c2s8-4（诺斯借词与同源双式词）：人工 partial → 脚本 complete（overlap 0.56）
- kp-s1c5s6-1（元音按舌位高低前后与松紧描写）：人工 partial → 脚本 complete（overlap 0.77）
- kp-s1c8s8-3（语言管控为何屡屡失败）：人工 partial → 脚本 complete（overlap 0.12）

三处不一致都是「0.8.0 人工判 partial → 现在 complete」：抽样是旧内容的快照，不是当前口径的判决。kp-s1c5s6-1 与 kp-s1c8s8-3 是补了定点练习（w23d6-p6、w07d5-p7）；kp-s1c2s8-4 是覆盖率口径的已知误报——它含两个并列子项（诺斯借词 / 同源双式词），前半被练到就拉高了整条标题的覆盖率，这条至今仍是机器高估，不是补出来的。

**非 complete 的 0 条**（完整清单见 `docs/textbook-audit.json`）：

- 无

0.9.2 的缺口归因与处理（逐条见 docs/GAP_CLOSURE.md）：41 条 partial 中 23 条是「有题但审计没识别」——题干换了说法，字符覆盖率到不了 0.35（例如「152 个单成分词」考「词汇丰富的两面性」）；这 23 条由 S1_PRACTICE_ANCHORS 人工登记（另有 2 条新增练习的覆盖口径低于 0.35，也用锚点登记），每条锚点带一个 must 正则，必须命中该题的题干/选项/答案，题被改写就不再计分（gap-closure.test.ts 逐条复核）。14 条真正缺定点练习，补了 13 道原创题（w07d5 的两条共用一个判断）；4 条正文没讲到（三阶段框架、四重收益、借词层音系规则、单音节词根的两种命运），补正文并各补一道题。S1 共补 17 道题、4 张新卡、2 处正文补句。evidence.practice.how 标出该条走的是 anchor 还是 recall；evidence.teaching 指向讲解该点的实质卡（4 条由 S1_TEACHING_OVERRIDES 指定，因为最高覆盖率的卡是邻近概念）。

## 二、S2：43 个概念

| 概念 | 判定 | 讲解证据 | 练习证据 | 旧判定 |
| --- | --- | --- | --- | --- |
| 形态学（morphology） | complete | w32d4 · w32d4-c1 · 先给已经做过的事命名 | w32d4 · w32d4-p1 · mcq | taught |
| 语素（词素）（morpheme） | complete | w01d1 · w01d1-c4 · 词素不是音节，也不是字母块 | w01d1 · w01d1-p3 · cloze | taught |
| 自由语素与黏着语素（free / bound morpheme） | complete | w01d1 · w01d1-c3 · 四种基本类型：先建立坐标 | w01d1 · w01d1-p3 · cloze | taught |
| 词根、词基与词干（root / base / stem） | complete | w01d2 · w01d2-c1 · 词根：词族里那块承载核心意义的部分 | w01d2 · w01d2-p1 · mcq | taught |
| 词缀的五种位置（prefix / suffix / infix / interfix / superfix） | complete | w01d4 · w01d4-c1 · 前缀与后缀：位置决定分工 | w01d4 · w01d4-p5 · mcq | taught |
| 屈折与派生（inflectional vs derivational morphology） | complete | w01d4 · w01d4-c2 · 屈折与派生：造新词还是不造新词 | w01d3 · w01d3-p1 · mcq | taught |
| 能产性（productivity） | complete | w02d6 · w02d6-c3 · 能产性有强弱：为什么 unhelpment 不行 | w02d6 · w02d6-p2 · mcq | taught |
| 选择限制（宿主条件）（selectional restrictions） | complete | w38d3 · w38d3-c1 · 判定三问 | w38d3 · w38d3-p4 · mcq | taught |
| 层级结构与加缀顺序（hierarchical structure / order of affixation） | complete | w12d1 · w12d1-c2 · 层级派生：不要平铺成一串加号 | w38d6 · w38d6-p6 · mcq | taught |
| 阻塞（同义形式互斥）（blocking） | complete | w39d3 · w39d3-c6 · 阻塞：已有的词占住了位置 | w39d3 · w39d3-p6 · mcq | partial |
| 词汇化（lexicalization） | complete | w01d6 · w01d6-c3 · understand：已经词汇化 | w11d2 · w11d2-p6 · mcq | taught |
| 复合（compounding） | complete | w07d1 · w07d1-c3 · 复合词不是自由短语 | w06d1 · w06d1-p2 · mcq | taught |
| 向心复合词与离心复合词（endocentric / exocentric compound） | complete | w07d1 · w07d1-c4 · 语义不可完全预测：greenhouse 与 redhead | w07d1 · w07d1-p5 · mcq | taught |
| 并列复合词（dvandva (coordinate compound)） | complete | w36d4 · w36d4-c6 · 第三种复合：并列（dvandva） | w36d4 · w36d4-p6 · mcq | missing |
| 语素变体（allomorphy / allomorph） | complete | w03d5 · w03d5-c1 · 三个拼写，一个词素 | w17d1 · w17d1-p3 · cloze | taught |
| 语音条件变体与词汇条件变体（phonologically vs lexically conditioned allomorphy） | complete | w38d1 · w38d1-c7 · 反例来了：blessed 与 learned | w24d2 · w24d2-p1 · mcq | taught |
| 零形式与零派生（zero affix / zero derivation） | complete | w36d5 · w36d5-c1 · 零词缀转换，靠什么标记 | w36d1 · w36d1-p2 · mcq | taught |
| 异干互补（suppletion） | complete | w17d5 · w17d5-c2 · 英语里的四类异干 | w17d5 · w17d5-p1 · mcq | taught |
| 内部屈折、元音变换与元音变音（internal change / ablaut / umlaut） | complete | w17d2 · w17d2-c1 · 先有规则，后有例外 | w17d2 · w17d2-p1 · mcq | taught |
| 重叠（reduplication） | complete | w37d2 · w37d2-c6 · 重叠：把词或词的一部分再说一遍 | w37d2 · w37d2-p6 · mcq | partial |
| 截短（clipping） | complete | w07d5 · w07d5-c4 · 逆构、截短、派生：三种方向 | w07d4 · w07d4-p1 · mcq | taught |
| 混成（blend / portmanteau） | complete | w07d3 · w07d3-c2 · 高频混成词一览 | w07d3 · w07d3-p1 · mcq | taught |
| 首字母缩略词与首字母缩写（acronym / initialism） | complete | w07d4 · w07d4-c2 · acronym 与 initialism：全看怎么读 | w07d4 · w07d4-p3 · cloze | taught |
| 逆构词（back-formation） | complete | w07d5 · w07d5-c1 · 先有 editor，后有 edit | w07d5 · w07d5-p2 · mcq | taught |
| 转换（转类）（conversion） | complete | w36d5 · w36d5-c1 · 零词缀转换，靠什么标记 | w36d5 · w36d5-p5 · mcq | taught |
| 重新分析（reanalysis / rebracketing） | complete | w13d3 · w13d3-c4 · agenda：从复数被重新分析成单数 | w13d3 · w13d3-p2 · cloze | taught |
| 民间词源（folk etymology） | complete | w21d5 · w21d5-c4 · 民间词源：把陌生形式改成熟悉形式 | w09d6 · w09d6-p3 · mcq | taught |
| 类推（analogy） | complete | w37d3 · w37d3-c1 · 不是加词缀，是照架子搭 | w37d3 · w37d3-p5 · mcq | taught |
| 借词与借词层次（borrowing / stratification of loanwords） | complete | w26d2 · w26d2-c3 · 英语词汇的层 | w09d1 · w09d1-p1 · mcq | taught |
| 词义变化的类型（types of semantic change） | complete | w21d4 · w21d4-c1 · 教材的四类动因 | w36d3 · w36d3-p2 · mcq | taught |
| 语法化（grammaticalization） | complete | w36d3 · w36d3-c6 · 另一条通道：实词变语法词 | w36d3 · w36d3-p6 · cloze | missing |
| 形态类型学（孤立/黏着/屈折/多式综合）（morphological typology） | complete | w33d4 · w33d4-c6 · 四种类型：一张十九世纪的标签表 | w33d4 · w33d4-p6 · mcq | partial |
| 形态树形图（morphological tree diagram） | complete | w38d6 · w38d6-c6 · 把三层算式画成树：每个节点都必须是一个词 | w38d6 · w38d6-p6 · mcq | partial |
| 结构歧义（structural ambiguity） | complete | w38d2 · w38d2-c6 · 两套切法都合法：结构歧义 | w38d2 · w38d2-p6 · mcq | partial |
| 格（case） | complete | w13d1 · w13d1-c2 · taurus 的单数五形 | w13d1 · w13d1-p4 · mcq | taught |
| 一致关系（agreement） | complete | w28d4 · w28d4-c4 · 形容词要跟着名词走三遍 | w28d4 · w28d4-p4 · mcq | taught |
| 时与体的区分（tense vs aspect） | complete | w35d2 · w35d2-c6 · 时与体：两个范畴，不是一个 | w35d2 · w35d2-p6 · mcq | partial |
| 拟声与根造词（onomatopoeia / root creation） | complete | w37d1 · w37d1-c1 · 拟声不是录音 | w37d1 · w37d1-p1 · mcq | taught |
| 专名词与商标普通化（eponym / genericization） | complete | w10d6 · w10d6-c2 · -gate：一个专名如何变成后缀 | w10d6 · w10d6-p3 · cloze | taught |
| 音位置换（metathesis） | complete | w34d1 · w34d1-c6 · 另一类音变：两个音换了位置 | w34d1 · w34d1-p6 · cloze | partial |
| 拼读式读音（spelling pronunciation） | complete | w15d4 · w15d4-c5 · 四个容易踩的坑 | w15d4 · w15d4-p6 · cloze | missing |
| 过度纠正与超外来（hypercorrection / hyperforeignism） | complete | w16d3 · w16d3-c4 · scissors：一次改错词根的“修复” | w16d3 · w16d3-p6 · mcq | taught |
| 语义漂白/磨损（semantic bleaching） | complete | w22d4 · w22d4-c2 · 磨损：内容义退，功能义进 | w22d4 · w22d4-p2 · mcq | taught |

**判定发生变化的 10 条**（旧报告的 taught 不分「有例词 / 有定点练习」，新口径把它拆成 complete 与 partial）：

- 阻塞（同义形式互斥）（blocking）：旧 partial → **complete**，讲解 w39d3 · w39d3-c6 · 阻塞：已有的词占住了位置，练习 w39d3 · w39d3-p6 · mcq
- 并列复合词（dvandva）：旧 missing → **complete**，讲解 w36d4 · w36d4-c6 · 第三种复合：并列（dvandva），练习 w36d4 · w36d4-p6 · mcq
- 重叠（reduplication）：旧 partial → **complete**，讲解 w37d2 · w37d2-c6 · 重叠：把词或词的一部分再说一遍，练习 w37d2 · w37d2-p6 · mcq
- 语法化（grammaticalization）：旧 missing → **complete**，讲解 w36d3 · w36d3-c6 · 另一条通道：实词变语法词，练习 w36d3 · w36d3-p6 · cloze
- 形态类型学（孤立/黏着/屈折/多式综合）（typology）：旧 partial → **complete**，讲解 w33d4 · w33d4-c6 · 四种类型：一张十九世纪的标签表，练习 w33d4 · w33d4-p6 · mcq
- 形态树形图（tree-diagram）：旧 partial → **complete**，讲解 w38d6 · w38d6-c6 · 把三层算式画成树：每个节点都必须是一个词，练习 w38d6 · w38d6-p6 · mcq
- 结构歧义（structural-ambiguity）：旧 partial → **complete**，讲解 w38d2 · w38d2-c6 · 两套切法都合法：结构歧义，练习 w38d2 · w38d2-p6 · mcq
- 时与体的区分（tense-aspect）：旧 partial → **complete**，讲解 w35d2 · w35d2-c6 · 时与体：两个范畴，不是一个，练习 w35d2 · w35d2-p6 · mcq
- 音位置换（metathesis）：旧 partial → **complete**，讲解 w34d1 · w34d1-c6 · 另一类音变：两个音换了位置，练习 w34d1 · w34d1-p6 · cloze
- 拼读式读音（spelling-pronunciation）：旧 missing → **complete**，讲解 w15d4 · w15d4-c5 · 四个容易踩的坑，练习 w15d4 · w15d4-p6 · cloze

**仍未 complete 的概念（0）**：

- 无

## 三、S3：SWI 五步

| 环节 | 判定 | 学生动手题 | 题量/题型 | 说明 |
| --- | --- | --- | --- | --- |
| 观察 | complete | w38d1 · w38d1-p6 · mcq | 1 道（mcq） | 需要课时里有一张「先写下来 / 规则先由你写」的卡（课程不给结论），并有一题要求从数据里选/写规则。 |
| 假设 | complete | w38d1 · w38d1-p6 · mcq | 6 道（mcq/judge） | judge 题型要求写出判定依据，或题干直接要求提出/选择一条可检验的规则。 |
| 验证 | complete | w38d3 · w38d3-p1 · judge | 25 道（judge/mcq） | whyNot（逐项说明为什么不成立）或「哪条证据最能说明」类题，或 judge 题型。 |
| 矩阵 | complete | w01d7 · w01d7-p6 · matrix | 28 道（matrix） | matrix 题型由学生自己填出合法格（base + prefix/suffix）。 |
| Word Sum | complete | w01d1 · w01d1-p4 · wordSum | 139 道（wordSum） | wordSum 题型由学生写出词素切分式。 |

产出型题型合计 **185/1543 = 12.0%**（wordSum 139 / matrix 28 / boundary 13 / judge 5）。

五步现在都有「学生自己动手」的题，但**观察一步只有 1 道**（w38d1-p6）：课程给出六条 -ed 读音数据、要求先写规则再翻页，第 6 题再从四条候选规则里选能同时解释数据的那条。现象仍由课程挑选，学生做的是「从给定数据归纳」，不是「从真实语料里发现问题」。

## 四、S4：16 项历史内容 + 7 条旧说

| 内容 | 旧说等级 | 隔离 | 证据（标记） |
| --- | --- | --- | --- |
| 格里姆定律（第一次日耳曼辅音推移） | 现代共识 | explicit | 「不等于」@w34d1-c3；「教材说法」@w35d6-c3；「有争议」@w35d6-c3 |
| 维尔纳定律 | 现代共识 | explicit | 「不是规律失效」@w27d5-c4 |
| 链移（推链）作为解释模型 | 有争议（解释模型） | explicit | 「一种解释模型」@w27d5-c3；「无法证明」@w27d5-c3 |
| 元音大推移 | 现代共识 | explicit | 「不等于」@w34d1-c3；「教材说法」@w35d6-c3；「有争议」@w35d6-c3 |
| 构拟与星号约定 | 现代共识 | explicit | 「不等于」@w27d5-c1；「音值仍然不明」@w28d2-c1；「音值不明」@w28d2-c1 |
| 喉音假说 | 现代共识（音值不确定） | explicit | 「音值仍然不明」@w28d2-c1；「音值不明」@w28d2-c1；「不记录音值」@w28d2-c1 |
| centum／satem 二分 | 教材旧说（作为谱系分裂） | explicit | 「不是最早的一次谱系分裂」@w28d1-c3 |
| 印欧故乡之争（库尔干／安纳托利亚／南弧） | 有争议 | explicit | 「不是定论」@w29d3-c2；「不等于」@w29d3-c2 |
| 语言考古：由共享词汇推断文化与年代 | 方法可用，个别断言过强 | explicit | 「不等于」@w29d1-c5；「教材说法」@w29d2-c1；「教材的推断」@w29d2-c1 |
| 印欧语系的分支数目（十三个） | 教材约定 | explicit | 「教材的编排约定」@w27d3-c1；「不是自然事实」@w27d3-c1；「有争议」@w27d3-c2 |
| 古英语—中古英语—现代英语三分期 | 教材约定 | explicit | 「叙述工具」@w35d2-c1；「不是事实边界」@w35d2-c1 |
| 盎格鲁—撒克逊渡海叙述（449 年） | 传统叙述 | explicit | 「传统叙述」@w35d1-c1 |
| 本土／法语／拉丁三层借词模型 | 教材简化 | explicit | 「不是全集」@w09d1-c2；「不等于」@w09d1-c3；「不等于」@w15d1-c1 |
| 拉丁读音传统与软腭软化 | 现代共识 | explicit | 「拼写不决定读音」@w15d4-c5；「不等于」@w15d6-c5 |
| 形态类型学四分（孤立／黏着／屈折／多式综合） | 教材旧框架 | explicit | 「教材说法」@w33d4-c6；「描述性概括」@w33d4-c6；「已被抛弃」@w33d4-c6 |
| 词义变化是否有规律 | 现代共识（有限规律） | explicit | 「不是唯一答案」@w36d3-c4；「候选路径」@w36d3-c4 |

| # | 旧说 | 位置 | 隔离 | 证据 |
| --- | --- | --- | --- | --- |
| 1 | centum／satem 的二分是印欧语最早的一次谱系分裂。 | w28d1, w27d3 | explicit | 「不是最早的一次谱系分裂」@w28d1-c3 |
| 2 | 印欧故乡在黑海—里海草原，靠马与轮车的军事优势分三波扩张并取代当地人。 | w29d3 | explicit | 「不是定论」@w29d3-c2；「不等于」@w29d3-c2 |
| 3 | 英语词汇由本土、法语、拉丁三层构成。 | w09d1 | explicit | 「不是全集」@w09d1-c2；「不等于」@w09d1-c3 |
| 4 | 祖语有轮、轴、轭的成套词汇，所以祖语不可能早于公元前四千纪末散开。 | w29d2 | explicit | 「教材的推断」@w29d2-c3；「教材由此给出」@w29d2-c3；「不是硬约束」@w29d2-c3 |
| 5 | 祖语没有共同的「铁」词，所以铁器传入时印欧语已经散开。 | w29d2 | explicit | 「教材说法」@w29d2-c1；「教材的推断」@w29d2-c1；「不单独证明」@w29d2-c1 |
| 6 | 语言可按孤立／黏着／屈折／多式综合分成四类。 | w33d4 | explicit | 「教材说法」@w33d4-c6；「描述性概括」@w33d4-c6；「已被抛弃」@w33d4-c6 |
| 7 | 长元音整体上移一格。 | w35d6 | explicit | 「教材说法」@w35d6-c3；「有争议」@w35d6-c3；「不是事实边界」@w35d6-c3 |

旧说隔离分布：explicit 7。

**泄漏检查**：`s4-elements.json` 中标 `obsolete:true` 的条目共 7 条，按旧义教学的模式命中 0 处。

## 五、脚本与旧报告的冲突

| 组 | 条目 | 旧报告 | 当前 | 原因 |
| --- | --- | --- | --- | --- |
| S2 | blocking | partial | complete | 0.9.1（commit d14a162）补了正文 / 例词 / 练习，脚本按当前内容重判 |
| S2 | dvandva | missing | complete | 0.9.1（commit d14a162）补了正文 / 例词 / 练习，脚本按当前内容重判 |
| S2 | reduplication | partial | complete | 0.9.1（commit d14a162）补了正文 / 例词 / 练习，脚本按当前内容重判 |
| S2 | grammaticalization | missing | complete | 0.9.1（commit d14a162）补了正文 / 例词 / 练习，脚本按当前内容重判 |
| S2 | typology | partial | complete | 0.9.1（commit d14a162）补了正文 / 例词 / 练习，脚本按当前内容重判 |
| S2 | tree-diagram | partial | complete | 0.9.1（commit d14a162）补了正文 / 例词 / 练习，脚本按当前内容重判 |
| S2 | structural-ambiguity | partial | complete | 0.9.1（commit d14a162）补了正文 / 例词 / 练习，脚本按当前内容重判 |
| S2 | tense-aspect | partial | complete | 0.9.1（commit d14a162）补了正文 / 例词 / 练习，脚本按当前内容重判 |
| S2 | metathesis | partial | complete | 0.9.1（commit d14a162）补了正文 / 例词 / 练习，脚本按当前内容重判 |
| S2 | spelling-pronunciation | missing | complete | 0.9.1（commit d14a162）补了正文 / 例词 / 练习，脚本按当前内容重判 |
| S3 | observe | partial | complete | 0.9.1 在 w38d1 加了「规则先由你写 → 反例推翻」的探究环 |
| S4 | oc-wheel-date | none/partial | explicit | 0.9.1 改写为「教材说法 / 证据等级」并补了检测题 |
| S4 | oc-iron-date | none/partial | explicit | 0.9.1 改写为「教材说法 / 证据等级」并补了检测题 |
| S4 | oc-typology | none/partial | explicit | 0.9.1 改写为「教材说法 / 证据等级」并补了检测题 |
| S4 | oc-gvs-uniform | none/partial | explicit | 0.9.1 改写为「教材说法 / 证据等级」并补了检测题 |
| S1 | sample-vs-population | 30 个抽样人工判定：27 pass / 3 partial / 0 fail | 全量 283 条：283 complete / 0 partial / 0 missing；与抽样一致 27/30 | 旧报告只抽样 30 条；本脚本对 283 条全量重算，并保留抽样一致性作为校准 |

## 复现

```bash
node scripts/audit-textbook.mjs
node scripts/audit-textbook.mjs --check
npx vitest run src/lib/textbook-audit.test.ts
```

`--check` 会重算整份 JSON 并比对 `docs/textbook-audit.json` 与本文件的 digest；数据或报告过期即非零退出。

每项的 `evidence` 都带 `lessonId` 与 `cardId`/`exerciseId`，可直接按 `weekNN/dayN.json` 抽样复核。
