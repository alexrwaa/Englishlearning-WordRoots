# 主张深挖：12 个深度词族的借词路径与现代结构

> 本文件由 `analysis/claim-deepen/*.json` 生成（生成脚本 `analysis/claim-deepen/_build_doc.py`，
> 属本地研究脚本，未入库）。每条 `quote` 都是该词条原文的**逐字切片**，生成时断言过是原文子串。

## 这份文件回答什么

一个词族被核验过「词根在古典语里是什么意思」，**不等于**它的英语成员被核验过两件事：

1. `borrowing-path`：这些词是怎么从拉丁/希腊进入英语的？直接借词、经法语、还是近代新拉丁造词？
2. `modern-structure`：今天英语里这个族怎么切分和再生产？词基加什么前后缀？

这两类主张的证据要求不同。`borrowing-path` 必须出现**路径语句**（"from Latin X, via Old French Y"、
"borrowed from French Z"）——只说「英语 spect 对应拉丁 specere」是词根对应，不是路径，
这类记录一律 `not-covered`。`modern-structure` 必须是**共时切分**证据（词典的
`{{confix}}` / `{{suffix}}` / "Equivalent to X + Y" 分析），不能拿历史同源冒充现代派生。

## 证据强度：先说结论

| 族 | 词素 | 借词路径 | 记录 | 现代结构 | 记录 | 这句话最该被记住的部分 |
| --- | --- | --- | --- | --- | --- | --- |
| `fam-cap` | `cap`（take, seize；L capere） | supports | 3 | supports | 2 | 同一族里「经法语」和「直借拉丁」并存，不能一句话概括。 |
| `fam-chron` | `chron`（time；Gk χρόνος） | supports | 3 | supports | 4 | 希腊词族的路径至少三种：拉丁-法语转手、新拉丁造词、法语借词。 |
| `fam-duct` | `duc/duct`（lead；L ducere） | supports | 4 | supports | 3 | produce 走中古英语直承拉丁，reduce/introduce 走古法语——同族不同路。 |
| `fam-fer` | `fer`（carry；L ferre） | supports | 4 | supports | 2 | prefer 走的是**英吉利法语**（xno），不是巴黎法语；offer 其实来自古英语 offrian。 |
| `fam-form` | `form`（shape；L forma） | supports | 3 | supports | 2 | 本批四个成员全部经古法语，没有直借拉丁的样本。 |
| `fam-graph` | `graph`（write；Gk γράφειν） | supports | 2 | supports | 2 | geography 有完整链；telegraph 是 1790s 法语新造词；photograph 只有构词证据。 |
| `fam-mit` | `mit/miss`（send；L mittere） | supports | 3 | supports | 2 | admit/permit 经法语，transmit/submit 直借拉丁。 |
| `fam-phon` | `phon`（sound；Gk φωνή） | supports | 2 | supports | 4 | symphony 走拉丁-法语传统；telephone 是 19 世纪用成分新造的术语。 |
| `fam-port` | `port`（carry；L portare） | supports | 4 | supports | 2 | transport/support 经古法语，report 经英吉利法语，export 直借拉丁。 |
| `fam-scrib` | `scrib/script`（write；L scribere） | supports | 3 | supports | 2 | manuscript 是**近代拉丁** manūscrīptus，古典拉丁无此词。 |
| `fam-spect` | `spec/spect`（look；L specere） | supports | 3 | partial | 2 | 族内写的 `spect + -ator` 被词典反证：现代切分是 `spectate + -or`。 |
| `fam-stru` | `stru/struct`（build；L struere） | supports | 3 | supports | 2 | destroy 经俗拉丁 *destrugō，不是古典 dēstruō 直借。 |

统计：12 族 × 2 类主张 = 24 条主张，66 条记录。`borrowing-path` 12 条 `supports`、0 条 `not-covered`；
`modern-structure` 11 条 `supports`、1 条 `partial`（`rx-spec`）。所有记录都来自 **Wiktionary 英文版**
（S5），因此每条主张在 `reviews.json` 里都是 **single-work**——单一编纂来源，不是交叉核验。

> 这个「单一来源」不是瑕疵而是实情：本仓库能公开复核的词源词典只有这一部。要升级成 `cross-source`，
> 需要另一部**不同编纂者**的英语词源词典（OED、Klein、Weekley 等），而它们都不在本地。
> 同一部 Wiktionary 的镜像、转写、API 与网页版**不能**算两个来源。

