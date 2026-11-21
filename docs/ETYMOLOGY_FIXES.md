# 词源与构词专项订正（ETYMOLOGY_FIXES）

本文件针对 7 个高风险词条（`religion`、`intercom`、`credo`、`laptop`、`captain`、`lucid`、`psyche`）做词源与构词分析订正。数据落地在 `analysis/lexicon-batches/ety-fixes.json`，回归断言在 `src/lib/etymology-regression.test.ts`。

## 方法：每个词分开四层，不许混写

| 层 | 英文键 | 问的问题 | 常见错误 |
| --- | --- | --- | --- |
| 1 历史造词/借词过程 | `ety.historical` | 这个词实际上怎么来的？直接来源是谁？ | 把「拼得上」当「构词关系」 |
| 2 现代共时构词结构 | `ety.synchronic` | 今天的母语者还能不能拆？拆成什么？ | 拿拉丁词素切分冒充共时结构 |
| 3 教学拆分 | `ety.teaching` | 为记忆可以怎么切？ | 不标注「教学用，非历史」 |
| 4 生产性规律 | `ety.productive` | 学习者能归纳出什么可复用规则？ | 从不可能产的片段硬造规则 |

三条硬规则：

1. **拼写巧合 ≠ 构词关系**。`laptop` 的 `top` 与希腊词根 `top-`（`topos`「地方」，见 `cx-top`）只是同形，二者异源；`intercom` 的 `com` 也不是拉丁前缀 `com-`（`px-com`）。
2. **历史有分歧就保留两说**，写各自证据与置信度，不替读者二选一。
3. **`partIds` 只能指向 `morphemes.json` 里真实存在的 ID**；指向错误 ID 比留 `null` 更糟，因为错误会在词族矩阵里传播。

引用约定：`S5` = 历史/语源参考集（OED、Etymology Online、de Vaan 等），`G1` = 释义与通识词典，`S1` = *English Vocabulary Elements* 3rd，`LEX` = 本项目自定义规则。每条引用都落到**具体条目/章节/文献行**，不写「已核对」。

---

## 1. religion（n. 宗教）

- **历史（`historical`）**：拉丁 `religiō, -ōnis` → 古法语 `religion`（12c.）→ 中古英语 `religioun`（约 1200）。拉丁语内部对构成有两套互相冲突的古代分析，词根不同：`relegere`（`re-` + `legere` 读/采集）vs `religare`（`re-` + `ligare` 绑）。
- **共时（`synchronic`）**：现代英语里是**单语素借词**。`re-` 不触发「再次」解读，`-ion` 不能替换，`re + lig + ion` 只是拼写切分。
- **教学（`teaching`，非历史）**：`re`（回/再）+ `lig`（绑）+ `-ion` →「把自己重新绑住」。仅助记；若取 `relegere` 说，第二段实为 `leg`。
- **能产（`productive`）**：活的是 `religion → religious → religiously → religiosity`；`lig-` 聚合（`oblige`、`ligament`、`league`）真实存在，但 `religion` **不在**其中，不能借它教 `lig-`。
- **保留争议**：
  - `relegere` 说｜证据：西塞罗 *De natura deorum* 2.72「a relegendo」；`relegere→religio` 与 `legere→legio` 同为 `-io` 名词化；OED 3rd s.v. religion、de Vaan *EDL* s.v. religio 为主流。置信度 **medium-high**。
  - `religare` 说｜证据：拉克坦提乌斯 *Div. inst.* 4.28、奥古斯丁 *De vera religione* 的基督教辩护，语义吸引力强；弱点：`ligare` 的规则动作名词是 `religatio`，`religio` 形态不合。置信度 **low-medium**。
- **裁定**：`verified: false`。现有 `re+lig+ion` 切分隐含采信了有争议的 `religare` 一说，不能标 verified。

## 2. intercom（n. 内部通话系统）

