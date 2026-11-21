# PARTIAL 词条分类

> **版本说明**：本报告记录 **v0.10.0 那次分类时的基线（142 条）**，是历史记录，不是当前状态。
> 当前数字由 `node scripts/word-status-report.mjs` 生成（见 `docs/WORD_STATUS.md` 的自动统计块），
> 0.11.0 起为 partial 87 条。两者不要混读。

`segmentation: partial` 的含义只有一个：**这个词有多段切分，其中至少一段在词库里找不到 ID**。
它本身不是错误标记——错误和「本来就该 partial」混在一起，所以当时那 142 条必须逐条判断。

分类口径（每条只落一类）：

| 类别 | 定义 | 正确处理 |
| --- | --- | --- |
| **1. 自由词干** free-base | 成分本身是能独立成词的英语词（care、agree、move、market） | 标记即可。**不造词素**——给 care 造一个「词根」，学生会以为 care 是黏着成分 |
| **2. 纯拼写成分** orthographic | 静音 e、e 脱落、y→i、连接元音 | 不承载意义，不该有记录 |
| **3. 缺词素记录** missing-record | 确实可分析的黏着成分（-ibil、posit、vers），库里没有 | 补记录（有语源依据才补） |
| **4. 坏切分** wrong-split | 切分本身错了：粘成不可分的块，或把同形异源混成一个义项 | 改切分，或标 `verified:false` 并写清原因 |
| **5. 整体借词** whole-loan | 现代英语不再分析的借词 | **不要**强拆——拆了才是错 |

## 计数（142 = 55 已修 + 87 仍 partial）

| 类别 | 数量 | 已修 | 仍 partial |
| --- | --- | --- | --- |
| 1 自由词干 | 71 | — | 71 |
| 2 纯拼写成分 | 3 | — | 3 |
| 3 缺词素记录 | 45 | 39 | 6 |
| 4 坏切分 | 21 | 16 | 5 |
| 5 整体借词 | 2 | — | 2 |
| **合计** | **142** | **55** | **87** |

`segmentation = partial`：**142 → 87**；`verified`：1305 → 1360。

## 3 类做了什么

### 补记录（39 条，`analysis/lexicon-batches/partial-fixes.json`）

13 条新记录（每条都写了 `originalForm` 与词典依据）：

| 新记录 | 依据 | 修好的词 |
| --- | --- | --- |
| `rx-stingu` (stingu, 刺/标示) + `stinct` | stinguere；**不是** tingere「染色」 | distinct, distinction |
| `rx-spond` (spondere) + `spons`/`respons` | respondere | responsible, responsibility |
| `rx-sed` (sedere「坐」) + `sid`/`sess` | residere | residual |
| `rx-plaud` (plaudere) + `plaus`/`plos` | explodere | explosion |
| `rx-flex` (flectere) + `flect` | flectere | flexible |
| `rx-clar` (clarus) | clarus | clarify |
| `rx-iter` (iterum/iter) | iterare | iteration |
| `rx-manipul` (manipulus「一把」) | manipulus | manipulate |
| `rx-electr` (ἤλεκτρον「琥珀」) | ēlektōr | hydroelectric |
| `rx-menstru` (menstruus) | mensis | menstrual |
| `sx-logue` (-logos「言语」) | 与 -logy 分工 | monologue |
| `cx-centi` (centum「百」) | centum | centipede |
| `px-fore` (OE fore-) | foreweard | forward（同时改切分） |

15 条给已有记录补 `allomorph`（比新造记录更正确：同一个词素的另一种拼写）：

`sx-ial ← ual`（actual/asexual/visual/residual）、`sx-abil ← ibil`（credibility/possibility/compatibility/responsibility）、`rx-pos ← posit`（composition/deposit/position/positive）、`px-pro ← pur`（purchase/purport/purported/purportedly）、`rx-vert ← verse`（reverse/universe）、`rx-ten ← tent`（detention/retention）、`cx-pend-pond ← pens`（expensive）、`cx-pne-pneum ← pneumon`（pneumonia）、`sx-ency ← iency`（efficiency）、`sx-ative ← iative`（initiative）、`sx-atic ← tic`（aquatic）、`cx-sci ← scient`（scientist）、`rx-techn ← techno`（technology）、`rx-cap ← ceive`（perceive）、`rx-od ← odo`（odometry）。

### 改切分（5 条）

