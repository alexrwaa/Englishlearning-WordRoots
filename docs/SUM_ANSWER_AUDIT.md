# Word Sum 参考答案审计（v0.12.1）

自动判分只对**能证明是现代分析**的参考结构开放。`layer` 同时承载过三种不同的主张：
拉丁语源（`spectator = spect + -ator`）、教学拆分（`oc + cup + y`）、以及真正的现代分析
（`inspect = in- + spect`）。把前者当唯一答案，等于把历史形态冒充现代能产规则，还会把逆构方向讲反。

## 判分门禁

一条参考结构要进入自动判分，必须同时满足五个条件：

1. `analysis.kind === "synchronous"`（现代共时可分析）；
2. `analysis.verified === true`（有人核验过）；
3. `analysis.source` 指向本族 `sources` 里的条目（可追溯）；
4. `layer` 至少两段（单段构不成 Word Sum）；
5. `layer` 的字母真的能拼出这个词（允许词素接缝处的 e-drop，如 `create + ion → creation`）。

缺任一条件：结构照常展示，但走 `ungraded`，`gradeSum()` 返回 `unresolved` 并说明原因，**不判对错**。
`unverified`（以及没写 `analysis` 的成员）永不进入自动判分。

## 字段

```jsonc
"analysis": {
  "kind": "synchronous | historical | analogical | cognate | unverified",
  "verified": true,              // 只有 synchronous 才允许为 true
  "source": "S1",                // 本族 sources 的 id
  "note": "…",                   // 给学习者的说明
  "modern": ["spectate","-or"],  // 现代切分与 layer 不同时
  "alternatives": [              // 同样成立的其它分析，逐条各自过门禁
    { "layer": ["spect","-ator"], "kind": "historical", "verified": false, "source": "S5" }
  ]
}
```

## 总览

| 族 | 成员 | 可自动判分 | 拦下 |
| --- | ---: | ---: | ---: |
| fam-cap | 14 | 11 | 3 |
| fam-chron | 13 | 11 | 2 |
| fam-duct | 16 | 13 | 3 |
| fam-fer | 16 | 9 | 7 |
| fam-form | 13 | 12 | 1 |
| fam-graph | 14 | 11 | 3 |
| fam-mit | 16 | 14 | 2 |
| fam-phon | 10 | 9 | 1 |
| fam-port | 14 | 14 | 0 |
| fam-scrib | 15 | 11 | 4 |
| fam-spect | 16 | 9 | 7 |
| fam-struct | 14 | 10 | 4 |
| **合计** | **171** | **134** | **37** |

拦下原因分布：单段/无结构 9（其中纯同源 4）、历史形态 13、
教学拆分 15、未核实 0、标为现代却拼写不还原 0。

## spectator / spectate

改动前：

```json
{ "w": "spectator", "layer": ["spect", "-ator"], "note": "-ator 表施动者：看的人" }
```

问题有两层：现代英语里 `spectator` 的共时切分是 `spectate + -or`；而 `spectate` 本身是从
`spectator` **逆构**出来的动词。把 `spect + -ator` 当成派生来源，等于把逆构方向讲反。

改动后：

```json
{
  "w": "spectator",
  "layer": ["spectate", "-or"],
  "note": "现代共时切分：spectate + -or。spectate 是由 spectator 逆构出来的动词；拉丁历史形态是 spect + -ator，方向不能反过来讲。",
  "analysis": {
    "kind": "synchronous", "verified": true, "source": "S5",
    "alternatives": [{ "layer": ["spect", "-ator"], "kind": "historical", "verified": false, "source": "S5" }]
  }
}
```

两种分析都展示，但都不判分：现代切分与历史形态并存时，`ungraded` 说明“不设唯一答案”，
`gradeSum("spect + ator", …)` 返回 `unresolved`，不会记错。

## 多解的表达

同一个词有两条都成立、都已核验的现代分析时，`accepted` 收两条，写任一条都算对：

```json
{ "w": "chronobiology", "layer": ["chrono", "bio", "-logy"],
  "analysis": { "kind": "synchronous", "verified": true, "source": "S1",
    "alternatives": [{ "layer": ["chrono", "biology"], "kind": "synchronous", "verified": true, "source": "S1" }] } }
```

`accepted = [["chrono","bio","-logy"], ["chrono","biology"]]`，提示语写“这个词有多种成立的分析，写哪一种都算对”。
`biography` 同理：`bio + graph + -y` 与 `bio + graphy` 都收。

## 逐族逐条


### fam-cap