- **历史（`historical`）**：美国英语 **1918** 年前后的截短复合词，直接来源 `intercommunication`（`inter-` + `communication`）的缩略，早期指舰船/办公楼内的内部通话装置，曾带商标色彩。不是拉丁词。
- **共时（`synchronic`）**：可拆为 `inter-`（能产前缀「之间/相互」）+ `com`，其中 `com` 是 `communication` 的**截短残余**，**不是**拉丁前缀 `com-`「共同」。「内部」义来自 `inter-` 而不是 `com`。
- **教学（`teaching`，非历史）**：`inter`（之间/内部）+ `com`（communication 的截短）→ 内部通话。禁止教成 `in- + com`「共同」，也禁止挂到 `px-com`。
- **能产（`productive`）**：`inter-` 能产（`intercity`、`interface`、`international`、`intercom`）；截短词尾本身不成规则，不能类推 `*interphone`。
- **保留争议**：无（词源清楚）。真正的风险是同形误挂，已用 `note` 记录。
- **裁定**：`parts` 记为整词 `["intercom"]`、`partIds=[null]`、`verified: true`（*指「整词处理已复核」，不是声称不可拆）——词根库中没有「截短 com」对应的 ID，宁可留 `null` 也不挂 `px-com`。

## 3. credo（n. 信条）

- **历史（`historical`）**：直接借自拉丁 `credō`「我相信」——第一人称单数现在时陈述式，是《使徒信经》《尼西亚信经》拉丁文本首词。英语 16c 指「信经」，19c 泛指「个人信念」。同源词 `creed` 走另一条路：古英语 `crēda` < 拉丁 `credo`，已被英语化。
- **共时（`synchronic`）**：**整体借入的名词**。词尾 `-o` 既非英语后缀，也非连接元音，而是拉丁第一人称单数**屈折词尾**，标记「我说」的语法信息。
- **教学（`teaching`，非历史）**：`cred`（相信）+ `-o`（拉丁语「我」）→「我相信」。必须同时说明 `-o` 是屈折词尾，不是 `cx-o`（希腊连接元音），否则学生会把 `video`、`audio` 也按连接元音解释。
- **能产（`productive`）**：① `cred-` 能产（`credit`、`credible`、`credential`、`incredulous`、`creed`）；② 借词整句首词作名词时，词尾元音是形态标记（`credo`、`placebo`「我将取悦」、`video`「我看见」、`ego`、`item`）。学到的是「别把借词词尾当后缀」，不是「`-o` 能造名词」。
- **保留争议**：无。
- **裁定**：`parts=["credo"]`、`partIds=[null]`、`verified: true`（*同指「整词处理已复核」）。原 `cred + o → cx-o` 属同形误挂。

## 4. laptop（n. 笔记本电脑）

- **历史（`historical`）**：20c 80 年代初（1983–84）的现代复合词，早期作 `lap-top (computer)`，以 `desktop` 为模板。两个成分都是本土日耳曼词：`lap` < 古英语 `læppa`「衣摆、膝上」，`top` < 古英语 `topp`「顶端」。**与拉丁/希腊词根无关**。
- **共时（`synchronic`）**：完全透明的向心复合词，`lap`（处所）+ `top`（上面），整体义可由成分推出；是**自由语素复合**，不是词根+词缀派生。
- **教学（`teaching`，非词根切分）**：`lap`（膝上）+ `top`（上面）。必须声明 `top` 与希腊 `top-`（`topos`「地方」，`cx-top`，如 `topology`）**同形异源**。
- **能产（`productive`）**：英语 N+N 复合表处所/用途（`laptop`、`desktop`、`palmtop`、`tabletop`、`hilltop`），修饰语在前、中心词在后；`-top` 一度成为「一类电脑」的能产尾巴。属**复合构词**，不属拉丁词根派生。
- **保留争议**：无。
- **裁定**：`parts=["laptop"]`、`partIds=[null]`、`verified: true`（*整词处理已复核）。原 `[lap, top] → [null, cx-top]` 是同形异源误挂的实例，与 `homograph-fix.json` 处理 `terr`/`sex` 的原则一致。

## 5. captain（n. 船长；队长）