| 词 | 原切分 | 新切分 | 理由 |
| --- | --- | --- | --- |
| distinct | dis + tinct | dis + **stinct** | -stinct 是 stinguere「刺、标示」，不是 tingere「染色」 |
| distinction | dis + tinct + ion | dis + **stinct** + ion | 同上 |
| forward | for + ward | **fore** + ward | OE foreweard = fore「在前」+-weard；for 是介词，同形异源 |
| trajectory | traject + ory | **tra + ject** + ory | 拉丁 trajectus = tra-(trans) + iacere「投」；原切分掩盖了能产的 ject |
| fertilize | fert + il + ize | **fertile + ize** | fertile + -ize（17c）；fert/il 都不是成分，保留自由词干 |

### 补同形歧义证据（11 条）

这 11 条的切分是对的，坏在**同一个拼写有两个记录**，解析器拿不到判别依据（`partResolution: ambiguous`）：

- `impose`（in-「向内」）vs `impossible`（in-「不」）——同形异义，靠各自的语源行分开；
- `inducement`/`induction`/`injection`——in- 取「向内」；
- `irregular`——ir- 取「非」；
- `apologize`——log- 是 logos「言说」，不是 -logy「学科」；
- `separator`——par 是 parare「安排」，字符串 `separare` 里含 `parere`「生育」会误命中；
- `legend`——leg 是 legere「读」，不是 lex「法」（原 derivation 写错了）；
- `photodiode`——di- 是「二」，不是 dia-「穿过」（原 derivation 写错了）；
- `indestructible`——in- 是否定，destruct 的 de- 是正确的（destruere = de- + struere）。

## 仍为 partial 的 87 条：为什么降不下去

**71 条自由词干**（care、agree、move、market、back、net…）。切分是对的，缺的只是「这是个自由词」这一事实。
`scripts/migrate-word-status.mjs` 判 free-base 的条件是 **成分本身是 `words.json` 的 headword**；care/agree/market 这些不是词库词条，所以仍记成 `unresolved`。
要真正标成 free-base，要么把自由词收进词库，要么让脚本认一份自由词表——**这是脚本层的决定，不在本次范围**。
这 71 条的 `verified` 保持 false 是**正确**的：它们不该被当作「切分已核验」的证据。

**3 条纯拼写**：`coupling`/`decoupled`（couple 的 e 脱落 → `coupl`）、`historical`（history 的 y→i → `histor`）。
成分不是词素，没有记录可挂；改切成 `couple + ing` 也只是把同一个问题换个写法。

**6 条缺记录但不补**：

| 词 | 缺的成分 | 为什么先不造 |
| --- | --- | --- |
| benefit | fit（facere「做」） | `fit` 同时是英语自由词（retrofit）；造 `fit` 记录会让 retrofit 被误归拉丁 |
| legal | leg（lex「法」） | `leg` 同时是 legere「读」（legend）；一造 canonical `leg`，legend 会被静默改成「法」 |
| maintain | main（manus「手」） | 英语 main「主要」来自 OE mægen，与 manus 同形异源 |
| indebted | in-（使动，< en-） | 库里唯一的 en- 记录 `cx-oen-en` 是「酒」（oen），本身就用错了，不能往上加 |
| hydrogen | -gen（「产生」） | 需要新立 `-gen` 后缀；`gen` 已有 3 个记录，再加一个会改变其他词的解析 |
| agility | il（-ilis 在词中） | 位置启发式规定「非首非尾的只能是 root/combining」，后缀在词中永远解析不到 |

**5 条坏切分但正确切分未定**：`automatic`/`automation`（-mat- 来自希腊 -matos，不是英语词根）、`difficult`（-ficult 不是词素，正确切分要 dif- + ficilis）、`redundancy`/`redundant`（redundare = re + undare「波浪」，-dund- 是误粘）。

**2 条整体借词**：`formula`（拉丁指小式，现代英语不分析）、`genus`（拉丁名词，`-us` 是屈折词尾不是后缀）。

## 待办（需要语源判断或脚本改动）

1. **`in`/`im`/`ir` 同形**：`scripts/identity-migrate.ts` 的 `SENSE_PATTERNS` 里 `px-in-lat-2` 指向一个**不存在的 id**（真正的「向内」记录是 `px-im`），所以方向义的 in- 没有模式可命中。本次只能逐词写语源证据绕过；根治要改 `SENSE_PATTERNS`。
2. 上表 11 条 deferred 词条的语源判断（尤其 benefit / legal / maintain / hydrogen 的 `-gen`）。
3. **`lexicon-tool merge` 非幂等**：`family-duct`/`family-port`/`family-spect`/`gap-a-m`/`gap-n-z` 里有 12 个 orphan id（如 `px-pur`、`rx-pneumon`、`cx-duct`），每跑一次 merge 就新增记录，再靠 `identity-migrate` 合并掉。批次归属人应清掉这些孤儿 id。
4. `automatic`/`redundancy`/`difficult` 的正确切分需要新增拉丁词干（-matos、undare、ficilis）或整词处理，需人工定调。