| 成员 | 参考结构 | 层级 | 自动判分 | 依据 / 处理 |
| --- | --- | --- | --- | --- |
| capture | capt + -ure | 现代共时 | 是 | S1 |
| captive | capt + -ive | 现代共时 | 是 | S1 |
| capacity | cap + -ity | 教学拆分 | 否（教学拆分，拼写不还原） | cap + -ity 拼出 “capity”，与 capacity 不符；cap + -ity 拼不出 capacity；现代切分是 capac + -ity（cap 的异形） |
| accept | ac- + cept | 现代共时 | 是 | S1；ac- 是 ad- 在 c 前的同化形式 |
| except | ex- + cept | 现代共时 | 是 | S1 |
| intercept | inter- + cept | 现代共时 | 是 | S1 |
| concept | con- + cept | 现代共时 | 是 | S1 |
| reception | re- + cept + -ion | 现代共时 | 是 | S1 |
| receipt | re- + ceipt | 历史形态 | 否（历史形态） | ceipt 是受古法语 receite 影响的拼写，不是现代词素；re + ceipt 只是历史形态 |
| deception | de- + cept + -ion | 现代共时 | 是 | S1 |
| occupy | oc- + cup + -y | 教学拆分 | 否（教学拆分） | -y 不是后缀；oc + cup + y 是教学拆分 |
| capable | cap + -able | 现代共时 | 是 | S1 |
| caption | capt + -ion | 现代共时 | 是 | S1 |
| susceptible | sus- + cept + -ible | 现代共时 | 是 | S1；sus- 是 sub- 在 c 前的历史形式，现代只在这个词族里出现 |

### fam-chron

| 成员 | 参考结构 | 层级 | 自动判分 | 依据 / 处理 |
| --- | --- | --- | --- | --- |
| synchronize | syn- + chron + -ize | 现代共时 | 是 | S1 |
| chronic | chron + -ic | 现代共时 | 是 | S1 |
| chronicle | chron | 历史形态 | 否（单段） | 只有一个词素，构不成 Word Sum |
| chronology | chrono + -logy | 现代共时 | 是 | S1 |
| chronological | chrono + -logy + -ical | 教学拆分 | 否（教学拆分，拼写不还原） | chrono + -logy + -ical 拼出 “chronologyical”，与 chronological 不符；构词层级是 chronology + -ical；扁平分拆无法表达 y→i |
| chronometer | chrono + -meter | 现代共时 | 是 | S1 |
| anachronism | ana- + chron + -ism | 现代共时 | 是 | S1 |
| asynchronous | a- + syn- + chron + -ous | 现代共时 | 是 | S1 |
| chronograph | chrono + -graph | 现代共时 | 是 | S1 |
| chronometry | chrono + -metry | 现代共时 | 是 | S1 |
| synchronic | syn- + chron + -ic | 现代共时 | 是 | S1 |
| diachronic | dia- + chron + -ic | 现代共时 | 是 | S1 |
| chronobiology | chrono + bio + -logy | 现代共时 | 是 | S1；chrono + biology 同样成立；另有 1 种成立分析 |

### fam-duct

| 成员 | 参考结构 | 层级 | 自动判分 | 依据 / 处理 |
| --- | --- | --- | --- | --- |
| conduct | con- + duct | 现代共时 | 是 | S1 |
| produce | pro- + duce | 现代共时 | 是 | S1 |
| reduce | re- + duce | 现代共时 | 是 | S1 |
| introduce | intro- + duce | 现代共时 | 是 | S1 |
| educate | e- + duc + -ate | 历史形态 | 否（历史形态） | e- + duc + -ate 是拉丁 educare 的历史形态；现代基式是 educate |
| deduction | de- + duct + -ion | 现代共时 | 是 | S1 |
| abduct | ab- + duct | 现代共时 | 是 | S1 |
| seduce | se- + duce | 现代共时 | 是 | S1 |
| induce | in- + duce | 现代共时 | 是 | S1 |
| aqueduct | aque- + duct | 历史形态 | 否（历史形态） | aque- 是 aquae 的属格形式，不是现代前缀 |
| viaduct | via- + duct | 教学拆分 | 否（教学拆分） | 19 世纪仿 aqueduct 造词；via 不是前缀 |
| ductile | duct + -ile | 现代共时 | 是 | S1 |
| transducer | trans- + duc + -er | 现代共时 | 是 | S1 |
| subduction | sub- + duct + -ion | 现代共时 | 是 | S1 |
| misconduct | mis- + con- + duct | 现代共时 | 是 | S1 |
| conducive | con- + duc + -ive | 现代共时 | 是 | S1 |

### fam-fer

