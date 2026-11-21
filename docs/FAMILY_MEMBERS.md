# 词族未收录成员处置（FAMILY_MEMBERS）

12 个词族档案的 `members` 是内容声明，不等于词库已收。本轮把 40 个未收录成员逐个过了一遍：
**33 个建词条，7 个明确不建，0 个语源存疑**。批次文件为 `analysis/lexicon-batches/family-members.json`。

## 1. 判定标准

| 处置 | 标准 |
| --- | --- |
| 建词条 | 真实常用、语源清楚、能说明该族的构词规律；`parts` 尽量落到可解析成分 |
| 不建 | 生僻、术语堆叠，或现代英语拼写已不可分析；**不为覆盖率硬造** |
| 语源存疑 | 保留未收录并记 todo（本轮没有出现） |

`ety.historical` 的拉丁/希腊语源均据 Wiktionary 英语词源段核对（逐条 `sources` 记到具体词条），
没有凭记忆补拉丁语。Lewis & Short 1879 全文在 `analysis/reference/ls.txt`，但该文件是 OCR 全文、
词条边界不可靠，因此只在能确认的拉丁词上引用，不硬套。

## 2. 建词条的 33 个

| 词 | 族 | 切分 | 备注 |
| --- | --- | --- | --- |
| deception | cap | de + cept + ion | capere 分词词干 cept |
| occupy | cap | oc + cup | oc = ob- 同化；词尾 y 为法语不定式词尾，不切分 |
| caption | cap | capt + ion | 义项从「扣押」转到「标题/字幕」 |
| susceptible | cap | sus + cept + ible | sus = sub- 同化 |
| chronicle | chron | chron | 词尾 -icle 为借入词尾，挂 sx-acle 会造成假切分 |
| chronological | chron | chrono + logy + ical | 按「chronology + -ical」分析，不硬切 log + ical |
| chronometer | chron | chrono + meter | -meter 仪器，区别于 -metry 测量术 |
| anachronism | chron | ana + chron + ism | ana- 表「错位」 |
| asynchronous | chron | a + syn + chron + ous | a- 为希腊否定前缀 |
| chronograph | chron | chrono + graph | 希腊原义「编年史作者」，现代义为仪器 |
| synchronic | chron | syn + chron + ic | 与 diachronic 成对 |
| diachronic | chron | dia + chron + ic | 与 synchronic 成对 |
| conducive | duct | con + duc + ive | 勿与 conductive 混 |
| telegraph | graph | tele + graph | 18 世纪末法语新造词 |
| paragraph | graph | para + graph | 原义「写在旁边的记号」 |
| autograph | graph | auto + graph | 希腊 autógraphon |
| monograph | graph | mono + graph | 19 世纪学术词 |
| polygraph | graph | poly + graph | 20 世纪专指测谎仪 |
| omit | mit | omit（整词） | 见 §4 |
| remit | mit | re + mit | 「送回去」派生汇款/免除 |
| message | mit | miss + age | 通俗拉丁 missāticum |
| phonograph | phon | phon + o + graph | 1877 年爱迪生新义 |
| euphony | phon | eu + phon + y | eu- 是「好」，非「欧洲」 |
| symphony | phon | sym + phon + y | sym- 为 syn- 唇音变体 |
| phonics | phon | phon + ics | 教学法，区别于 phonetics |
| phoneme | phon | phon + eme | -eme 表最小单位 |
| proscribe | scrib | pro + scrib | 与 prescribe 形近义反 |
| scripture | scrib | script + ure | scrīptūra |
| transcript | scrib | trans + script | transcriptum |
| conscript | scrib | con + script | 「登记入册」→ 征兵 |
| despise | spect | de + spis | spis 为古法语词干变体，已入 rx-spec |
| spectrum | spect | spectr + um | 拉丁 spectrum「影像」 |
| construe | struct | con + stru | 与 construct 为双重借词 |

合并后 **32 个 `partResolution = exact`，只有 omit 是 `unresolved`**；`despise` 的 `spis` 已作为
`rx-spec` 的 allomorph 写入，`partIds` 为 `px-de + rx-spec`，不是同形误挂。

## 3. 不建的 7 个

| 词 | 族 | 理由 |
| --- | --- | --- |
| grammar | graph | 希腊 grámma 经拉丁/法语整体借入，-ar 不是英语后缀；强切只能得到假成分 |
| graphology | graph | 生僻专业术语；graph + -ology 虽透明，但教学价值低于同族的 telegraph / paragraph |
| scribble | scrib | 拉丁指小形式 scribillāre，-ble 不是英语后缀；切开就是造假 |
| auspices | spect | 仅用复数（under the auspices of），avis + specere 的复合在现代拼写里不可切分 |
| destroy | struct | 与 destruere 同源，但英语拼写已磨平，无法按 de + stru 讲 |
| chronometry | chron | 生僻抽象术语；「测时术」已由 chronometer 覆盖，-metry 另有 metr 条 |
| chronobiology | chron | 20 世纪专业复合词，词义透明但使用面窄，不为一族凑数 |

这 7 个仍保留在族页的「词库未收」标注中，不从 `members` 数组删除。

## 4. 诚实状态与例外

- **omit**：`parts` 记为 `["omit"]`，`partResolution = unresolved`。词源上可切 o-（ob- 弱化）+ mit-，
  但词首 `o` 与希腊连接元音 `cx-o` 同形；若写 `o + mit`，解析器会把 `o` 指到 `cx-o`，
  这是明确的同形误挂。mit- 的联系写在 `ety.teaching` 与 `note` 里，不伪装成已解析。
- **chronicle**：`parts` 只有 `["chron"]`，但 `partResolution = exact`（单成分全解析）。词尾 `-icle`
  没有对应的真实英语后缀，故不补成分；这是「解析状态」比「实际可分析度」乐观的一处，读 `note` 即可。
- **chronological**：`parts` 为 `chrono + logy + ical`，拼接连写不等于原词（chronology + -ical），
  但这是该词真实的派生层级，和库里 `activate = act + ive + ate` 的处理一致。
- **occupy**：`parts` 为 `oc + cup`，词尾 `y` 是法语不定式词尾，不映射为英语后缀。
- **construe / proscribe**：与库里 `conclude = con + clud` 的惯例一致，省略不发音的词尾 `-e`。
  这两个词因此能落到唯一 ID，而不是像旧条目 `describe = de + scrib + e` 那样带一个空 partId。

## 5. 合并结果

| 指标 | 合并前 | 合并后 |
| --- | --- | --- |
| 词库总数 | 1473 | 1506（+33） |
| `partResolution = exact` | 1171 | 1203（+32） |
| `partResolution = unresolved` | 297 | 298（+1，omit） |
| `partResolution = ambiguous` | 5 | 5 |
| `analysis.segmentation = partial` | 87 | 87 |
| `analysis.segmentation = verified` | 1360 | 1393（+33） |

语素库净增 0：merge 从旧批次重放中报出 +12 个记录，identity-migrate 的去重/身份归并后仍为 809；
实际持久化改动只有 `rx-spec` 增加变体 `spis`。

验证：`npx vitest run` 全绿（355 tests，含新增 `src/lib/family-members.test.ts` 8 项）。
