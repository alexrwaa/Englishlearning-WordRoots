# 词族深度数据（FAMILY_DEEP）

本文件说明 `src/content/families/*.json` 的用途、字段契约、首批 12 族的覆盖情况，以及哪些地方**故意留空**。
词族页与 Word Matrix 要展示的是「有层次的族人 + 真实派生链 + 反例」，不是两三个零散结果；这批文件就是那层数据。

## 1. 文件与命名

- 目录：`src/content/families/`
- 一族一个文件：`fam-<root>.json`，如 `fam-spect.json`
- `id` 必须与文件名一致，且与 `src/content/lexicon/words.json` 中词条的 `family` 字段对得上
- 本目录只增不改：`lexicon/`、`weeks/`、`lib/`、`pages/`、`scripts/` 都由其他作者负责，这里不碰

## 2. 结构

```json
{
  "id": "fam-spect",
  "root": { "form": "spect", "glossEn": "look at", "glossZh": "看",
            "origin": "Lat", "etymon": "specere", "etymonGloss": "to look at, observe" },
  "coreIdea": "一句话核心意象（中文，≤40 字）",
  "members": [
    { "w": "inspect", "relation": "derivative", "glossZh": "检查",
      "layer": ["in-", "spect"], "note": "in- 向内 + 看 → 往里看" },
    { "w": "auspices", "relation": "cognate", "glossZh": "预兆；赞助",
      "note": "avis 鸟 + specere 看，走名词复合这条路" }
  ],
  "allomorphs": [ { "form": "spic", "note": "拉丁内部形式", "examples": ["conspicuous", "despise"] } ],
  "derivationChains": [ { "stages": ["spect", "inspect", "inspection", "inspector"], "note": "每一级都真实成词" } ],
  "semanticShifts": [ { "w": "respect", "from": "回头看", "to": "尊敬", "why": "反复看 → 重视" } ],
  "homographTraps": [ { "form": "pect", "other": "pectoral 的 pect 来自 pectus 胸", "note": "别拆成 ex + 胸" } ],
  "teaching": {
    "induction": "给 4–6 个例词，让学习者自己总结核心义（写成一句提问）",
    "transfer": { "word": "perspicacious", "question": "拆开并猜义",
                  "answer": "per- 透过 + spic 看 + -acious 多…的 → 目光锐利的。例句：…" }
  },
  "sources": [ { "id": "S1", "detail": "ch.9 Latin/Greek element list（spect- 条）" } ]
}
```

## 3. 字段约束

| 字段 | 约束 |
|---|---|
| `root.form` | 取词根的主形态，须能在 `morphemes.json` 的 `form` 或 `allomorphs` 中找到 |
| `root.origin` | `Lat` / `Gk`，与 `morphemes.json` 的 `origin` 一致 |
| `coreIdea` | 中文一句话，≤40 字，说清「一个动作 + 方向如何改变词义」 |
| `members[].w` | 必须是真实英语词；优先取 `words.json` 已有词条 |
| `members[].relation` | 只能是 `derivative`（该词根派生）或 `cognate`（同源异途） |
| `members[].layer` | 逐段切分；每段（去连字符后）必须能在 `forms.json`、`morphemes.json` 或本族 `allomorphs` 中查到 |
| `members[].note` | 讲清「前缀义 + 词根义 → 词义」，不要只写「由…组成」 |
| `allomorphs` | 每个变体必须给真实例词；没有变体时写 `[]` |
| `derivationChains` | 2–4 条；词根之后的每一级都必须真实成词，不能为了好看硬接 |
| `semanticShifts` | 只写有把握的义项转移，`why` 要能解释机制 |
| `homographTraps` | 只写真实同形异源；找不到就写 `[]`，**不编** |
| `teaching.transfer` | 用学术/科技词，`answer` 内含拆解和一句真实语境英文例句 |
| `sources` | `{id, detail}`，detail 写具体章/条；不写「已核对」这类空话 |

## 4. 首批 12 族

| 族 | 词根义 | 成员 | 其中已在 words.json | 同形反例 | 变体 |
|---|---|---:|---:|---:|---:|
| `fam-spect` | 看 | 16 | 13 | 2 | 3 |
| `fam-struct` | 建造 | 14 | 12 | 2 | 1 |
| `fam-port` | 携带 | 14 | 14 | 2 | 0 |
| `fam-fer` | 带来 | 16 | 16 | 2 | 2 |
| `fam-duct` | 引导 | 16 | 15 | 0 | 2 |
| `fam-mit` | 送 | 16 | 13 | 2 | 2 |
| `fam-cap` | 拿 | 14 | 10 | 2 | 5 |
| `fam-scrib` | 写 | 15 | 10 | 0 | 1 |
| `fam-graph` | 写、记录 | 14 | 7 | 1 | 2 |
| `fam-phon` | 声音 | 10 | 5 | 1 | 1 |
| `fam-chron` | 时间 | 13 | 3 | 1 | 1 |
| `fam-form` | 形状 | 13 | 13 | 2 | 0 |