| 成员 | 参考结构 | 层级 | 自动判分 | 依据 / 处理 |
| --- | --- | --- | --- | --- |
| transfer | trans- + fer | 现代共时 | 是 | S1 |
| refer | re- + fer | 现代共时 | 是 | S1 |
| prefer | pre- + fer | 现代共时 | 是 | S1 |
| offer | of- + fer | 现代共时 | 是 | S1；of- 是 ob- 在 f 前的同化形式 |
| confer | con- + fer | 现代共时 | 是 | S1 |
| infer | in- + fer | 现代共时 | 是 | S1 |
| differ | dif- + fer | 现代共时 | 是 | S1；dif- 是 dis- 在 f 前的同化形式 |
| suffer | suf- + fer | 现代共时 | 是 | S1；suf- 是 sub- 在 f 前的同化形式 |
| fertile | fert + -ile | 历史形态 | 否（历史形态） | fert- 只出现在这一组，-ile 也不具能产性；fert + -ile 是历史形态 |
| circumference | circum- + fer + -ence | 现代共时 | 是 | S1 |
| conifer | coni- + fer | 教学拆分 | 否（教学拆分） | coni- 是 cone 的连接形式，不是前缀 |
| aquifer | aqui- + fer | 教学拆分 | 否（教学拆分） | aqui- 是 aqua 的连接形式，不是前缀 |
| vociferous | voci- + fer + -ous | 教学拆分 | 否（教学拆分） | voci- 是 vox 的连接形式，不是前缀 |
| proliferate | proli- + fer + -ate | 历史形态 | 否（历史形态） | proli- 来自 proles，不是现代词素 |
| translate | trans- + lat | 历史形态 | 否（历史形态，拼写不还原） | trans- + lat 拼出 “translat”，与 translate 不符；lat- 是 fer 的异干（拉丁 latus）；现代 translate 里没有 fer |
| referendum | re- + fer | 历史形态 | 否（历史形态，拼写不还原） | re- + fer 拼出 “refer”，与 referendum 不符；拉丁动形词整体借入；re + fer 拼不出 referendum |

### fam-form

| 成员 | 参考结构 | 层级 | 自动判分 | 依据 / 处理 |
| --- | --- | --- | --- | --- |
| form | form | 现代共时 | 否（单段） | 只有一个词素，构不成 Word Sum |
| formal | form + -al | 现代共时 | 是 | S1 |
| formation | form + -ation | 现代共时 | 是 | S1 |
| inform | in- + form | 现代共时 | 是 | S1 |
| information | in- + form + -ation | 现代共时 | 是 | S1 |
| reform | re- + form | 现代共时 | 是 | S1 |
| transform | trans- + form | 现代共时 | 是 | S1 |
| uniform | uni- + form | 现代共时 | 是 | S1 |
| conform | con- + form | 现代共时 | 是 | S1 |
| deform | de- + form | 现代共时 | 是 | S1 |
| formative | form + -ative | 现代共时 | 是 | S1 |
| formless | form + -less | 现代共时 | 是 | S1 |
| multiform | multi- + form | 现代共时 | 是 | S1 |

### fam-graph

| 成员 | 参考结构 | 层级 | 自动判分 | 依据 / 处理 |
| --- | --- | --- | --- | --- |
| photograph | photo + graph | 现代共时 | 是 | S1 |
| biography | bio + graph + -y | 现代共时 | 是 | S1；-graphy 作为后缀整体使用；另有 1 种成立分析 |
| geography | geo + graph + -y | 现代共时 | 是 | S1 |
| telegraph | tele + graph | 现代共时 | 是 | S1 |
| telegram | tele + gram | 现代共时 | 是 | S1 |
| diagram | dia + gram | 历史形态 | 否（历史形态） | dia + gram 是希腊 diagramma 的历史形态，现代 diagram 整体借入 |
| grammar | gram | 历史形态 | 否（单段） | 只有一个词素，构不成 Word Sum |
| program | pro- + gram | 历史形态 | 否（历史形态） | pro- 不是希腊 programma 的前缀；属于借入后整体使用 |
| graphic | graph + -ic | 现代共时 | 是 | S1 |
| paragraph | para- + graph | 现代共时 | 是 | S1 |
| autograph | auto- + graph | 现代共时 | 是 | S1 |
| monograph | mono- + graph | 现代共时 | 是 | S1 |
| polygraph | poly- + graph | 现代共时 | 是 | S1 |
| graphology | graph + -o- + -logy | 现代共时 | 是 | S1 |

### fam-mit

