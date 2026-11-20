# 词库深度补充（L4 例词充分率）

生成时间：2026-11-20。范围：只写 `analysis/lexicon-batches/depth-*.json`，不改词库成品文件。

## 做法

- 候选：`docs/coverage.json` 中 `levels.L4 === false && levels.L2 === true` 的行，剔除 `-ed/-ing/-s` 一类屈折后缀，优先能带出常见英语词族的词根/前缀。
- 切分：每个 `parts` 成分都用 `morphemes.json`（含 `allomorphs`）逐条解析校验，要求**每个成分唯一命中一个词素 ID**；只有这样 `partIds` 才会是 `exact`，L4 才计入。
- 去重：与 `words.json` 做大小写不敏感比对；与同批其他文件互查。
- 自检：`npx tsx scripts/lexicon-tool.ts merge --dry` 报 `+158 words, 0 re-split, 0 rejected`；自写脚本另查 parts 解析、目标命中与重复。

## 汇总

- 词素：**80 个**（全部为 `L2: true / L4: false`）
- 词条：**158 个**（去重后；orthodontist 同时支撑 cx-orth 与 cx-odont，表中各记一次）（`verified: true` 100%；全部成分可解析，无整体借词，故无 `verified: false` 条目）
- 直接翻绿的行：**94 行**
- 预计 L4：**140/559（25.0%）→ 234/559（41.9%）**

> 说明：翻绿行数大于 80，是因为同一词素在教材里有多个书写变体行（如 `cx-lex-leg` 覆盖 lex/leg/log 三行），一个词素达标会同时点亮这些行。

## 明细

### depth-1.json — 10 个词素 / 20 词条

| 词素 ID | form | 释义 | 本次补的词 | 原有 verified | 合计 | 覆盖行数 |
|---|---|---|---|---|---|---|
| `cx-crypt` | crypt | secret, hidden | cryptic、cryptogram | 0 | 2 | 1 |
| `cx-du` | du | two | dual、duplicate | 0 | 2 | 1 |
| `cx-acr` | acr | height, tip | acropolis、acronym | 0 | 2 | 1 |
| `cx-agr` | agr | field | agriculture、agronomy | 0 | 2 | 1 |
| `cx-anim` | anim | soul, mind, spirit, (nonplant) life | animate、animal | 0 | 2 | 1 |
| `cx-ambul` | ambul | walk, go | ambulance、ambulatory | 0 | 2 | 1 |
| `cx-ann-enn` | ann | year | anniversary、perennial | 0 | 2 | 2 |
| `cx-anthrop` | anthrop | human | anthropology、philanthropy | 0 | 2 | 1 |
| `cx-aud` | aud | hear | audible、audience | 0 | 2 | 1 |
| `cx-aur` | aur | ear | aural、auricle | 0 | 2 | 1 |

### depth-2.json — 10 个词素 / 20 词条

| 词素 ID | form | 释义 | 本次补的词 | 原有 verified | 合计 | 覆盖行数 |
|---|---|---|---|---|---|---|
| `cx-card` | card | heart | cardiology、cardiogram | 0 | 2 | 1 |
| `cx-clam` | clam | call out | clamor、proclamation | 0 | 2 | 1 |
| `cx-crac-crat` | crac | govern | autocrat、autocracy | 0 | 2 | 2 |
| `cx-culp` | culp | fault | culpable、culpability | 0 | 2 | 1 |
| `cx-damn-demn` | damn | loss, harm | damnation、condemn | 0 | 2 | 2 |
| `cx-dic` | dic | say, point | dedicate、predicate | 0 | 2 | 1 |
| `cx-erg-urg` | erg | work | energy、synergy | 0 | 2 | 3 |
| `cx-eu` | eu | good | eulogy、euphoria | 0 | 2 | 1 |
| `cx-fug` | fug | flee | fugitive、refuge | 0 | 2 | 1 |
| `cx-fund-fus` | fund | pour, melt, blend | confuse、fusion | 0 | 2 | 2 |

### depth-3.json — 10 个词素 / 20 词条