合计 171 个成员词，131 个能在 `words.json` 找到（76.6%）。对不上的都是常用真实词（如 `symphony`、`chronometer`、`paragraph`），可作为后续补词条的候选，不是错误。

## 5. 故意留空与判定依据

**`homographTraps: []`（2 族）**

- `fam-duct`：`duc-/duct-` 在英语里没有可靠的同形异源反例。`duke/duchess` 反而同出 `dux`，不能当反例；`document/docile` 虽不同源，但不含 `duc` 拼写，放进本族会误导。
- `fam-scrib`：`scrib-/script-` 拼写专一，`scribble` 也只是拉丁指小形式，同源。故留空。
- `fam-port`、`fam-form` 等族的 0 变体同理：`port` 与 `form` 在英语中基本只有一个词干，硬造变体会违反「变体须有实例词」。

**成员数偏少的族**

- `fam-phon`（10 条）：希腊 `phōnē` 在英语里主要构成「声音设备/声音学科」两类复合词，能同时满足「真实常用 + 可切分」的词就到 10 个左右；再加只会引入生僻词或无法切分的截短词（如 `phone` 本身）。
- `fam-chron`（13 条）：本可更多，但 `chron-` 的很多搭配是术语堆叠（`chronostratigraphy` 等），对学习者没有迁移价值，故收在 13 条。
- `fam-graph`（14 条）：`-graph` 类术语极多，但大多数是同一模式的重复（`seismograph`、`thermograph`…）；表中只保留能说明不同构词路径的代表。

**`allomorphs: []`（`fam-port`、`fam-form`）**

两族的词干在英语中不分化；`port-` 的拉丁分词词干 `portat-` 只出现在极生僻词里，`form-` 则完全单一。留空比编一个 `porta-` 更诚实。

## 6. 与词典侧的已知偏差（不在本目录修）

写这批数据时发现三处 `lexicon/` 侧问题，已上报，未在此处改动：

1. `morphemes.json` 的 `rx-stru` 把 `menstrual` 列为例词。`menstrual` 来自拉丁 `menstruus < mensis`「月」，与 `struere`「建造」无关，属同形异源。本目录在 `fam-struct.homographTraps` 中已把它标为反例。
2. `rx-duc` 的 `familyId` 为空，而 `words.json` 有 44 条 `fam-duct` 词条。词族页若按 `familyId` 反查词素会查不到，需要词典侧补上。
3. `cx-chron` 的 `examples` 与 `allomorphs` 均为空，`glossEn` 也偏简。本目录用 `fam-chron.json` 补齐了教学所需的例子，但词素条目本身仍需词典侧更新。

## 7. 新增一族的最小步骤

1. 在 `words.json` 里确认该族的 `family` 值与词条分布；没有词条则先确认 `morphemes.json` 有对应词根。
2. 写 `src/content/families/fam-<root>.json`，成员先取 `words.json` 已有词，再补 3–5 个真实常用词。
3. 每个 `layer` 段落用 `forms.json` 反查一次，确认能落到具体词素 ID。
4. `allomorphs` 只写有例词的变体；`homographTraps` 找不到就 `[]`。
5. 跑第 8 节自检，再人工读一遍 `note` 是否讲清了「方向 + 动作 → 词义」。

## 8. 自检

```bash
node -e "const fs=require('fs');const d='src/content/families';for(const f of fs.readdirSync(d)){const j=JSON.parse(fs.readFileSync(d+'/'+f,'utf8'));if(!j.members||j.members.length<6)console.log('THIN',f,j.members&&j.members.length)}"
```

更严格的逐段校验（本次使用）：

```bash
node -e "
const fs=require('fs');const d='src/content/families';
const forms=require('./src/content/lexicon/forms.json');
const morph=require('./src/content/lexicon/morphemes.json');
const mf=new Set(morph.map(m=>m.form));
for(const f of fs.readdirSync(d)){
  const j=JSON.parse(fs.readFileSync(d+'/'+f,'utf8'));
  const bad=[];const al=new Set(j.allomorphs.map(a=>a.form));
  j.members.forEach(m=>(m.layer||[]).forEach(s=>{const b=s.replace(/^-+|-+$/g,'');
    if(!forms[b]&&!mf.has(b)&&!al.has(b))bad.push(m.w+'/'+s);}));
  console.log(f,j.members.length,bad.length?bad.join(','):'layers-ok');
}"
```

当前 12 族全部通过：成员数 10–16，`layer` 无悬空段，`allomorphs` 均有实例词。