| 成员 | 参考结构 | 层级 | 自动判分 | 依据 / 处理 |
| --- | --- | --- | --- | --- |
| submit | sub- + mit | 现代共时 | 是 | S1 |
| transmit | trans- + mit | 现代共时 | 是 | S1 |
| permit | per- + mit | 现代共时 | 是 | S1 |
| commit | com- + mit | 现代共时 | 是 | S1 |
| admit | ad- + mit | 现代共时 | 是 | S1 |
| emit | e- + mit | 现代共时 | 是 | S1 |
| omit | mit | 历史形态 | 否（单段） | 只有一个词素，构不成 Word Sum |
| remit | re- + mit | 现代共时 | 是 | S1 |
| dismiss | dis- + miss | 现代共时 | 是 | S1 |
| mission | miss + -ion | 现代共时 | 是 | S1 |
| missile | miss + -ile | 现代共时 | 是 | S1 |
| message | miss + -age | 教学拆分 | 否（教学拆分，拼写不还原） | miss + -age 拼出 “missage”，与 message 不符；miss + -age 拼不出 message；现代 message 是整体借入，-age 只是历史成分 |
| submission | sub- + miss + -ion | 现代共时 | 是 | S1 |
| transmission | trans- + miss + -ion | 现代共时 | 是 | S1 |
| permission | per- + miss + -ion | 现代共时 | 是 | S1 |
| intermittent | inter- + mitt + -ent | 现代共时 | 是 | S1；mitt 是 mit 在元音前的双写异形 |

### fam-phon

| 成员 | 参考结构 | 层级 | 自动判分 | 依据 / 处理 |
| --- | --- | --- | --- | --- |
| telephone | tele- + phone | 现代共时 | 是 | S1 |
| microphone | micro- + phone | 现代共时 | 是 | S1 |
| phonograph | phon + -o- + -graph | 现代共时 | 是 | S1 |
| homophone | homo- + phone | 现代共时 | 是 | S1 |
| euphony | eu- + phon + -y | 现代共时 | 是 | S1 |
| symphony | sym- + phon + -y | 现代共时 | 是 | S1；sym- 是 syn- 在 p 前的同化形式 |
| phonics | phon + -ics | 现代共时 | 是 | S1 |
| phoneme | phon + -eme | 现代共时 | 是 | S1 |
| phonetics | phon + -ics | 教学拆分 | 否（教学拆分，拼写不还原） | phon + -ics 拼出 “phonics”，与 phonetics 不符；现代切分是 phonet + -ics；phon + -ics 拼出的是 phonics |
| polyphony | poly- + phon + -y | 现代共时 | 是 | S1 |

### fam-port

| 成员 | 参考结构 | 层级 | 自动判分 | 依据 / 处理 |
| --- | --- | --- | --- | --- |
| transport | trans- + port | 现代共时 | 是 | S1 |
| export | ex- + port | 现代共时 | 是 | S1 |
| import | im- + port | 现代共时 | 是 | S1 |
| report | re- + port | 现代共时 | 是 | S1 |
| support | sup- + port | 现代共时 | 是 | S1；sup- 是 sub- 在 p 前的同化形式 |
| deport | de- + port | 现代共时 | 是 | S1 |
| portable | port + -able | 现代共时 | 是 | S1 |
| porter | port + -er | 现代共时 | 是 | S1 |
| teleport | tele- + port | 现代共时 | 是 | S1 |
| comport | com- + port | 现代共时 | 是 | S1；com- 是 con- 在 p 前的同化形式 |
| importance | im- + port + -ance | 现代共时 | 是 | S1；im- 是 in- 在 p 前的同化形式 |
| portage | port + -age | 现代共时 | 是 | S1 |
| transportation | trans- + port + -ation | 现代共时 | 是 | S1 |
| exportable | ex- + port + -able | 现代共时 | 是 | S1 |

### fam-scrib

| 成员 | 参考结构 | 层级 | 自动判分 | 依据 / 处理 |
| --- | --- | --- | --- | --- |
| describe | de- + scribe | 现代共时 | 是 | S1 |
| inscribe | in- + scribe | 现代共时 | 是 | S1 |
| subscribe | sub- + scribe | 现代共时 | 是 | S1 |
| prescribe | pre- + scribe | 现代共时 | 是 | S1 |
| proscribe | pro- + scribe | 现代共时 | 是 | S1 |
| manuscript | manu- + script | 教学拆分 | 否（教学拆分） | manu- 是 manus 的连接形式，不是前缀 |
| script | script | 现代共时 | 否（单段） | 只有一个词素，构不成 Word Sum |
| scripture | script + -ure | 现代共时 | 是 | S1 |
| prescription | pre- + script + -ion | 现代共时 | 是 | S1 |
| subscription | sub- + script + -ion | 现代共时 | 是 | S1 |
| description | de- + script + -ion | 现代共时 | 是 | S1 |
| transcript | trans- + script | 教学拆分 | 否（教学拆分，拼写不还原） | trans- + script 拼出 “transscript”，与 transcript 不符；trans + script 拼出 transscript；实际的 s 脱落（haplology）不是现代规则 |
| conscript | con- + script | 现代共时 | 是 | S1 |
| postscript | post- + script | 现代共时 | 是 | S1 |
| scribble | — | 历史同源 | 否（同源） | 没有参考结构：历史同源，不按派生切分 |