- **历史（`historical`）**：中古英语 `capitain`（14c）< 古法语 `capitain/capitaine`（12c）< 晚期拉丁 `capitaneus`「首领」< 拉丁 `caput, capitis`「头」+ `-aneus`。属**整词借入**：英语没有经历「`caput` + `-ain`」这一步。
- **共时（`synchronic`）**：`capt-`（`capital`、`decapitate` 的「头」）+ `-ain`；`capt` 是 `capit-` 的缩合形式。但 `-ain` 只出现在 `captain`、`chieftain`、`chaplain`、`sovereign`、`villain` 这个封闭词集，**不是能产后缀**。
- **教学（`teaching`）**：`capt`（头；首要）+ `-ain`（……的人）→ 领头的人。须补一句「`-ain` 只在这几个词里，不能造新词」。
- **能产（`productive`）**：① `cap-`「头」能产：`capital`、`capitalism`、`decapitate`、`capitulate`、`per capita`；② `-ain` 不能产，整词记；③ 高频陷阱：`capt-` 另有 `capere`「抓」的来源（`capture`、`captive`、`captivate`），与「头」义**同形异源**，不可互推。
- **保留争议**：无。切分与 `rx-capit` 声明的 allomorph `capt` 一致。
- **裁定**：`verified: true` 保留；非能产性写入 `ety.productive`，不靠 `sx-ain` 的 gloss 教规则。

## 6. lucid（adj. 清晰的；明亮的）

- **历史（`historical`）**：拉丁 `lucidus` < `lucēre`「发光」< `lux, lucis`「光」。16c 经法语 `lucide` 或直接自拉丁入英，早期用于医学/天文（`lucid interval` 清醒期），17c 起有「（表达、思路）清楚」的比喻义。
- **共时（`synchronic`）**：`luc-`（语义不透明的粘着词根）+ `-id`（拉丁 `-idus` 形容词后缀，同 `rigid`、`humid`、`tepid`、`placid`、`vivid`）。`-id` 模式可识别，`luc-` 的「光」义要靠词族唤起，属半透明结构。
- **教学（`teaching`）**：`luc`（光）+ `-id`（有……性质的）→ 有光的 → 明白的。`-id` 可作规则教，`luc-` 只在本词族内教。
- **能产（`productive`）**：① `-id` 形容词（`rigid`、`humid`、`liquid`、`placid`、`vivid`、`tepid`）；② `luc-` 词族：`elucidate`、`translucent`、`lucifer`、`lucidity`，同出 PIE `*lewk-`；③ 拉丁 `lux/luc-`（光）与 `lumen/lumin-`（光源）是**两个词位**，只同根。
- **保留争议**：**词素归属之争（非词源之争）**——`luc-` 是否应独立为 `rx-luc`，而不是作 `cx-lumen-lumin` 的 allomorph。证据：`lux` 与 `lumen` 在拉丁语中是独立词位；合并会让「发光/光源」混为一谈，拆开又会断掉 `lucid/translucent/elucidate` 的聚合。置信度 **medium**，留给主端决定。
- **裁定**：`verified: true`（`luc + id` 与 `lucidus < lucere` 一致），归属问题以 `contested` 显式保留。

## 7. psyche（n. 心灵；精神）

- **历史（`historical`）**：希腊 `ψυχή` (psūkhē)「气息、生命、灵魂」，一般认为与 `psūkhein`「吹、呼吸」同源。神话中 Psykhē 是 Eros 的凡间妻子，后世寓意「灵魂」（阿普列乌斯《金驴记》）。英语 17c（1640s）借入为「灵魂/精神」；19c 经德语心理学传统（`Psychologie`）确立「心灵」这一术语义。
- **共时（`synchronic`）**：`psych-` 是高度能产的**粘着组合形式**（`psychology`、`psychic`、`psychiatry`、`psychosomatic`）；`psyche` 本身是整体借词，词尾 `-e` 拼写希腊 `-η` (ēta)，既非英语后缀，也不是正字法的「沉默 e」。
- **教学（`teaching`）**：`psych`（心智）+ `-e`（希腊语词尾，非后缀）。须说明 `-e` 不承载意义、不能替换。
- **能产（`productive`）**：① `psych-` 作组合形式常带连接元音 `-o-`（`psych-o-logy`、`psych-o-sis`、`psych-o-somatic`）；② 希腊第一变格 `-η` 借入英语作 `-e`（`psyche`、`epitome`、`Nike`、`Penelope`），是**借词拼写对应**，不是能产后缀。
- **保留争议**：无。
- **裁定**：`psych → cx-psych` 正确，`verified` 保留；`e` 的 `partId` 诚实留 `null`（`partResolution` 因此为 `unresolved`，属预期），不为凑 `exact` 硬挂 `cx-o` 一类 ID。