| 词素 ID | form | 释义 | 本次补的词 | 原有 verified | 合计 | 覆盖行数 |
|---|---|---|---|---|---|---|
| `cx-gam` | gam | marry, unite | monogamy、polygamy | 0 | 2 | 1 |
| `cx-gastr` | gastr | stomach | gastric、gastronomy | 0 | 2 | 1 |
| `cx-greg` | greg | social group, gather | congregation、segregate | 0 | 2 | 1 |
| `cx-heli` | heli | sun | helium、heliotrope | 0 | 2 | 1 |
| `cx-hemi` | hemi | half | hemisphere、hemispherical | 0 | 2 | 1 |
| `cx-hepat` | hepat | liver | hepatic、hepatitis | 0 | 2 | 1 |
| `cx-hexa` | hexa | six | hexagon、hexameter | 0 | 2 | 1 |
| `cx-homo` | homo | same | homograph、homophone | 0 | 2 | 1 |
| `cx-iso` | iso | equal | isometric、isotope | 0 | 2 | 1 |
| `cx-quadr` | quadr | four | quadrant、quadratic | 0 | 2 | 1 |

### depth-4.json — 10 个词素 / 20 词条

| 词素 ID | form | 释义 | 本次补的词 | 原有 verified | 合计 | 覆盖行数 |
|---|---|---|---|---|---|---|
| `cx-jus-jur` | jus | law, judge | jurisdiction、jury | 0 | 2 | 1 |
| `cx-kilo` | kilo | thousand | kilogram、kilometer | 0 | 2 | 1 |
| `cx-lact` | lact | milk | lactation、lactose | 0 | 2 | 1 |
| `cx-lig` | lig | tie, bind | ligature、religion | 0 | 2 | 1 |
| `cx-liter` | liter | letter | literacy、literary | 0 | 2 | 1 |
| `cx-lith-lit` | lith | stone | monolith、lithography | 0 | 2 | 1 |
| `cx-lumen-lumin` | lumen | light | lucid、luminous | 0 | 2 | 1 |
| `cx-magn` | magn | great, large | magnificent、magnify | 0 | 2 | 1 |
| `cx-mega-megal` | mega | great, million | megaphone、megalith | 0 | 2 | 1 |
| `cx-meta` | meta | beyond | metabolism、metaphor | 0 | 2 | 1 |

### depth-5.json — 10 个词素 / 20 词条

| 词素 ID | form | 释义 | 本次补的词 | 原有 verified | 合计 | 覆盖行数 |
|---|---|---|---|---|---|---|
| `cx-metr` | metr | measure | symmetry、metric | 1 | 3 | 1 |
| `cx-milli` | milli | thousandth | milligram、millimeter | 0 | 2 | 1 |
| `cx-morph` | morph | shape, form | metamorphic、morphology | 0 | 2 | 1 |
| `cx-mult` | mult | many | multilateral、multiple | 0 | 2 | 1 |
| `cx-mun` | mun | public service, gift | communicate、community | 0 | 2 | 1 |
| `cx-nav` | nav | boat | navigate、navy | 0 | 2 | 1 |
| `cx-nihil-nil` | nihil | nothing | annihilate、nihilism | 0 | 2 | 1 |
| `cx-null` | null | nothing | nullify、nullity | 0 | 2 | 1 |
| `cx-ocul` | ocul | eye | binocular、ocular | 0 | 2 | 1 |
| `cx-odont` | odont | tooth | orthodontist、periodontal | 0 | 2 | 1 |

### depth-6.json — 10 个词素 / 19 词条

| 词素 ID | form | 释义 | 本次补的词 | 原有 verified | 合计 | 覆盖行数 |
|---|---|---|---|---|---|---|
| `cx-olig` | olig | few | oligarchy、oligopoly | 0 | 2 | 1 |
| `cx-omn` | omn | all | omnipotent、omnivorous | 0 | 2 | 1 |
| `cx-orth` | orth | straight, correct | orthography、orthodontist | 0 | 2 | 1 |
| `cx-ov` | ov | egg | ovary、ovoid | 0 | 2 | 1 |
| `cx-pet` | pet | seek, go to | appetite、petition | 0 | 2 | 1 |
| `cx-phob` | phob | fear | phobia、phobic | 0 | 2 | 1 |
| `cx-poly` | poly | many | polygon、polyphony | 0 | 2 | 1 |
| `cx-the` | the | put, place | thesis、antithesis | 0 | 2 | 2 |
| `cx-top` | top | place | topical、topography | 0 | 2 | 1 |
| `cx-tri` | tri | three | trilogy、triple | 0 | 2 | 1 |