### fam-spect

| 成员 | 参考结构 | 层级 | 自动判分 | 依据 / 处理 |
| --- | --- | --- | --- | --- |
| inspect | in- + spect | 现代共时 | 是 | S1 |
| expect | ex- + pect | 教学拆分 | 否（教学拆分） | ex + pect：pect 是 spect 在 ex- 后掉 s 的异形，属于教学拆分，不是现代能产规则 |
| respect | re- + spect | 现代共时 | 是 | S1 |
| suspect | sus- + spect | 教学拆分 | 否（教学拆分，拼写不还原） | sus- + spect 拼出 “susspect”，与 suspect 不符；sus + spect 拼出 susspect；实际写作 sus + pect（s 脱落） |
| prospect | pro- + spect | 现代共时 | 是 | S1 |
| retrospect | retro- + spect | 现代共时 | 是 | S1 |
| spectator | spectate + -or | 现代共时 | 否（多解） | spectate + -or（现代）与 spect + -ator（历史）并存，不设唯一答案 |
| perspective | per- + spect + -ive | 现代共时 | 是 | S1 |
| specify | spec + -ify | 现代共时 | 是 | S1 |
| specific | spec + -ific | 现代共时 | 是 | S1 |
| spectacle | spect + -acle | 教学拆分 | 否（教学拆分） | -acle 不具能产性；spect + -acle 是教学拆分 |
| introspect | intro- + spect | 现代共时 | 是 | S1 |
| circumspect | circum- + spect | 现代共时 | 是 | S1 |
| despise | de- + spic | 历史形态 | 否（历史形态，拼写不还原） | de- + spic 拼出 “despic”，与 despise 不符；de + spic 拼不出 despise；spic 是拉丁 specere 的内部形式 |
| auspices | — | 历史同源 | 否（同源） | 没有参考结构：历史同源，不按派生切分 |
| spectrum | — | 历史同源 | 否（同源） | 没有参考结构：历史同源，不按派生切分 |

### fam-struct

| 成员 | 参考结构 | 层级 | 自动判分 | 依据 / 处理 |
| --- | --- | --- | --- | --- |
| construct | con- + struct | 现代共时 | 是 | S1 |
| destruction | de- + struct + -ion | 现代共时 | 是 | S1 |
| instruct | in- + struct | 现代共时 | 是 | S1 |
| obstruct | ob- + struct | 现代共时 | 是 | S1 |
| structure | struct + -ure | 现代共时 | 是 | S1 |
| infrastructure | infra- + struct + -ure | 现代共时 | 是 | S1 |
| superstructure | super- + struct + -ure | 现代共时 | 是 | S1 |
| substructure | sub- + struct + -ure | 现代共时 | 是 | S1 |
| nanostructure | nano- + struct + -ure | 现代共时 | 是 | S1 |
| reconstruct | re- + con- + struct | 现代共时 | 是 | S1 |
| instrument | in- + stru + -ment | 历史形态 | 否（历史形态） | instrumentum 整体借入；stru 不是现代词素 |
| construe | con- + stru | 历史形态 | 否（历史形态，拼写不还原） | con- + stru 拼出 “constru”，与 construe 不符；con + stru 是拉丁 construere 的历史形态 |
| structural | struct + -ure + -al | 教学拆分 | 否（教学拆分） | 构词层级是 structure + -al；struct + ure + al 拼不出 structural |
| destroy | — | 历史同源 | 否（同源） | 没有参考结构：历史同源，不按派生切分 |

## 已知残留

- `source` 只核到“来源条目存在”，没有逐条复核 OED 原文；本版把无法确认的一律降级，而不是放行。
- 判分只对照 `accepted` 里的分析，不判断学习者写的词素是否另有成立解释；差异过大会返回 `unresolved` 而不是判错。
- UI 的 `FamilyInquiry.tsx` 尚未渲染 `ungraded` 列表（该文件由另一人维护）。门禁与数据已就位，
  当前页面只会对 `sums` 出题，因此历史形态不会出现在判分题里。