## 逐族明细

### `fam-cap` → `rx-cap`（`cap`，take, seize，L capere）

**borrowing-path** — supports

> cap 族的英语词走两条路：中古/古法语转手（capture < MF capture < L captūra；except < MF excepter < L exceptus；capacity < OF capacite < L capācitās），与直接借入拉丁（captivate 借晚期拉丁 captīvātus 的分词）。两条路都以 capiō「拿、取」为共同祖语词。

判定说明：四个词条都写明了「英语 ← 法语 ← 拉丁」或「英语 ← 拉丁」的完整链，不是只给词根对应。

| 词条 | direct | 原文切片 |
| --- | --- | --- |
| [capture](https://en.wiktionary.org/w/index.php?title=capture&oldid=94549339) | 是 | `{{bor+\|en\|frm\|capture\|pos=noun}}, from {{der\|en\|la\|captūra}}` |
| [except](https://en.wiktionary.org/w/index.php?title=except&oldid=95586425) | 是 | `Borrowed from {{bor\|en\|frm\|excepter}}, from {{der\|en\|la\|exceptus}}` |
| [capacity](https://en.wiktionary.org/w/index.php?title=capacity&oldid=92915499) | 是 | `From {{inh\|en\|enm\|capacite}}, from {{der\|en\|fro\|capacite}}, from {{der\|en\|la\|capācitās}}` |

定位：`==English== / Etymology section, revision 94549339`（每条各有 revision，见 JSON）。

**modern-structure** — supports

> 现代英语把 capt- 当粘着词基：captive + -ity → captivity；capācitās 在英语里被切成 -acity 后缀。也就是说共时切分是「词基+后缀」，不要求每个成员都能拆成 in-/ex- + cap。

判定说明：两条都是词典明写的共时切分（{{surf}} / {{suf}} 模板），不是从词源倒推。

| 词条 | direct | 原文切片 |
| --- | --- | --- |
| [captivity](https://en.wiktionary.org/w/index.php?title=captivity&oldid=89995004) | 是 | `{{surf\|en\|captive\|-ity}}` |
| [capacity](https://en.wiktionary.org/w/index.php?title=capacity&oldid=92915499) | 是 | `(whence {{suf\|en\|-acity}})` |

定位：`==English== / Etymology section, revision 89995004`（每条各有 revision，见 JSON）。

### `fam-chron` → `cx-chron`（`chron`，time，Gk χρόνος）

**borrowing-path** — supports

> chron 族有三条路径：①希腊 → 拉丁 → 古法语 → 英语（chronic：χρονικός > L chronicus > OF cronike > ME chronical）；②希腊 → 新拉丁学术造词 → 英语（chronology 仿新拉丁 chronologia）；③希腊 → 法语/新拉丁 → 英语（anachronism < F anachronisme / NL anachronismus < Gk ἀναχρονισμός）。

判定说明：三个词条各自给出不同的中间语，正好说明「借词路径」不是一句话能概括的：同一词族可以同时有法语转手和新拉丁造词。

| 词条 | direct | 原文切片 |
| --- | --- | --- |
| [chronic](https://en.wiktionary.org/w/index.php?title=chronic&oldid=94549968) | 是 | `from {{der\|en\|fro\|cronike}}, from {{der\|en\|la\|chronicus}}, from {{der\|en\|grc\|χρονικός\|\|of time}}` |
| [chronology](https://en.wiktionary.org/w/index.php?title=chronology&oldid=92412689) | 是 | `after {{bor\|en\|la-new\|chronologia}} from {{der\|en\|grc\|χρόνος\|t=time}}` |
| [anachronism](https://en.wiktionary.org/w/index.php?title=anachronism&oldid=95463006) | 是 | `From {{bor\|en\|fr\|anachronisme}} or its etymon {{bor\|en\|la-new\|anachronismus}}, from {{der\|en\|grc\|ἀναχρονισμός}}` |

定位：`==English== / Etymology section, revision 94549968`（每条各有 revision，见 JSON）。

**modern-structure** — supports

> 现代英语里 chron- / chrono- 是能产的粘着词基：chron- + -ic（chronic）、chrono- + -logy（chronology）、syn- + chrono- + -ize（synchronize）、ana- + chron- + -ism（anachronism）。

判定说明：四条都是词典给出的共时切分；其中 synchronize 同时保留了「来自希腊动词」的词源说明，两者不冲突：词源是借入，结构是当下可分析。

| 词条 | direct | 原文切片 |
| --- | --- | --- |
| [chronic](https://en.wiktionary.org/w/index.php?title=chronic&oldid=94549968) | 是 | `{{surf\|en\|chron-\|-ic}}` |
| [chronology](https://en.wiktionary.org/w/index.php?title=chronology&oldid=92412689) | 是 | `{{confix\|en\|chrono\|t1=relating to time\|logy\|t2=study of, account of}}` |
| [synchronize](https://en.wiktionary.org/w/index.php?title=synchronize&oldid=92118053) | 是 | `equivalent to {{af\|en\|syn-\|chrono-\|-ize}}` |
| [anachronism](https://en.wiktionary.org/w/index.php?title=anachronism&oldid=95463006) | 是 | `{{surf\|en\|ana-\|chron-\|-ism}}` |

定位：`==English== / Etymology section, revision 94549968`（每条各有 revision，见 JSON）。

### `fam-duct` → `rx-duc`（`duc/duct`，lead，L ducere）

**borrowing-path** — supports

> duc 族两条路并存：经古法语（reduce < OF reduire < L redūcō；introduce < OF introduire < L intrōdūcō；production < OF production < L prōductiō），与经中古英语直承拉丁（produce < ME produce < L prōdūcō；conduct < L conductus）。

判定说明：四个词条都有中间语或直承说明；conduct 的「displaced native þēaw」还说明它是借词替换本土词，而非本土派生。

| 词条 | direct | 原文切片 |
| --- | --- | --- |
| [reduce](https://en.wiktionary.org/w/index.php?title=reduce&oldid=93770863) | 是 | `From {{inh\|en\|enm\|reducen}}, from {{der\|en\|fro\|reduire}}, from {{der\|en\|la\|redūcō\|\|reduce}}` |
| [introduce](https://en.wiktionary.org/w/index.php?title=introduce&oldid=95586772) | 是 | `From {{inh\|en\|enm\|introducen}}, from {{der\|en\|fro\|introduire}}, from {{der\|en\|la\|intrōdūcō}}` |
| [produce](https://en.wiktionary.org/w/index.php?title=produce&oldid=93716534) | 是 | `From {{inh\|en\|enm\|produce}}, from {{der\|en\|la\|prōdūcō\|t=to lead forth}}` |
| [conduct](https://en.wiktionary.org/w/index.php?title=conduct&oldid=95591196) | 是 | `From {{der\|en\|la-lat\|conductus\|t=defense, escort}}, from {{der\|en\|la\|conductus}}` |

定位：`==English== / Etymology section, revision 93770863`（每条各有 revision，见 JSON）。

**modern-structure** — supports

> 现代英语的 duct 是粘着词基：produce + -tion → production、reduce + -tion → reduction、instruct + -ion → instruction、conduct + -or → conductor（后者历史上经法语借入，共时仍可切）。

判定说明：三个 -tion/-ion 例子都是词典明写的 Equivalent to，属于共时切分；conductor 的切分是我的观察，故不引作结构证据。

| 词条 | direct | 原文切片 |
| --- | --- | --- |
| [production](https://en.wiktionary.org/w/index.php?title=production&oldid=92064238) | 是 | `Equivalent to {{suf\|en\|produce\|tion}}` |
| [reduction](https://en.wiktionary.org/w/index.php?title=reduction&oldid=95150046) | 是 | `Equivalent to {{suf\|en\|reduce\|tion}}` |
| [instruction](https://en.wiktionary.org/w/index.php?title=instruction&oldid=95586764) | 是 | `equivalent to {{suffix\|en\|instruct\|ion}}` |

定位：`==English== / Etymology section, revision 92064238`（每条各有 revision，见 JSON）。

### `fam-fer` → `rx-fer`（`fer`，carry，L ferre）

**borrowing-path** — supports

> fer 族：直接借入拉丁（transfer < L trānsferō），经英吉利法语/古法语（prefer < AN preferer < L praeferō；refer < OF referer < L referre），offer 另有古英语 offrian 的教会借词路，与古法语 offre 并行。

判定说明：prefer 的中间语是 Anglo-Norman（xno）而非巴黎法语，说明「经法语」要写明是哪支法语。

| 词条 | direct | 原文切片 |
| --- | --- | --- |
| [transfer](https://en.wiktionary.org/w/index.php?title=transfer&oldid=95572907) | 是 | `From {{der\|en\|la\|trānsferō\|t=to bear across}}` |
| [prefer](https://en.wiktionary.org/w/index.php?title=prefer&oldid=93715973) | 是 | `from {{der\|en\|xno\|preferer}}, from {{der\|en\|la\|praeferō}}` |
| [refer](https://en.wiktionary.org/w/index.php?title=refer&oldid=94569433) | 是 | `from {{der\|en\|fro\|referer}}, from {{der\|en\|la\|referre}}` |
| [offer](https://en.wiktionary.org/w/index.php?title=offer&oldid=95675362) | 是 | `from {{inh\|en\|ang\|offrian\|\|offer or make a sacrifice}} rather than from {{der\|en\|fro\|offre\|\|offer}}` |

定位：`==English== / Etymology section, revision 95572907`（每条各有 revision，见 JSON）。

**modern-structure** — supports

> fer 族的共时词基是动词形（refer / prefer），加 -ence 造名词：refer + -ence → reference、prefer + -ence → preference。拉丁词根 fer- 本身在现代英语不是自由形式。

判定说明：两条都是 Morphologically … 明写切分。

| 词条 | direct | 原文切片 |
| --- | --- | --- |
| [reference](https://en.wiktionary.org/w/index.php?title=reference&oldid=95490791) | 是 | `Morphologically {{suffix\|en\|refer\|ence}}` |
| [preference](https://en.wiktionary.org/w/index.php?title=preference&oldid=95587587) | 是 | `Morphologically {{suffix\|en\|prefer\|ence}}` |

定位：`==English== / Etymology section, revision 95490791`（每条各有 revision，见 JSON）。

### `fam-form` → `rx-form`（`form`，shape，L forma）

**borrowing-path** — supports

> form 族抽到的四个词条全部经古法语进入：form < OF forme < L fōrma；inform < OF enformer < L īnfōrmō；reform < OF reformer < L reformāre；formal < OF formel < L fōrmālis。本批没有出现「英语直接借拉丁 fōrma」的成员。

判定说明：四个词条都写明古法语环节；只能说本批样本全走法语，不能说整个族都如此。

| 词条 | direct | 原文切片 |
| --- | --- | --- |
| [form](https://en.wiktionary.org/w/index.php?title=form&oldid=95648322) | 是 | `borrowed from {{der\|en\|fro\|forme}}, from {{der\|en\|la\|fōrma\|\|shape, figure, image, outline, plan, mold, frame, case, etc., manner, sort, kind, etc.}}` |
| [inform](https://en.wiktionary.org/w/index.php?title=inform&oldid=93777083) | 是 | `borrowed from {{der\|en\|fro\|enformer}}` |
| [formal](https://en.wiktionary.org/w/index.php?title=formal&oldid=95636222) | 是 | `borrowed from {{der\|en\|fro\|formel}}, from {{der\|en\|la\|fōrmālis}}` |

定位：`==English== / Etymology section, revision 95648322`（每条各有 revision，见 JSON）。

**modern-structure** — supports

> form 在现代英语既能自由成词，也能当粘着词基：in- + form（inform）、form + -al（formal）。

判定说明：两条都是词典模板明写的共时切分，与上面的借词史并不矛盾。

| 词条 | direct | 原文切片 |
| --- | --- | --- |
| [inform](https://en.wiktionary.org/w/index.php?title=inform&oldid=93777083) | 是 | `equivalent to {{prefix\|en\|in\|form}}` |
| [formal](https://en.wiktionary.org/w/index.php?title=formal&oldid=95636222) | 是 | `equivalent to {{suf\|en\|form\|al}}` |

定位：`==English== / Etymology section, revision 93777083`（每条各有 revision，见 JSON）。

### `fam-graph` → `cx-graph`（`graph`，write，Gk γράφειν）

**borrowing-path** — supports

> graph 族不是一条路：geography 走「希腊 → 拉丁 → 中古法语 → 英语」（géographie < L geōgraphia < Gk γεωγραφία）；telegraph 是 19 世纪法语新造词再借入（F télégraphe）。photograph 的词典条目只给 photo- + -graph 构词，没有中间语记录，所以它只能算构词证据（见本族 modern-structure），不能算借词路径。

判定说明：geography 给出完整链，telegraph 给出法语造词年代与提议者（1790s，Miot de Mélito）——两者足以证明「-graph 族的路径不统一」。photograph 无中间语，故不列为本主张的记录。

| 词条 | direct | 原文切片 |
| --- | --- | --- |
| [geography](https://en.wiktionary.org/w/index.php?title=geography&oldid=93696794) | 是 | `From {{uder\|en\|frm\|géographie}}, from {{uder\|en\|la\|geōgraphia}}, from {{uder\|en\|grc\|γεωγραφία\|\|a [[description]] of the [[earth]]}}` |
| [telegraph](https://en.wiktionary.org/w/index.php?title=telegraph&oldid=94574408) | 是 | `suggested as a new name for {{w\|Claude Chappe}}'s overland [[semaphore]] network by {{w\|André François Miot de Mélito}}` |

定位：`==English== / Etymology section, revision 93696794`（每条各有 revision，见 JSON）。

**modern-structure** — supports

> 现代英语里 -graph 是能产后缀（「写/记录/描绘」），前接 photo-、tele- 等成分：photo- + -graph、tele- + -graph；geography 则是 geo- + -graphy。

判定说明：两条模板直接给出构缀切分。

| 词条 | direct | 原文切片 |
| --- | --- | --- |
| [photograph](https://en.wiktionary.org/w/index.php?title=photograph&oldid=95681763) | 是 | `From {{confix\|en\|photo\|graph}}` |
| [telegraph](https://en.wiktionary.org/w/index.php?title=telegraph&oldid=94574408) | 是 | `{{eq\|en\|tele-\|-graph\|t1=far, distant\|t2=writing\|nocap=1}}` |

定位：`==English== / Etymology section, revision 95681763`（每条各有 revision，见 JSON）。

### `fam-mit` → `rx-mit`（`mit/miss`，send，L mittere）

**borrowing-path** — supports

> mit 族：经法语（admit < OF admettre < L admittō；permit < MF permettre < L permittō）与直接借入拉丁（transmit < L trānsmittō；submit < L submittere）并行。

判定说明：四个词条分别给出法语与直借两种中间语；transmit 的 lit. across-send 还说明词典把它当拉丁复合词处理。

| 词条 | direct | 原文切片 |
| --- | --- | --- |
| [admit](https://en.wiktionary.org/w/index.php?title=admit&oldid=95673162) | 是 | `borrowed from {{der\|en\|fro\|admettre}}, {{m\|fro\|amettre\|\|to admit}}, from {{der\|en\|la\|admittō\|\|to allow entrance, [[inlet]]\|lit=to send to}}` |
| [permit](https://en.wiktionary.org/w/index.php?title=permit&oldid=94566619) | 是 | `borrowed from {{der\|en\|frm\|permettre}}, from {{der\|en\|la\|permittō\|\|give up, allow}}` |
| [transmit](https://en.wiktionary.org/w/index.php?title=transmit&oldid=90921713) | 是 | `borrowed from {{der\|en\|la\|trānsmittō\|\|transmit\|lit=across-send\|pos=verb}}` |

定位：`==English== / Etymology section, revision 95673162`（每条各有 revision，见 JSON）。

**modern-structure** — supports

> 现代英语里 mit 的完成分词词干 miss 当名词化词基：sub- + miss + -ion → submission、permit + -ion → permission；动词形也能加 -er：transmit + -er → transmitter。

判定说明：permission 与 transmitter 是词典明写的切分；submission 只给借词链，故不列为结构证据。

| 词条 | direct | 原文切片 |
| --- | --- | --- |
| [permission](https://en.wiktionary.org/w/index.php?title=permission&oldid=93132007) | 是 | `Equivalent to {{suf\|en\|permit\|ion}}` |
| [transmitter](https://en.wiktionary.org/w/index.php?title=transmitter&oldid=93728966) | 是 | `{{ety\|en\|:af\|transmit\|-er<id:agent noun>\|text=+\|tree=1}}` |

定位：`==English== / Etymology section, revision 93132007`（每条各有 revision，见 JSON）。

### `fam-phon` → `cx-phon`（`phon`，sound，Gk φωνή）

**borrowing-path** — supports

> phon 族分两类：symphony 走「希腊 → 拉丁 → 古法语 → 英语」（OF simphonie < L symphonia < Gk συμφωνία）；telephone / microphone / phonograph 是 19 世纪用 tele-、micro-、phono- 加 -phone/-graph 新造的术语，不是古典借词。

判定说明：symphony 给完整链；telephone 明说「由 tele- + -phone 构成，仿德语 Telephon」，证明确为新造而非借入。「希腊词素」这一点 telephone 词条本身没写，故该条 direct=false。

| 词条 | direct | 原文切片 |
| --- | --- | --- |
| [symphony](https://en.wiktionary.org/w/index.php?title=symphony&oldid=90310425) | 是 | `from {{der\|en\|fro\|simphonie}}, from {{der\|en\|la\|symphonia}}, from {{der\|en\|grc\|συμφωνία}}` |
| [telephone](https://en.wiktionary.org/w/index.php?title=telephone&oldid=94635994) | 否 | `is derived from {{affix\|en\|tele-\|pos1={{lg\|prefix}} meaning ‘from a distance’\|-phone\|pos2={{lg\|suffix}} denoting a device which makes a sound}}` |

定位：`==English== / Etymology section, revision 90310425`（每条各有 revision，见 JSON）。

**modern-structure** — supports

> 现代英语里 -phone / -phony 是能产后缀，phone 可作第二成分：tele- + -phone、micro- + phone、phono- + graph、sym- + -phony。

判定说明：四条模板都给出构缀切分。

| 词条 | direct | 原文切片 |
| --- | --- | --- |
| [telephone](https://en.wiktionary.org/w/index.php?title=telephone&oldid=94635994) | 是 | `{{affix\|en\|tele-\|pos1={{lg\|prefix}} meaning ‘from a distance’\|-phone\|pos2={{lg\|suffix}} denoting a device which makes a sound}}` |
| [microphone](https://en.wiktionary.org/w/index.php?title=microphone&oldid=91535807) | 是 | `From {{confix\|en\|micro\|phone}}` |
| [phonograph](https://en.wiktionary.org/w/index.php?title=phonograph&oldid=93738974) | 是 | `From {{confix\|en\|phono\|graph}}` |
| [symphony](https://en.wiktionary.org/w/index.php?title=symphony&oldid=90310425) | 是 | `{{surf\|en\|sym-\|-phony}}` |

定位：`==English== / Etymology section, revision 94635994`（每条各有 revision，见 JSON）。

### `fam-port` → `rx-port`（`port`，carry，L portare）

**borrowing-path** — supports

> port 族主要经古法语/英吉利法语（transport < OF transporter < L trānsportō；support < OF supporter < L supportō；report < AN reporter < L reportō），export 直接借自拉丁 exportāre。

判定说明：三个法语转手 + 一个直借，两条路都有；report 的中间语是 Anglo-Norman。

| 词条 | direct | 原文切片 |
| --- | --- | --- |
| [transport](https://en.wiktionary.org/w/index.php?title=transport&oldid=95572939) | 是 | `a borrowing from {{der\|en\|fro\|transporter\|t=carry or convey across}}, from {{der\|en\|la\|trānsportō\|trānsportāre\|to carry over, take across, carry, convey, remove, transport}}` |
| [support](https://en.wiktionary.org/w/index.php?title=support&oldid=95457677) | 是 | `from {{der\|en\|fro\|supporter}}, from {{der\|en\|la\|supportō}}` |
| [report](https://en.wiktionary.org/w/index.php?title=report&oldid=95717791) | 是 | `from {{der\|en\|xno\|reporter}}, from {{der\|en\|la\|reporto\|reportāre\|to carry back, return, remit, refer}}` |
| [export](https://en.wiktionary.org/w/index.php?title=export&oldid=93076293) | 是 | `From {{der\|en\|la\|exportare}}` |

定位：`==English== / Etymology section, revision 95572939`（每条各有 revision，见 JSON）。

**modern-structure** — supports

> 现代英语把 port 当粘着词基（「搬运」）：port + -able → portable、report + -er → reporter。

判定说明：两条都是词典明写的切分；portable 同时也经法语借入，共时切分与借词史并存。

| 词条 | direct | 原文切片 |
| --- | --- | --- |
| [portable](https://en.wiktionary.org/w/index.php?title=portable&oldid=94567380) | 是 | `{{surf\|en\|port<id:carry><t:to carry>\|-able}}` |
| [reporter](https://en.wiktionary.org/w/index.php?title=reporter&oldid=95563716) | 是 | `equivalent to {{affix\|en\|report\|-er\|id2=agent noun}}` |

定位：`==English== / Etymology section, revision 94567380`（每条各有 revision，见 JSON）。

### `fam-scrib` → `rx-scrib`（`scrib/script`，write，L scribere）

**borrowing-path** — supports

> scrib 族：经古法语（describe < OF descrivre < L dēscrībō；describe 的名词 description < OF description < L dēscrīptiō），与直接借入拉丁（subscribe < L subscrībō；prescribe < L praescrībere）；manuscript 是近代拉丁 manūscrīptus，词典注明古典拉丁无此词。

判定说明：四个词条覆盖三条路：古法语、直借、近代拉丁造词。manuscript 的「Not found in Classical Latin」是关键的年代证据。

| 词条 | direct | 原文切片 |
| --- | --- | --- |
| [describe](https://en.wiktionary.org/w/index.php?title=describe&oldid=94552605) | 是 | `from {{der\|en\|fro\|descrivre}}, from {{der\|en\|la\|dēscrībō\|\|to copy off, transcribe, sketch off, describe in painting or writing}}` |
| [subscribe](https://en.wiktionary.org/w/index.php?title=subscribe&oldid=93725586) | 是 | `from {{der\|en\|la\|subscrībō\|subscrībere\|t=write beneath}}` |
| [manuscript](https://en.wiktionary.org/w/index.php?title=manuscript&oldid=93800297) | 是 | `from {{bor\|en\|la-med\|manūscrīptus}}` |

定位：`==English== / Etymology section, revision 94552605`（每条各有 revision，见 JSON）。

**modern-structure** — supports

> 现代英语有 scrib 与 script 两个词基形：sub- + scribe（subscribe）、sub- + script + -ion（subscription）、describe + -tion（description）。

判定说明：subscription 的 surf 分析同时给出 sub- / script / -ion 三段，description 给出 describe + -tion。

| 词条 | direct | 原文切片 |
| --- | --- | --- |
| [subscription](https://en.wiktionary.org/w/index.php?title=subscription&oldid=91688652) | 是 | `{{surf\|en\|sub-\|script\|-ion\|nocap=1}}` |
| [description](https://en.wiktionary.org/w/index.php?title=description&oldid=93131318) | 是 | `Equivalent to {{suf\|en\|describe\|tion}}` |

定位：`==English== / Etymology section, revision 91688652`（每条各有 revision，见 JSON）。

### `fam-spect` → `rx-spec`（`spec/spect`，look，L specere）

**borrowing-path** — supports

> spect 族两条路并存：直接借入拉丁（spectator < L spectātor；inspect < L inspectum；expect < L expectāre），与经古法语（respect < OF respect < L respectus）。

判定说明：三个直借 + 一个法语转手；没有经希腊语的路径。

| 词条 | direct | 原文切片 |
| --- | --- | --- |
| [spectator](https://en.wiktionary.org/w/index.php?title=spectator&oldid=93156634) | 是 | `Borrowed from {{bor\|en\|la\|spectātor}}, from [[frequentative]] verb {{m\|la\|spectō\|\|watch}}` |
| [inspect](https://en.wiktionary.org/w/index.php?title=inspect&oldid=92362661) | 是 | `From {{uder\|en\|la\|inspectum}}, past participle of {{m\|la\|inspicio\|inspicere\|to look into}}` |
| [respect](https://en.wiktionary.org/w/index.php?title=respect&oldid=93719127) | 是 | `from {{der\|en\|fro\|respect}}, also {{m\|fro\|respit\|\|respect, regard, consideration}}, from {{der\|en\|la\|respectus\|\|a looking at, regard, respect}}` |

定位：`==English== / Etymology section, revision 93156634`（每条各有 revision，见 JSON）。

**modern-structure** — partial

> 现代英语把 spect 当粘着词基：in- + spect（inspect）。但 spectator 的共时切分是 spectate + -or，不是族里写的 spect + -ator——-ator 是历史形态，不是现代能产切分。

判定说明：inspect 的结构证据成立；「spect + -ator」被词典反证：现代切分以动词 spectate 为词基。所以这条主张只部分成立，族内说明需要改口径。

| 词条 | direct | 原文切片 |
| --- | --- | --- |
| [inspect](https://en.wiktionary.org/w/index.php?title=inspect&oldid=92362661) | 是 | `equivalent to {{confix\|en\|in\|spect}}` |
| [spectator](https://en.wiktionary.org/w/index.php?title=spectator&oldid=93156634) | 是 | `Equivalent to {{suffix\|en\|spectate\|or}}` |

定位：`==English== / Etymology section, revision 92362661`（每条各有 revision，见 JSON）。

### `fam-stru` → `rx-stru`（`stru/struct`，build，L struere）

**borrowing-path** — supports

> stru 族三条路：直接借拉丁分词（construct < L cōnstrūctus；instruct < L īnstrūctus）、经中古法语（structure < MF structure < L structūra）、经古法语（destroy < OF destruire < 俗拉丁 *destrugō）。

判定说明：destroy 的中间语是俗拉丁 *destrugō，说明「来自拉丁」要区分古典形与俗拉丁重构形。

| 词条 | direct | 原文切片 |
| --- | --- | --- |
| [construct](https://en.wiktionary.org/w/index.php?title=construct&oldid=93686256) | 是 | `Borrowed from {{bor\|en\|la\|cōnstrūctus}}, from {{m\|la\|cōnstruō\|\|to heap together}}` |
| [structure](https://en.wiktionary.org/w/index.php?title=structure&oldid=95805851) | 是 | `From {{der\|en\|frm\|structure}}, from {{der\|en\|la\|structūra\|\|a fitting together, adjustment, building, erection, a building, edifice, structure}}` |
| [destroy](https://en.wiktionary.org/w/index.php?title=destroy&oldid=94552760) | 是 | `from {{der\|en\|fro\|destruire}}, {{der\|en\|la-vul\|*destrugō}}, from Classical {{der\|en\|la\|dēstruō}}` |

定位：`==English== / Etymology section, revision 93686256`（每条各有 revision，见 JSON）。

**modern-structure** — supports

> 现代英语的 struct 是粘着词基：construct + -ion → construction、structure + -al → structural。

判定说明：两条都是词典明写的 Morphologically / suffix 切分；structural 还标了 19 世纪，说明是近代能产派生。

| 词条 | direct | 原文切片 |
| --- | --- | --- |
| [construction](https://en.wiktionary.org/w/index.php?title=construction&oldid=93131230) | 是 | `Morphologically {{suffix\|en\|construct\|-ion}}` |
| [structural](https://en.wiktionary.org/w/index.php?title=structural&oldid=94573250) | 是 | `From {{suffix\|en\|structure\|-al}}, 19th century` |

定位：`==English== / Etymology section, revision 93131230`（每条各有 revision，见 JSON）。

## 与词族文本冲突的一处（需要改 `src/content`，不在本任务范围）

`fam-spect` 的成员 `spectator` 标注为 `spect + -ator`，并把 `-ator` 说成「表施动者」的现代后缀。
Wiktionary 的共时分析是 `spectate + -or`（`{{suffix|en|spectate|or}}`）：现代英语里 -ator 不是
能产后缀，施动后缀是 `-or` 加在动词 `spectate` 上。历史形态确实是 -ātor，但那属于拉丁，
不能当现代切分教。因此该主张记为 `partial`，不是 `supports`。

## 没有覆盖到的部分

- `classical-derivation`（古典语内部的词形变化与派生）本次未新增，`modern-sense`（现代词义演变）同样未新增。
- `borrowing-path` 只证到「哪个语言在哪个年代把词交给英语」，**没有**证明每个成员的首见年代；
  词条给年代时（telegraph 1790s、manuscript 1597、structural 19th c.）才记录。
- 12 族之外没有覆盖：本次只做任务指定的 12 个深度词族。

## 复现

```bash
python analysis/claim-deepen/_fetch_wiktionary.py   # 抓 65 个词条的 ==English== 词源段 + revision
python analysis/claim-deepen/_build_claims.py       # 断言 quote 为原文子串，写 12 个 JSON
node scripts/merge-claim-deepen.mjs --dry           # 看会追加多少条
node scripts/merge-claim-deepen.mjs                 # 写入 reviews.json（幂等）
node scripts/normalize-verification.mjs             # 按 claimType 重算 claims
node scripts/audit-reviews.mjs --write               # 刷新 docs/REVIEW_AUDIT.md
```

> `analysis/claim-deepen/` 目前仍被 `.gitignore` 的 `analysis/*` 覆盖，`git status` 看不到它。
> 合并进 `reviews.json` 的事实是可提交的；若要把原始记录也入库，需要像 `greek-verification` 一样
> 加一条 `!analysis/claim-deepen/` 例外。本任务没有改动 `.gitignore`。