### depth-7.json — 10 个词素 / 20 词条

| 词素 ID | form | 释义 | 本次补的词 | 原有 verified | 合计 | 覆盖行数 |
|---|---|---|---|---|---|---|
| `cx-terr` | terr | earth | terrain、territory | 0 | 2 | 1 |
| `cx-trud-trus` | trud | thrust | protrude、extrusion | 0 | 2 | 1 |
| `cx-vit-viv` | vit | live | vital、revive | 0 | 2 | 2 |
| `cx-voc` | voc | call, voice | vocal、vocation | 0 | 2 | 1 |
| `cx-chron` | chron | time | chronic、chronology | 1 | 3 | 1 |
| `cx-corp-corpor` | corp | body, flesh | corporate、corporation | 1 | 3 | 1 |
| `cx-cosm` | cosm | universe, adorn, order | cosmic、cosmos | 1 | 3 | 1 |
| `cx-dyn` | dyn | power | dynamite、dynamo | 1 | 3 | 1 |
| `cx-flu-fluc` | flu | flow, river | fluent、fluency | 1 | 3 | 1 |
| `cx-jun-juven` | jun | young | juvenile、rejuvenate | 1 | 3 | 2 |

### depth-8.json — 10 个词素 / 19 词条

| 词素 ID | form | 释义 | 本次补的词 | 原有 verified | 合计 | 覆盖行数 |
|---|---|---|---|---|---|---|
| `cx-lex-leg` | lex | word, speak | lexicon、lexical | 1 | 3 | 3 |
| `cx-matr` | matr | mother | maternal、matriarch | 1 | 3 | 1 |
| `cx-nec-noc` | nec | harm | noxious、obnoxious | 1 | 3 | 4 |
| `cx-oid` | oid | resembling | asteroid、android | 1 | 3 | 1 |
| `cx-psych` | psych | mind | psychic、psyche | 1 | 3 | 1 |
| `cx-son` | son | sound | sonic、resonance | 1 | 3 | 1 |
| `cx-tempor` | tempor | time | temporary、contemporary | 1 | 3 | 1 |
| `px-inter` | inter | between, among | intervene、intercom | 1 | 3 | 1 |
| `rx-cred` | cred | believe | credence、credo | 1 | 3 | 1 |
| `px-hypo` | hypo | under, below normal | hypodermic | 1 | 2 | 1 |


## 不确定的切分（5 条）

1. **`psychic` / `psyche`** —— `psych` 在本库是「心智」，希腊 psykhē 本义「气息、灵魂」；`psyche` 尾部的 `e` 按库内惯例落到 `px-e`（out），语义上只是拼写性词尾，严格说应视为无声 e。
2. **`intercom`** —— 是 `internal communication` 的缩略，不是拉丁语素链；切 `inter + com` 只保证拼写与 `px-inter`、`px-com` 对得上，词源说明已注明「缩略」，属边界情况。
3. **`credo`** —— 切 `cred + o`，`o` 是拉丁第一人称词尾而非连接元音；本库 `cx-o` 释义为「空连接元音」，此处语义不完全吻合。
4. **`matriarch`** —— `matr + i + arch`，`arch` 在本库兼「first / govern」两义，这里取「统治」，靠词义说明区分，形式上无法唯一限定。
5. **`obnoxious`** —— `ob + nox + ious`；拉丁 obnoxiosus 原义「易受伤害的」，现代义「令人讨厌的」是词义转移，切分对但 `ob-` 的「向」在此已不透明。

另：`heliotrope`、`orthodontist`、`extrusion` 等词横跨两个目标词素（如 heli + trop），同一词条会同时点亮两个 ID，这是设计上的复用，不是重复计数错误。