---

## 汇总

| 词 | 历史来源（一句话） | 共时结构 | 教学拆分 | `parts` / `partIds` | verified | 争议 |
| --- | --- | --- | --- | --- | --- | --- |
| religion | 拉丁 `religio` → 古法语 → 中古英语 | 单语素借词 | `re+lig+ion`（助记） | `re+lig+ion` / `px-re, cx-lig, sx-ion` | **false** | `relegere` vs `religare`，两说并存 |
| intercom | 1918 截短自 `intercommunication` | `inter-` + 截短 `com` | `inter+com`（助记） | `intercom` / `null` | true* | 无（原 `px-com` 属同形误挂） |
| credo | 拉丁 `credō`「我相信」整词借入 | 单语素借词，`-o` 为屈折词尾 | `cred+o`（助记） | `credo` / `null` | true* | 无（原 `cx-o` 属同形误挂） |
| laptop | 1983–84 现代英语复合词 | 透明自由语素复合 | `lap+top` | `laptop` / `null` | true* | 无（原 `cx-top` 属同形异源） |
| captain | 古法语 `capitaine` < 晚期拉丁 `capitaneus` | `capt-` + 非能产 `-ain` | `capt+ain` | `capt+ain` / `rx-capit, sx-ain` | true | 无；`-ain` 非能产、`capt-` 与 `capere` 同形异源 |
| lucid | 拉丁 `lucidus` < `lucere` | `luc-` + `-id`（半透明） | `luc+id` | `luc+id` / `cx-lumen-lumin, sx-id` | true | 词素归属：`luc` 是否独立成 `rx-luc` |
| psyche | 希腊 `ψυχή` | `psych-` + 希腊语尾 `-e` | `psych+e` | `psych+e` / `cx-psych, null` | true | 无 |

### 落库状态（已闭环）

7 个词的 `parts / partIds / ety / note / sources / verified` 均已合入 `src/content/lexicon/words.json`。`src/lib/etymology-regression.test.ts` **52 项全绿**。

merge 路径的能力边界仍值得记一笔，后续批次会撞到：`scripts/lexicon-tool.ts` 对已存在词条只回填 `glossEn / etymology / semanticShift / family / example / pos / derivation`，`parts` 仅在 `verified !== false` 时覆盖，`ety / note / sources / verified` 不写入；对 morpheme 只做 `examples / allomorphs / rules / textbookRefs` 的**并集**，`glossEn` 不更新，且**无法删除**已写入的示例。

---

## 附：词族侧的 3 处修正（来自 family-deep 的交叉核对）

见 `src/content/families/*.json` 与 `morphemes.json` 对不上的地方，在本批次的 `morphemes` 段一并处理：

| 问题 | 处理 | 能否经 merge 落地 |
| --- | --- | --- |
| `rx-stru.examples` 含 `menstrual`（< 拉丁 `menstruus` < `mensis`「月」，与 `struere`「建造」同形异源） | 应从 examples 移除；已在 `fam-struct.json` 的 `homographTraps` 标为反例 | **不能**——merge 只做并集，删除必须由 merge 所有者直接改 `morphemes.json` |
| `rx-duc` 无 `familyId`，而 `words.json` 有 44 条 `fam-duct` 词条反向查不到词素 | 补 `familyId: "fam-duct"` | 能（`familyId` 属「仅填空」字段） |
| `cx-chron` 的 `allomorphs` / `examples` 空、`note` 空 | 补 `allomorphs: ["chrono"]`、6 个例词、`khronos` 词源说明（并注明 `chrono-` 的 `-o-` 是连接元音） | 能（并集 + 空字段填充） |

