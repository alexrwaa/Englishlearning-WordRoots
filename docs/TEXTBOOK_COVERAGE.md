# 教材覆盖率审计（自动生成）

生成时间：2026-11-21T00:57:46.077Z

> 本文件由 `npx tsx scripts/coverage.ts --write` 生成，请勿手工编辑。
> 数据来自教材清单、词库（含 `forms.json` 身份索引）、课程与审校记录四处独立来源。
> 判据见 `docs/DATA_IDENTITY.md` 第 5 节：L2 只认 `form + origin` 都一致的 ID，拼写相同不算。

## 一、七级覆盖

| 级别 | 判据 | 数量 | 占比 |
| --- | --- | --- | --- |
| L1 已登记 | 出现在 s1-elements.json | 559 | 100% |
| L2 已关联 | 元素 → 词素 ID，form 与 origin 同时一致 | 519 | 93% |
| L3 释义已核 | glossZh 与 glossEn 均非空且无占位符 | 519 | 93% |
| L4 例词充分 | ≥2 个「切分已核验」且 partIds 含该 ID 的词条（切分未核验的不计，即使 verified:true） | 253 | 45% |
| L5 有讲解 | 某课的 concepts 或卡片声明该 ID，或卡片正文以释义线索讲到它（存证据片段） | 230 | 41% |
| L6 有练习 | practice/apply 里有题目真正用到该 ID（parts / concepts / matrix base / 答案词的 partIds） | 207 | 37% |
| L7 已审校 | 该词素在 reviews.json 有审校记录（或记录自带 review.by） | 234 | 42% |

## 一之二、证据构成（可抽样复核）

| 级别 | 证据类型 | 数量 | 说明 |
| --- | --- | --- | --- |
| L5 | 卡片/课时声明 ID | 41 | 最强：作者显式声明 |
| L5 | 卡片声明拼写 | 22 | 拼写经身份索引解析到唯一 ID |
| L5 | 卡片正文释义 | 167 | 命中处附近有释义线索，报告存片段 |
| L6 | 题目声明成分 | 175 | parts / concepts / matrix base |
| L6 | 答案为已知词 | 32 | wordSum/cloze 答案词的 partIds 含该 ID |
| L7 | 有来源的审校 | 234 | 必须带 sources，否则不计 |

> 另有 **287** 个成分：所在章有知识点被讲到，但没有任何卡片或题目点名它。
> 这部分**不计入 L5**——章节相近不等于讲解证据，仅作为排课线索。

## 二、卡点分布（每个成分停在第一处未达标）

| 停在 | 数量 | 含义 |
| --- | --- | --- |
| L1 已登记 未过 | 0 | 出现在 s1-elements.json 尚未满足 |
| L2 已关联 未过 | 40 | 元素 → 词素 ID，form 与 origin 同时一致 尚未满足 |
| L3 释义已核 未过 | 0 | glossZh 与 glossEn 均非空且无占位符 尚未满足 |
| L4 例词充分 未过 | 266 | ≥2 个「切分已核验」且 partIds 含该 ID 的词条（切分未核验的不计，即使 verified:true） 尚未满足 |
| L5 有讲解 未过 | 98 | 某课的 concepts 或卡片声明该 ID，或卡片正文以释义线索讲到它（存证据片段） 尚未满足 |
| L6 有练习 未过 | 26 | practice/apply 里有题目真正用到该 ID（parts / concepts / matrix base / 答案词的 partIds） 尚未满足 |
| L7 已审校 未过 | 61 | 该词素在 reviews.json 有审校记录（或记录自带 review.by） 尚未满足 |
| — 七级全过 | 68 | 已登记、已关联、释义已核、例词充分、有讲解、有练习、已审校 |

## 三、各级差异清单（前 20 条）

### L1 已登记（缺 0 条）

- 无

### L2 已关联（缺 40 条）

- `-ise`（第 3 章）：同形同源多条记录且释义不匹配（sx-ise / sx-ize）
- `-a`（第 9 章）：同形同源多条记录且释义不匹配（px-a / px-a-lat / px-ab）
- `-able~-ible~-ble`（第 3, 11 章）：同形同源多条记录且释义不匹配（cx-ble-able / sx-abil / sx-ible）
- `-ac`（第 9 章）：词库中没有 form+origin 一致的记录（ac · G）
- `-al~-ial`（第 9 章）：同形同源多条记录且释义不匹配（cx-ol-al / px-ad / sx-al / sx-ial）
- `al`（第 10 章）：同形同源多条记录且释义不匹配（cx-ol-al / px-ad / sx-al / sx-ial）
- `al`（第 11 章）：同形同源多条记录且释义不匹配（cx-ol-al / px-ad / sx-al / sx-ial）
- `-ance`（第 3, 4 章）：词库中没有 form+origin 一致的记录（ance · L）
- `-ble~-able~-ible`（第 3, 11 章）：同形同源多条记录且释义不匹配（cx-ble-able / sx-abil / sx-ible）
- `cli`（第 9 章）：词库中没有 form+origin 一致的记录（cli · L, G）
- `co-~con-~com-`（第 3 章）：同形同源多条记录，释义仍无法区分（px-com / px-con）
- `con-~com-~co-`（第 3 章）：同形同源多条记录，释义仍无法区分（px-con / px-com）
- `-ive~-tive`（第 3,4,6 章）：同形同源多条记录且释义不匹配（cx-tive-ive / sx-ative）
- `ly`（第 11 章）：词库中没有 form+origin 一致的记录（ly · G）
- `-ment`（第 9 章）：词库中没有 form+origin 一致的记录（ment · L）
- `metr`（第 10 章）：同形同源多条记录且释义不匹配（cx-meter / cx-metr）
- `mis`（第 1 章）：词库中没有 form+origin 一致的记录（mis · G）
- `mitt~miss`（第 3,4 章）：同形同源多条记录，释义仍无法区分（rx-mitt / rx-mit）
- `nano-`（第 6 章）：词库中没有 form+origin 一致的记录（nano · G）
- `-nd~-and~-end`（第 9 章）：同形同源多条记录，释义仍无法区分（sx-nd / cx-and-end）

### L3 释义已核（缺 40 条）

- `-ise`（第 3 章）：同形同源多条记录且释义不匹配（sx-ise / sx-ize）
- `-a`（第 9 章）：同形同源多条记录且释义不匹配（px-a / px-a-lat / px-ab）
- `-able~-ible~-ble`（第 3, 11 章）：同形同源多条记录且释义不匹配（cx-ble-able / sx-abil / sx-ible）
- `-ac`（第 9 章）：词库中没有 form+origin 一致的记录（ac · G）
- `-al~-ial`（第 9 章）：同形同源多条记录且释义不匹配（cx-ol-al / px-ad / sx-al / sx-ial）
- `al`（第 10 章）：同形同源多条记录且释义不匹配（cx-ol-al / px-ad / sx-al / sx-ial）
- `al`（第 11 章）：同形同源多条记录且释义不匹配（cx-ol-al / px-ad / sx-al / sx-ial）
- `-ance`（第 3, 4 章）：词库中没有 form+origin 一致的记录（ance · L）
- `-ble~-able~-ible`（第 3, 11 章）：同形同源多条记录且释义不匹配（cx-ble-able / sx-abil / sx-ible）
- `cli`（第 9 章）：词库中没有 form+origin 一致的记录（cli · L, G）
- `co-~con-~com-`（第 3 章）：同形同源多条记录，释义仍无法区分（px-com / px-con）
- `con-~com-~co-`（第 3 章）：同形同源多条记录，释义仍无法区分（px-con / px-com）
- `-ive~-tive`（第 3,4,6 章）：同形同源多条记录且释义不匹配（cx-tive-ive / sx-ative）
- `ly`（第 11 章）：词库中没有 form+origin 一致的记录（ly · G）
- `-ment`（第 9 章）：词库中没有 form+origin 一致的记录（ment · L）
- `metr`（第 10 章）：同形同源多条记录且释义不匹配（cx-meter / cx-metr）
- `mis`（第 1 章）：词库中没有 form+origin 一致的记录（mis · G）
- `mitt~miss`（第 3,4 章）：同形同源多条记录，释义仍无法区分（rx-mitt / rx-mit）
- `nano-`（第 6 章）：词库中没有 form+origin 一致的记录（nano · G）
- `-nd~-and~-end`（第 9 章）：同形同源多条记录，释义仍无法区分（sx-nd / cx-and-end）

### L4 例词充分（缺 306 条）

- `-ise`（第 3 章）：同形同源多条记录且释义不匹配（sx-ise / sx-ize）
- `onomat`（第 10 章）：verified 词条只有 0 个（需要 2 个）
- `pug`（第 9 章）：verified 词条只有 0 个（需要 2 个）
- `pung`（第 9 章）：verified 词条只有 0 个（需要 2 个）
- `tetra`（第 6 章）：verified 词条只有 0 个（需要 2 个）
- `-a`（第 9 章）：同形同源多条记录且释义不匹配（px-a / px-a-lat / px-ab）
- `-able~-ible~-ble`（第 3, 11 章）：同形同源多条记录且释义不匹配（cx-ble-able / sx-abil / sx-ible）
- `-ac`（第 9 章）：词库中没有 form+origin 一致的记录（ac · G）
- `-acl~-acul (< -l diminutive)`（第 9 章）：verified 词条只有 0 个（需要 2 个）
- `-aden`（第 8 章）：verified 词条只有 0 个（需要 2 个）
- `-ae`（第 9 章）：verified 词条只有 0 个（需要 2 个）
- `aesth~esth`（第 5 章）：verified 词条只有 0 个（需要 2 个）
- `-al~-ial`（第 9 章）：同形同源多条记录且释义不匹配（cx-ol-al / px-ad / sx-al / sx-ial）
- `al`（第 10 章）：同形同源多条记录且释义不匹配（cx-ol-al / px-ad / sx-al / sx-ial）
- `al`（第 11 章）：同形同源多条记录且释义不匹配（cx-ol-al / px-ad / sx-al / sx-ial）
- `alb`（第 9 章）：verified 词条只有 0 个（需要 2 个）
- `alg`（第 8 章）：verified 词条只有 0 个（需要 2 个）
- `all~allel`（第 10 章）：verified 词条只有 0 个（需要 2 个）
- `alt (< al 'grow')`（第 5 章）：verified 词条只有 0 个（需要 2 个）
- `am~im`（第 4 章）：verified 词条只有 0 个（需要 2 个）

### L5 有讲解（缺 329 条）

- `crypt`（第 9 章）：没有任何课时讲到它
- `du`（第 6 章）：没有任何课时讲到它
- `-ise`（第 3 章）：同形同源多条记录且释义不匹配（sx-ise / sx-ize）
- `nat`（第 2 章）：没有任何课时讲到它
- `-oid`（第 3 章）：没有任何课时讲到它
- `pug`（第 9 章）：verified 词条只有 0 个（需要 2 个）
- `pung`（第 9 章）：verified 词条只有 0 个（需要 2 个）
- `-a`（第 9 章）：同形同源多条记录且释义不匹配（px-a / px-a-lat / px-ab）
- `ab-~abs-`（第 3, 6 章）：没有任何课时讲到它
- `-able~-ible~-ble`（第 3, 11 章）：同形同源多条记录且释义不匹配（cx-ble-able / sx-abil / sx-ible）
- `abs-~ab-`（第 3, 6 章）：没有任何课时讲到它
- `-ac`（第 9 章）：词库中没有 form+origin 一致的记录（ac · G）
- `-acl~-acul (< -l diminutive)`（第 9 章）：verified 词条只有 0 个（需要 2 个）
- `-acle~-acule (< -l diminutive)`（第 9 章）：没有任何课时讲到它
- `acr`（第 9 章）：没有任何课时讲到它
- `-aden`（第 8 章）：verified 词条只有 0 个（需要 2 个）
- `aesth~esth`（第 5 章）：verified 词条只有 0 个（需要 2 个）
- `agr`（第 9 章）：没有任何课时讲到它
- `-al~-ial`（第 9 章）：同形同源多条记录且释义不匹配（cx-ol-al / px-ad / sx-al / sx-ial）
- `al`（第 10 章）：同形同源多条记录且释义不匹配（cx-ol-al / px-ad / sx-al / sx-ial）

### L6 有练习（缺 352 条）

- `crypt`（第 9 章）：没有任何课时讲到它
- `du`（第 6 章）：没有任何课时讲到它
- `-ise`（第 3 章）：同形同源多条记录且释义不匹配（sx-ise / sx-ize）
- `onomat`（第 10 章）：verified 词条只有 0 个（需要 2 个）
- `pug`（第 9 章）：verified 词条只有 0 个（需要 2 个）
- `pung`（第 9 章）：verified 词条只有 0 个（需要 2 个）
- `tetra`（第 6 章）：verified 词条只有 0 个（需要 2 个）
- `-a`（第 9 章）：同形同源多条记录且释义不匹配（px-a / px-a-lat / px-ab）
- `-able~-ible~-ble`（第 3, 11 章）：同形同源多条记录且释义不匹配（cx-ble-able / sx-abil / sx-ible）
- `-ac`（第 9 章）：词库中没有 form+origin 一致的记录（ac · G）
- `-acl~-acul (< -l diminutive)`（第 9 章）：verified 词条只有 0 个（需要 2 个）
- `-acle~-acule (< -l diminutive)`（第 9 章）：没有任何课时讲到它
- `-aden`（第 8 章）：verified 词条只有 0 个（需要 2 个）
- `-ae`（第 9 章）：verified 词条只有 0 个（需要 2 个）
- `aesth~esth`（第 5 章）：verified 词条只有 0 个（需要 2 个）
- `agr`（第 9 章）：没有任何课时讲到它
- `-al~-ial`（第 9 章）：同形同源多条记录且释义不匹配（cx-ol-al / px-ad / sx-al / sx-ial）
- `al`（第 10 章）：同形同源多条记录且释义不匹配（cx-ol-al / px-ad / sx-al / sx-ial）
- `al`（第 11 章）：同形同源多条记录且释义不匹配（cx-ol-al / px-ad / sx-al / sx-ial）
- `alb`（第 9 章）：verified 词条只有 0 个（需要 2 个）

### L7 已审校（缺 325 条）

- `-ise`（第 3 章）：同形同源多条记录且释义不匹配（sx-ise / sx-ize）
- `a-~an-`（第 3, 4 章）：没有语言学审校记录（reviews.json 抽样未覆盖到它）
- `-a`（第 9 章）：同形同源多条记录且释义不匹配（px-a / px-a-lat / px-ab）
- `ab-~abs-`（第 3, 6 章）：没有任何课时讲到它
- `-able~-ible~-ble`（第 3, 11 章）：同形同源多条记录且释义不匹配（cx-ble-able / sx-abil / sx-ible）
- `abs-~ab-`（第 3, 6 章）：没有任何课时讲到它
- `ac`（第 9 章）：没有语言学审校记录（reviews.json 抽样未覆盖到它）
- `-ac`（第 9 章）：词库中没有 form+origin 一致的记录（ac · G）
- `-acl~-acul (< -l diminutive)`（第 9 章）：verified 词条只有 0 个（需要 2 个）
- `-acle~-acule (< -l diminutive)`（第 9 章）：没有任何课时讲到它
- `acr`（第 9 章）：没有任何课时讲到它
- `ad-`（第 3, 6 章）：没有语言学审校记录（reviews.json 抽样未覆盖到它）
- `-aden`（第 8 章）：verified 词条只有 0 个（需要 2 个）
- `-ae`（第 9 章）：verified 词条只有 0 个（需要 2 个）
- `agr`（第 9 章）：没有任何课时讲到它
- `-al~-ial`（第 9 章）：同形同源多条记录且释义不匹配（cx-ol-al / px-ad / sx-al / sx-ial）
- `al`（第 10 章）：同形同源多条记录且释义不匹配（cx-ol-al / px-ad / sx-al / sx-ial）
- `al`（第 11 章）：同形同源多条记录且释义不匹配（cx-ol-al / px-ad / sx-al / sx-ial）
- `al~ol~ul`（第 4 章）：没有任何课时讲到它
- `alb`（第 9 章）：verified 词条只有 0 个（需要 2 个）

## 四、词素明细

| 成分 | 释义 | 章 | 语源 | 词素 ID | L1 | L2 | L3 | L4 | L5 | L6 | L7 | 卡在 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| crypt | secret, hidden | 9 | G | cx-crypt | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| du | two | 6 | L | cx-du | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| -ise | V | 3 | G | — | ✓ | — | — | — | — | — | — | L2 |
| mono | one | 6 | G | px-mono | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| nat | source, birth, tribe | 2 | L | cx-nat | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | L5 |
| -oid | resembling | 3 | G | cx-oid | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | L5 |
| onomat | name | 10 | G | cx-onomat | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | L4 |
| pug | fight | 9 | L | cx-pug | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| pung | fight | 9 | L | cx-pung | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| sist | stand, state | 4 | L | rx-sist | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| tetra | four | 6 | G | cx-tetra | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | L4 |
| a-~an- | not, without | 3, 4 | G | px-a | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| -a | [plural] | 9 | L, G | — | ✓ | — | — | — | — | — | — | L2 |
| ab-~abs- | from, away | 3, 6 | L | px-ab | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | L5 |
| -able~-ible~-ble | A | 3, 11 | L | — | ✓ | — | — | — | — | — | — | L2 |
| abs-~ab- | from, away | 3, 6 | L | px-ab | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | L5 |
| ac | sharp | 9 | L | px-ad | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| -ac | A | 9 | G | — | ✓ | — | — | — | — | — | — | L2 |
| -acl~-acul (< -l diminutive) | little | 9 | L | cx-acl-acul | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| -acle~-acule (< -l diminutive) | little | 9 | L | sx-acle | ✓ | ✓ | ✓ | ✓ | — | — | — | L5 |
| acr | height, tip | 9 | G | cx-acr | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | L5 |
| ad- | to, toward | 3, 6 | L | px-ad | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| -aden | gland | 8 | G | cx-aden | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| -ae | [plural] | 9 | L | cx-ae | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| aesth~esth | feel | 5 | G | cx-aesth-esth | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| ag~ig | act, do, drive | 5 | L | cx-ag-ig | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| agr | field | 9 | L | cx-agr | ✓ | ✓ | ✓ | ✓ | — | — | — | L5 |
| -al~-ial | A | 9 | L | — | ✓ | — | — | — | — | — | — | L2 |
| al | other | 10 | L | — | ✓ | — | — | — | — | — | — | L2 |
| al | wing | 11 | L | — | ✓ | — | — | — | — | — | — | L2 |
| al~ol~ul | nurture, grow | 4 | L | cx-ol-al | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | L5 |
| alb | white | 9 | L | cx-alb | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| alg | pain | 8 | G | cx-alg | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| all~allel | other | 10 | G | cx-all-allel | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| alt (< al 'grow') | high | 5 | L | cx-alt | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| am~im | love | 4 | L | cx-am-im | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| ambul | walk, go | 5 | L | cx-ambul | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| an-~a- | not, without | 3, 4 | G | px-a | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| ana- | up, again, back | 3, 6 | G | cx-ana | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| -ance | N | 3, 4 | L | — | ✓ | — | — | — | — | — | — | L2 |
| -and~-end | N [gerundive] | 9 | L | cx-and-end | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| andr | male, man | 5 | G | cx-andr | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| anim | soul, mind, spirit, (nonplant) life | 2 | L | cx-anim | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | L6 |
| ann~enn | year | 4 | L | cx-ann-enn | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| -ant | A, N [present participle] | 3, 9 | L | sx-ant | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | L6 |
| ante-~anti- | before | 3 | L | px-ante | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| anthrop | human | 1 | G | cx-anthrop | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| anti-~ante- | before | 3 | L | px-ante | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| api | bee | 11 | L | cx-api | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| apo- | away from, off | 3 | G | cx-apo | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| -apt~-ept | fit, capable | 4 | L | cx-apt-ept | ✓ | ✓ | ✓ | — | — | ✓ | — | L4 |
| arachn | spider | 11 | G | cx-arachn | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| arch | first, govern | 5 | G | cx-arch | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| -arium | place | 9 | L | cx-arium | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| -ary | A, N | 3 | L | cx-ary | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| aster~astr | star | 9 | G | cx-aster-astr | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | L5 |
| -ate | N, A, V | 3, 7 | L | sx-ate | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| aud | hear | 9 | L | cx-aud | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| aur | ear | 8 | L | cx-aur | ✓ | ✓ | ✓ | ✓ | — | — | — | L5 |
| auto~tauto | self | 9 | G | px-auto | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| av | bird | 5 | L | cx-av | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| axill | armpit | 8 | L | cx-axill | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| bath~bathy | depth | 9 | G | cx-bath-bathy | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| bell | war | 6 | L | cx-bell | ✓ | ✓ | ✓ | — | — | ✓ | ✓ | L4 |
| bene~bon | good, well | 9 | L | cx-bene-bon | ✓ | ✓ | ✓ | — | — | ✓ | — | L4 |
| bi | two | 6 | L | cx-bi | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| bi | life | 1 | G | cx-bi-gk | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| bin | two (each) | 6 | L | cx-bin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| bl~bol | throw, extend | 4 | G | cx-bl-bol | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| -ble~-able~-ible | A | 3, 11 | L | — | ✓ | — | — | — | — | — | — | L2 |
| bol~bl | throw, extend | 4 | G | cx-bl-bol | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| bon~bene | good | 9 | L | cx-bene-bon | ✓ | ✓ | ✓ | — | — | ✓ | — | L4 |
| bou~bu | cow | 11 | G | cx-bou-bu | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| bov | cow | 11 | L | cx-bov | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| brach~brachy | short | 9 | G | cx-brach-brachy | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| bu~bou | cow | 11 | G | cx-bou-bu | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| cac | bad | 1 | G | cx-cac | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| cad~cas~cid | fall | 5 | L | cx-cad-cas | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | L4 |
| cap~cep~cip~cup | take, contain | 4 | L | rx-cap | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| car~carn | flesh | 9 | L | cx-car-carn | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| card | heart | 10 | G | cx-card | ✓ | ✓ | ✓ | ✓ | — | — | — | L5 |
| carn~car | flesh | 9 | L | cx-car-carn | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| cas~cad~cid | fall | 5 | L | cx-cad-cas | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | L4 |
| cata- | down, backward | 3 | G | cx-cata | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| caud~cod | tail | 8 | L | cx-caud-cod | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| ced~cess | go, let go | 5 | L | cx-ced-cess | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | L5 |
| cens | judge, assess | 6 | L | cx-cens | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| cent | hundred | 6 | L | cx-cent | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| cep~cap~cip~cup | take, contain | 4 | L | rx-cap | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| cephal | head | 6 | G | cx-cephal | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| cer~cri~cre | separate | 4 | L | cx-cer-cri | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | L5 |
| cervic | neck | 8 | L | cx-cervic | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| chili | thousand | 6 | G | cx-chili | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| chir | hand | 11 | G | cx-chir | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| chrom | color | 1 | G | cx-chrom | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | L4 |
| chron | time | 1 | G | cx-chron | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| cid~cad~cas | fall | 5 | L | cx-cad-cas | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | L4 |
| cid~cis | cut, kill | 4 | L | rx-cid | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| cip~cap~cep~cup | take, contain | 4 | L | rx-cap | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| cis~cid | cut, kill | 4 | L | rx-cid | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| clam | call out | 11 | L | cx-clam | ✓ | ✓ | ✓ | ✓ | — | — | — | L5 |
| clav | key, locked | 11 | L | cx-clav | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| -cl~-cul (< -l diminutive) | little | 9 | L | cx-cl-cul | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| cli | lean, lie, bed | 9 | L, G | — | ✓ | — | — | — | — | — | — | L2 |
| clud~clus | close (v) | 5 | L | rx-clud | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| co-~con-~com- | with, together | 3 | L | — | ✓ | — | — | — | — | — | — | L2 |
| col | inhabit, grow | 11 | L | px-com | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| con-~com-~co- | with, together | 3 | L | — | ✓ | — | — | — | — | — | — | L2 |
| contra~counter- | against, facing | 3 | L | cx-contra-counter | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | L6 |
| cord | heart | 10 | L | cx-cord | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | L4 |
| corp~corpor | body, flesh | 2, 3 | L | cx-corp-corpor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| cosm | universe, adorn, order | 1 | G | cx-cosm | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | L5 |
| counter~contra- | against, facing | 3 | L | cx-contra-counter | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | L6 |
| crac~crat | govern | 6 | G | cx-crac-crat | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | L6 |
| crat~crac | govern | 6 | G | cx-crac-crat | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | L6 |
| cre~cri~cer | separate | 4 | L | cx-cer-cri | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | L5 |
| cred | believe | 9 | L | rx-cred | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | L5 |
| cri | judge, separate | 4 | G | cx-cri | ✓ | ✓ | ✓ | ✓ | — | — | — | L5 |
| cri~cre~cer | separate | 4 | L | cx-cer-cri | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | L5 |
| cruc | cross, important point | 10 | L | cx-cruc | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| cryph~cryp | secret, hidden | 9 | G | cx-cryph-cryp | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| cub~cumb | lie down, remain | 4 | L | cx-cub-cumb | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | L4 |
| -cule~-cle (< -l diminutive) | little | 9 | L | cx-cule-cle | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| culp | fault | 2 | L | cx-culp | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| cumb~cub | lie down, remain | 4 | L | cx-cub-cumb | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | L4 |
| cup~cap~cep~cip | take, contain | 4 | L | rx-cap | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| cur | care | 6 | L | cx-cur | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| curs~curr | run | 11 | L | cx-curs-curr | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| cut | skin | 8 | L | cx-cut | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| da~do~di | give | 9 | L | cx-da-do | ✓ | ✓ | ✓ | — | — | ✓ | — | L4 |
| damn~demn | loss, harm | 9 | L | cx-damn-demn | ✓ | ✓ | ✓ | ✓ | — | — | — | L5 |
| iso- | equal | 3 | G | cx-iso | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| -itis | inflammation | 8 | G | cx-itis | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| -ity | N | 3 | L | sx-ity | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| -ium~-um | thing [singular] | 9 | L | cx-ium-um | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| -ive~-tive | A, N | 3,4,6 | L | — | ✓ | — | — | — | — | — | — | L2 |
| -ize | V | 3 | G | sx-ize | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| jun~juven | young | 10 | L | cx-jun-juven | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | L5 |
| jus~jur | law, judge | 9 | L | cx-jus-jur | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | L6 |
| juven~jun | young | 10 | L | cx-jun-juven | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | L5 |
| kilo- | thousand | 6 | G | cx-kilo | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | L6 |
| -l | [diminutive] little | 9 | L | cx-l | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| lab | lip | 8 | L | cx-lab | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| lachrym~lacrim | tear [tir] | 8 | L | cx-lachrym-lacrim | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| lacrim~lachrym | tear [tir] | 8 | L | cx-lachrym-lacrim | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| lact | milk | 8 | L | cx-lact | ✓ | ✓ | ✓ | ✓ | — | — | — | L5 |
| laryng | voice box | 8 | G | cx-laryng | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| lat | carry | 10 | L | rx-fer | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| leg | law, deputize | 2 | L | cx-leg | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | L6 |
| leg~lex~log | speak, study | 1 | G | cx-lex-leg | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | L6 |
| leg~lig | gather, read | 5 | L | rx-lect | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | L4 |
| lex~leg~log | word, speak | 1 | G | cx-lex-leg | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | L6 |
| libr | balance, weigh | 2 | L | cx-libr | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| lic | permit, unrestrained | 5 | L | cx-lic | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| lig | tie, bind | 10 | L | cx-lig | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | L6 |
| lig~leg | gather, read | 5 | L | rx-lect | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | L4 |
| lign | wood | 10 | L | cx-lign | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| lit~lith | stone | 9 | L | cx-lit-lith | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| liter | letter | 2 | L | cx-liter | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| lith~lit | stone | 9 | G | cx-lith-lit | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| loc | place | 6 | L | rx-loc | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| locu~loqu | speak | 10 | L | cx-locu-loqu | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | L5 |
| log~leg~lex | speak, study | 1 | G | cx-lex-leg | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | L6 |
| loqu~locu | speak | 10 | L | cx-locu-loqu | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | L5 |
| lu~lv | dissolve | 11 | L | cx-lu-lv | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| lumen~lumin~luc | light | 6 | L | cx-lumen-lumin | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | L6 |
| ly | loosen | 11 | G | — | ✓ | — | — | — | — | — | — | L2 |
| -ma | thing [singular] | 9 | G | cx-ma | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| macr | large | 1 | G | cx-macr | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| magn | great, large | 10 | L | cx-magn | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| mal~male | bad | 11 | L | cx-mal-male | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| mamm | breast | 8 | L | cx-mamm | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| man | hand, handle | 6 | L | rx-man | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| mant~manc | prophesy | 11 | G | cx-mant-manc | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| matr | mother | 10 | L | cx-matr | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | L5 |
| mega~megal | great, million | 9 | G | cx-mega-megal | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | L6 |
| men~mon | think, mind | 4 | L | cx-men-mon | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | L4 |
| -ment | N | 9 | L | — | ✓ | — | — | — | — | — | — | L2 |
| meso- | middle | 3 | G | cx-meso | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| meta- | beyond | 3 | G | cx-meta | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | L6 |
| metr | mother, uterus | 10 | G | — | ✓ | — | — | — | — | — | — | L2 |
| micr | small | 1 | G | cx-micr | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| mille | thousand | 6 | L | cx-mille | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| milli- | thousandth | 6 | L | cx-milli | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | L6 |
| mis | hate | 1 | G | — | ✓ | — | — | — | — | — | — | L2 |
| misc~mix | mix | 9 | L | cx-misc-mix | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| mitt~miss | send | 3,4 | L | — | ✓ | — | — | — | — | — | — | L2 |
| mne | remember | 4 | G | cx-mne | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| mo | move | 4 | L | cx-mo | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | L5 |
| mon | one | 6 | G | px-mono | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| mon~men | remind, think | 4 | L | cx-men-mon | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | L4 |
| -mony | N | 9 | L | cx-mony | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| morph | shape, form | 1 | G | cx-morph | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| mov~mo | move | 4 | L | cx-mo | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | L5 |
| mult | many | 6 | L | cx-mult | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| mun | public service, gift | 11 | L | cx-mun | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| myc | fungus | 10 | G | cx-myc | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| myri | countless, ten thousand | 6 | G | cx-myri | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| na~gen~gn | birth, source, tribe | 4 | L | cx-gn-gen | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | L4 |
| nano- | billionth | 6 | G | — | ✓ | — | — | — | — | — | — | L2 |
| nar~nas | nose | 8 | L | cx-nar-nas | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| nas~nar | nose | 8 | L | cx-nar-nas | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| nau | boat | 11 | G | cx-nau | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| nav | boat | 11 | L | cx-nav | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| -nd~-and~-end | N [gerundive] | 9 | L | — | ✓ | — | — | — | — | — | — | L2 |
| ne | new, recent | 5 | G | cx-ne | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| nec~noc~nic~nox | harm | 4 | L | cx-nec-noc | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| nec~necr | die | 4 | G | — | ✓ | — | — | — | — | — | — | L2 |
| nephr | kidney | 8 | G | cx-nephr | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| nic~nec~noc~nox | harm | 4 | L | cx-nec-noc | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| nihil~nil | nothing | 9 | L | cx-nihil-nil | ✓ | ✓ | ✓ | ✓ | — | — | — | L5 |
| no~gno~gni | know | 9 | L | cx-no-gno | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| noc~nec~nic~nox | harm | 4 | L | cx-nec-noc | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| noct | night | 10 | L | cx-noct | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| nom | law, system | 1 | G | cx-nom | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| nomen~nomin | name | 10 | L | cx-nomen-nomin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| non | ninth | 6 | L | px-non | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| nov | new | 2 | L | cx-nov | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| novem | nine | 6 | L | cx-novem | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| noven | nine (each) | 6 | L | cx-noven | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| nox~noc~nec~nic | harm | 4 | L | cx-nec-noc | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| -nt | A, N [present participle] | 3,9 | L | cx-nt | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| null | nothing | 11 | L | cx-null | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| nyct | night | 10 | G | cx-nyct | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| -o- | [empty interfix] | 3 | G | cx-o | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | L5 |
| -ob- | toward, against | 3 | L | px-ob | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| octa- | eight | 6 | G | cx-octa | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| octav | eighth | 6 | L | cx-octav | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| octo | eight | 6 | L | cx-octo | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| octon | eight (each) | 6 | L | cx-octon | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| ocul | eye | 9 | L | cx-ocul | ✓ | ✓ | ✓ | ✓ | — | — | — | L5 |
| odont | tooth | 11 | G | cx-odont | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| oen~en | wine | 11 | G | cx-oen-en | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| ol~al | nurture, grow | 4 | L | cx-ol-al | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | L5 |
| -ol (< -l diminutive) | little | 9 | L | cx-ol-al | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | L5 |
| olig | few | 6 | G | cx-olig | ✓ | ✓ | ✓ | ✓ | — | — | — | L5 |
| -oma | tumor, growth | 8 | G | cx-oma | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| omn | all | 2,6 | L | cx-omn | ✓ | ✓ | ✓ | ✓ | — | — | — | L5 |
| -on | N [singular] thing | 9 | G | cx-on | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| onom~ononat~onym | name | 10 | G | cx-onom-ononat | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | L4 |
| oo | egg | 11 | G | cx-oo | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| op | see | 8 | G | — | ✓ | — | — | — | — | — | — | L2 |
| ophthalm | eye | 8 | G | cx-ophthalm | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | L4 |
| org~erg~urg | work | 4 | G | cx-erg-urg | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| orn~ornith | bird | 11 | G | cx-orn-ornith | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| orth | straight, correct | 10 | G | cx-orth | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| -ory | A, N | 3 | L | sx-ory | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| os~or | mouth, opening | 8 | L | cx-os-or | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | L5 |
| oss | bone | 8 | L | cx-oss | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| oste | bone | 8 | G | cx-oste | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| -ous~-ose | A | 3 | L | — | ✓ | — | — | — | — | — | — | L2 |
| ov | egg | 11 | L | cx-ov | ✓ | ✓ | ✓ | ✓ | — | — | — | L5 |
| ox~oxy | sharp | 11 | G | cx-ox-oxy | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| paed~ped | child, teach | 10 | G | cx-paed-ped | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| pale~palae | old | 10 | G | cx-pale-palae | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| pan~pant~par | all | 6 | G | cx-pan-pant | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| par | give birth to | 2 | L | cx-par | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | L4 |
| para- | beside, nearly | 3 | G | cx-para | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | L4 |
| reg-rig | rule, straight | 5 | L | cx-reg-rig | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| rhin | nose | 8 | G | cx-rhin | ✓ | ✓ | ✓ | — | — | ✓ | ✓ | L4 |
| rhiz | root | 10 | G | cx-rhiz | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| rig~reg | rule, straight | 5 | L | cx-rig-reg | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | L6 |
| rog | ask | 11 | L | cx-rog | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| sacr~sanc~secr | holy | 4 | L | cx-sacr-sanc | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| sal~sil | jump | 10 | L | cx-sal-sil | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| salv~salu | safe, greet, healthy | 10 | L | cx-salv-salu | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| sarc | flesh | 8 | G | cx-sarc | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| -sc~-esc | begin | 9 | L | cx-esc-sc | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| sci | know, discern | 2 | L | cx-sci | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| scind~sciss | split | 2, 11 | L | cx-scind-sciss | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| scler | hard | 8 | G | cx-scler | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| se-~sed- | apart | 3, 6 | L | px-se | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| sec | cut, split | 2 | L | cx-sec | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| semen~semin | seed | 4 | L | cx-semen-semin | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| semi- | half | 6 | L | px-semi | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| sen | old (person) | 11 | L | cx-sen | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | L5 |
| sen | six (each) | 6 | L | cx-sen | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | L5 |
| sent~sens | feel | 5 | L | rx-sens | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| sep | putrid, infected | 8 | G | cx-sep | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| septem | seven | 6 | L | cx-septem | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| septen | seven (each) | 6 | L | cx-septen | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| septim | seventh | 6 | L | cx-septim | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| serp | to creep, snake | 11 | L | cx-serp | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| sesqui- | one and a half | 6 | L | cx-sesqui | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| sex | six | 6 | L | cx-sex | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| sext | sixth | 6 | L | cx-sext | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| sil~sal | jump | 10 | L | cx-sal-sil | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| -sis | N | 3 | L | cx-sis | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| som~somat | body | 11 | G | cx-som-somat | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | L4 |
| somn | sleep | 2 | L | cx-somn | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | L4 |
| son | sound | 6 | L | cx-son | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | L5 |
| soph | wise | 11 | G | cx-soph | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| soror | sister | 10 | L | cx-soror | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| spec~spic | look, see | 4 | L | rx-spec | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| spor | scatter, seed | 10 | G | cx-spor | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| sta~ste | stand, state | 4 | G | — | ✓ | — | — | — | — | — | — | L2 |
| sti~sta~ste~st | stand, state | 4 | L | rx-sist | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| stom~stomat | mouth, opening | 8 | G | cx-stom-stomat | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| strat | stretch, level, layer | 11 | L | cx-strat | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| sub- | under, inferior | 3, 6, 7 | L | px-sub | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| super- | above, excessive | 3 | L | px-super | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| syn- | with, together | 3, 6 | G | px-syn | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| -t | [perfect participle] | 9 | L | cx-t | ✓ | ✓ | ✓ | — | — | ✓ | — | L4 |
| tac | arrange, order | 9 | G | cx-tac | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| tach~tachy | fast | 9 | G | cx-tach-tachy | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| tag~teg~tig~tang~ting | touch | 4 | L | cx-tag-teg | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | L4 |
| tauto~auto | self | 9 | G | px-auto | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| teg~tag~tig~tang~ting | touch | 4 | L | cx-tag-teg | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | L4 |
| tel~tele | end, complete | 11 | G | cx-tel-tele | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| tele | far | 5 | G | px-tele | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| tempor | time | 3 | L | cx-tempor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| ten~tend~tens | stretch, thin | 5 | L | cx-tend-tens | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | L4 |
| ten~tin | hold, maintain | 4 | L | rx-ten | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| tend~tens~ten | stretch, thin | 5 | L | cx-tend-tens | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | L4 |
| tern | three (each) | 6 | L | cx-tern | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| terr | earth | 9 | L | cx-terr | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| terti | third | 6 | L | cx-terti | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| tetta~tessara | four | 6 | G | cx-tetta-tessara | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| the | put, place | 10 | G | cx-the | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | L6 |
| the | god | 1 | G | cx-the | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | L6 |
| thromb | clot | 8 | G | cx-thromb | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| tig~ting~tag~teg~tang | touch | 4 | L | cx-tag-teg | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | L4 |
| -tion~-ion | N | 3 | L | — | ✓ | — | — | — | — | — | — | L2 |
| de- | reverse, from | 3,7 | L | px-de | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| de~div | god, augury | 4 | L | cx-div-de | ✓ | ✓ | ✓ | — | — | ✓ | ✓ | L4 |
| dec | acceptable | 10 | L | cx-dec | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| deca | ten | 6 | G | cx-deca | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | L4 |
| decem | ten | 6 | L | cx-decem | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| decim~deci | tenth | 6 | L | cx-decim-deci | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| dem | people | 6 | G | cx-dem | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| demn~damn | loss, harm | 9 | L | cx-damn-demn | ✓ | ✓ | ✓ | ✓ | — | — | — | L5 |
| den | ten (each) | 6 | L | cx-den | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| dendr~dry | tree | 11 | G | cx-dendr-dry | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| dent | tooth | 11 | L | cx-dent | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| dermat~derm | skin | 8 | G | cx-dermat-derm | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | L4 |
| deuter | second | 6 | G | cx-deuter | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| di~da~do | give | 9 | L | cx-da-do | ✓ | ✓ | ✓ | — | — | ✓ | — | L4 |
| di~dy | two | 6 | G | cx-dy-di | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| dia- | through | 3 | G | cx-dia | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| dic | say, point | 9 | L | cx-dic | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| dich | (split in) two | 6 | G | cx-dich | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| dipl | double | 6 | G | cx-dipl | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| div~de | god, augury | 4 | L | cx-div-de | ✓ | ✓ | ✓ | — | — | ✓ | ✓ | L4 |
| do | give | 9 | G | cx-do | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| doc | teach | 5 | L | cx-doc | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| doc~dog | opinion | 5 | G | — | ✓ | — | — | — | — | — | — | L2 |
| dol | suffer | 9 | L | cx-dol | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| duc | to lead | 2 | L | rx-duc | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| dy~di | two | 6 | G | cx-dy-di | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| dyn | power | 11 | G | cx-dyn | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| e-~ex- | out | 3,6,7 | L | px-e | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| ec- | out | 3 | G | cx-ec | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| ecto- | outside | 3 | G | cx-ecto | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| ed~es | eat | 10 | L | — | ✓ | — | — | — | — | — | — | L2 |
| -el1 (< -l diminutive) | little | 9 | L | cx-el1 | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| em~hem~haem | blood | 8 | G | cx-haem-hem | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| -eme | [abstract unit] | 4 | G | cx-eme | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| en- | in | 3 | G | cx-oen-en | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| -ence | N | 3,4 | L | sx-ence | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| -end~-and | N [gerundive] | 9 | L | cx-and-end | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| endo- | inside | 3 | G | cx-endo | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| enn~ann | year | 4 | L | cx-ann-enn | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| ennea | nine | 6 | G | cx-ennea | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| -ent | A, N [present participle] | 3,9 | L | — | ✓ | — | — | — | — | — | — | L2 |
| epi- | on, over | 3 | G | cx-epi | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| ept~apt | fit, capable | 4 | L | cx-apt-ept | ✓ | ✓ | ✓ | — | — | ✓ | — | L4 |
| equ~iqu | even, level | 4 | L | cx-equ-iqu | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| erg~urg~org | work | 4 | G | cx-erg-urg | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| ero | physical love | 5 | G | cx-ero | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| err | wander, do wrong | 9 | L | cx-err | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| -esc~-sc | begin | 9 | L | cx-esc-sc | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| -esim | -th (ordinal number) | 6 | L | cx-esim | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| esth~aesth | feel | 5 | G | cx-aesth-esth | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| eu- | good | 5 | G | cx-eu | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| ev | age | 11 | L | cx-ev | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| ex-~e- | out | 3,6,7 | L | px-e | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| extra- | outside | 3,7 | L | cx-extra | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | L4 |
| fa | speak | 10 | L | cx-fa | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| fac~fec~fic | do, make | 4 | L | cx-fac-fec | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| fec~fac~fic | do, make | 4 | L | cx-fac-fec | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| fer | carry | 10 | L | rx-fer | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| fic~fec~fac | do, make | 4 | L | cx-fac-fec | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| fla | blow | 6 | L | cx-fla | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| flu~fluc~fluv | flow, river | 9 | L | cx-flu-fluc | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| formic | ant | 11 | L | cx-formic | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| frag~frang~fring | break | 4 | L | cx-frag-frang | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| frang~frag~fring | break | 4 | L | cx-frag-frang | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| fratr | brother | 10 | L | cx-fratr | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| fring~frag~frang | break | 4 | L | cx-frag-frang | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| fug | flee | 2 | L | cx-fug | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| fund~fus | pour, melt, blend | 4 | L | cx-fund-fus | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | L5 |
| fus~fund | pour, melt, blend | 4 | L | cx-fund-fus | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | L5 |
| galact | milk | 8 | G | cx-galact | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| gam | marry, unite | 1 | G | cx-gam | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| gastr | stomach | 8 | G | cx-gastr | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | L6 |
| ge | earth | 10 | G | cx-ge | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| gemin | twin | 10 | L | cx-gemin | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| gen~gn~na | birth, type, origin | 4 | L | cx-gn-gen | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | L4 |
| gen~gon | birth | 4 | G | cx-gon-gen | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| ger | old person | 10 | G | cx-ger | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| giga | giant, billion | 6 | G | cx-giga | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| gloss~glott | tongue, speech | 9 | G | cx-gloss-glott | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | L4 |
| gn~gen~na | birth, type, origin | 4 | L | cx-gn-gen | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | L4 |
| gno | know | 9 | G | cx-gno | ✓ | ✓ | ✓ | — | — | ✓ | — | L4 |
| gon~gen | birth | 4 | G | cx-gon-gen | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| grad~gred~gress | step, go | 5 | L | cx-grad-gred | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | L5 |
| graph~gramm | write | 10 | G | cx-graph | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| grat | goodwill, thankful, pleased, kind | 2 | L | cx-grat | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| gravid | pregnant | 8 | G | cx-gravid | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| gred~grad~gress | step, go | 5 | L | cx-grad-gred | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | L5 |
| greg | social group, gather | 2 | L | cx-greg | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| gress~grad~gred | step, go | 5 | L | cx-grad-gred | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | L5 |
| gyn~gynec | woman, female | 9 | G | cx-gyn-gynec | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| haem~hem~em | blood | 8 | G | cx-haem-hem | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| hecaton | hundred | 6 | G | cx-hecaton | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| heli | sun | 5 | G | cx-heli | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| hem~haem~em | blood | 8 | G | cx-haem-hem | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| hemi- | half | 6 | G | cx-hemi | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| hepat | liver | 8 | G | cx-hepat | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | L6 |
| hepta | seven | 6 | G | cx-hepta | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| her~hes | to stick, hold back | 9 | L | rx-her | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| herp~herpet | to creep, reptile | 11 | G | cx-herp-herpet | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| hes~her | to stick, hold back | 9 | L | rx-her | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| hetero- | other, different | 3 | G | cx-hetero | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| hexa | six | 6 | G | cx-hexa | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | L6 |
| hist | body tissue | 8 | G | cx-hist | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| hom | human | 2 | L | cx-hom | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | L4 |
| homo- | same | 3 | G | cx-homo | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| hor | hour | 11 | G | cx-hor | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| hydr~hydat | water | 9 | G | cx-hydro | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| hypo- | under, below, partial | 3 | G | px-hypo | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| hyster | womb, neurotic disorder | 8 | G | cx-hyster | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| -i- | [empty interfix] | 3 | L | cx-i | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| -ia | land, state, medical condition | 8 | G,L | sx-ia | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| -ial~-al | A | 9 | L | — | ✓ | — | — | — | — | — | — | L2 |
| iatr | heal | 1 | G | cx-iatr | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | L5 |
| -ible~-able~-ble | A | 3,11 | L | — | ✓ | — | — | — | — | — | — | L2 |
| -ic | A, N | 3 | G,L | sx-ic | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| ichthy | fish | 11 | G | cx-ichthy | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| -icl~-icul (< -l diminutive) | little | 9 | L | cx-icl-icul | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| icosa | twenty | 6 | G | cx-icosa | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| idi | personal | 1 | G | cx-idi | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| ig~ag | act, do, drive | 5 | L | cx-ag-ig | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| -il | A | 4,9 | L | — | ✓ | — | — | — | — | — | — | L2 |
| -ill (< -l diminutive) | little | 9 | L | cx-ill | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| im~am | love | 4 | L | cx-am-im | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| in- | not | 3 | L | px-in | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | L5 |
| in- | in, into | 3 | L | px-im | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | L5 |
| infra- | below, after | 3 | L | px-infra | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| inter- | between, among | 3 | L | px-inter | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| intra- | within | 3 | L | px-intra | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| iqu~equ | even, level | 4 | L | cx-equ-iqu | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| -tive~-ive | A, N | 2, 3, 6 | L | — | ✓ | — | — | — | — | — | — | L2 |
| tom~tm | cut | 4 | G | cx-tom-tm | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | L4 |
| top | place | 1 | G | cx-top | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | L6 |
| tot | whole, all | 6 | L | cx-tot | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| tra~trans- | across, through | 3, 6 | L | cx-tra-trans | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| trans~tra- | across, through | 3, 6 | L | cx-tra-trans | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| tri | three | 6 | L | cx-tri | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| trich (< tri) | three (parts) | 6 | G | cx-trich | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| trit | third | 6 | G | cx-trit | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| trop | to turn | 11 | G | cx-trop | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| trud~trus | thrust | 5 | L | cx-trud-trus | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| -ture~-ure | N | 9 | L | — | ✓ | — | — | — | — | — | — | L2 |
| -ty | N | 4, 9 | L | — | ✓ | — | — | — | — | — | — | L2 |
| -ule (< -l diminutive) | little | 9 | L | cx-ule | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | L4 |
| -um~-ium | thing [singular] | 9 | L | cx-ium-um | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| un | one | 6 | L | — | ✓ | — | — | — | — | — | — | L2 |
| urg~erg~org | work | 4 | G | cx-erg-urg | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| -us | N, A [masculine singular] | 9 | L | cx-us | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| uxor | wife | 10 | L | cx-uxor | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| vac~van | empty | 9 | L | cx-vac-van | ✓ | ✓ | ✓ | — | — | ✓ | ✓ | L4 |
| val | strong, useful | 10 | L | cx-val | ✓ | ✓ | ✓ | — | — | ✓ | — | L4 |
| van~vac | empty | 9 | L | cx-vac-van | ✓ | ✓ | ✓ | — | — | ✓ | ✓ | L4 |
| vas | vessel, blood vessel, duct | 8 | L | cx-vas | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| ven | come | 2 | L | cx-ven | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | L5 |
| ven | vein | 8 | L | cx-ven-2 | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| ver | true | 2 | L | cx-ver | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | L5 |
| ver | turn | 9 | L | — | ✓ | — | — | — | — | — | — | L2 |
| verg (< ver) | turn | 9 | L | cx-verg | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| verm (< ver 'turn') | worm | 11 | L | cx-verm | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| viginti | twenty | 6 | L | cx-viginti | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| vin | wine | 11 | L | cx-vin | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| vinc~vic | conquer | 4 | L | cx-vinc-vic | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| vit~viv | live | 9 | L | cx-vit-viv | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| viv~vit | live | 9 | L | cx-vit-viv | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| voc | call, voice | 10 | L | cx-voc | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| vom | regurgitate | 3 | L | cx-vom | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| vor | eat | 4 | L | cx-vor | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| xen | foreign | 1 | G | cx-xen | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| xyl | wood | 11 | G | cx-xyl | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| -y | N | 3 | G, L | — | ✓ | — | — | — | — | — | — | L2 |
| zo | animal | 4 | G | cx-zo | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| path | feel, illness | 1 | G | cx-path | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | L4 |
| patr | father, country | 10 | G, L | — | ✓ | — | — | — | — | — | — | L2 |
| pauc | few | 6 | L | cx-pauc | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| ped | foot | 10 | L | rx-ped | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| ped~paed | child, teach | 10 | G | cx-paed-ped | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| pen~pun | punish | 9 | L | cx-pen-pun | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| pend~pond | hang, weigh | 4 | L | cx-pend-pond | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | L5 |
| penta | five | 6 | G | cx-penta | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| per- | through, thorough | 3 | L | px-per | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| peri- | around, near | 3 | G | cx-peri | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| pet | seek, go to | 2 | L | cx-pet | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | L5 |
| petr | rock | 1 | G | cx-petr | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| pha~phe | speak | 10 | G | cx-pha-phe | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| phag | eat | 11 | G | cx-phag | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| phe~pha | speak | 10 | G | cx-pha-phe | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| pher~phor | carry | 10 | G | cx-pher-phor | ✓ | ✓ | ✓ | ✓ | — | — | — | L5 |
| phil | liking, tendency | 1 | G | cx-phil | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| phleb | vein | 8 | G | cx-phleb | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| phob | fear | 8 | G | cx-phob | ✓ | ✓ | ✓ | ✓ | — | — | — | L5 |
| phon | sound | 1 | G | cx-phon | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| phor~pher | carry | 10 | G | cx-pher-phor | ✓ | ✓ | ✓ | ✓ | — | — | — | L5 |
| phot~phos | light | 5 | G | cx-phot-phos | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| phylac | guard | 8 | G | cx-phylac | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| phyll | leaf | 10 | G | cx-phyll | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| phyt | plant | 10 | G | cx-phyt | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| pithec | ape | 11 | G | cx-pithec | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| pl~plec~plic | fold, entwine, times | 6 | L | cx-pl-plec | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | L5 |
| plac | please | 11 | L | cx-plac | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| plac | flat | 11 | G | cx-plac-gk | ✓ | ✓ | ✓ | — | — | ✓ | ✓ | L4 |
| ple | full, many | 9 | L | cx-ple | ✓ | ✓ | ✓ | ✓ | — | — | — | L5 |
| plec~pl~plic | times, fold, entwine | 6 | L | cx-pl-plec | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | L5 |
| plic~pl~plec | times, fold, entwine | 6 | L | cx-pl-plec | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | L5 |
| plur | many, more | 6 | L | cx-plur | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| pne~pneum | breathe, lung | 8 | G | cx-pne-pneum | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | L4 |
| pod~pus | foot | 10 | G | — | ✓ | — | — | — | — | — | — | L2 |
| pol | community | 1 | G | cx-pol | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| poly | many | 6 | G | cx-poly | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | L5 |
| pom | fruit, apple | 10 | L | cx-pom | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| pon~pos | place, put | 9 | L | rx-pos | ✓ | ✓ | ✓ | ✓ | — | — | — | L5 |
| pond~pend | hang, weigh | 4 | L | cx-pend-pond | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | L5 |
| pos~pon | place, put | 9 | L | rx-pos | ✓ | ✓ | ✓ | ✓ | — | — | — | L5 |
| poss~pot | able, powerful | 2 | L | cx-poss-pot | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| post- | after, behind | 3 | L | px-post | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| pot | able, powerful | 2 | L | cx-poss-pot | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |
| prac | act, do | 5 | G | cx-prac | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | L4 |
| pre- | before | 3 | L | px-pre | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| pred | preying | 10 | L | cx-pred | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| prim | first | 6 | L | cx-prim | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| pro- | forward, for | 3 | L, G | px-pro | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| prob | good, test | 2 | L | cx-prob | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| prot | first | 6 | G | cx-prot | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| pseud | false | 1 | G | cx-pseud | ✓ | ✓ | ✓ | — | — | — | ✓ | L4 |
| psych | mind | 1 | G | cx-psych | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全过 |
| pter | wing, feather | 11 | G | rx-pter | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | L6 |
| pugn (< pug) | fist, fight | 9 | L | cx-pugn | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| pulm~pulmon | lung | 8 | L | cx-pulm-pulmon | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| pun~pen | punish | 9 | L | cx-pen-pun | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| pus~pod | foot | 10 | G | — | ✓ | — | — | — | — | — | — | L2 |
| pyr | fire | 1 | G | cx-pyr | ✓ | ✓ | ✓ | — | — | ✓ | ✓ | L4 |
| quadr | four | 6 | L | cx-quadr | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | L6 |
| quart | fourth | 6 | L | cx-quart | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| quatern | four (each) | 6 | L | cx-quatern | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| quin | five (each) | 6 | L | cx-quin | ✓ | ✓ | ✓ | — | — | — | — | L4 |
| quinque | five | 6 | L | cx-quinque | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| quint | fifth | 6 | L | cx-quint | ✓ | ✓ | ✓ | — | ✓ | — | — | L4 |
| re-~red- | again, back | 3, 4, 6 | L | px-re | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | L7 |

## 五、知识点覆盖

- 已识别知识点：283
- 已映射到课程：283（100%）
- 章节数：11，小节数：116，题型种类：46

## 六、知识点明细

| 知识点 | 章 | 小节 | 类型 | 课时声明 | 仅生成映射 |
| --- | --- | --- | --- | --- | --- |
| 英语词汇的规模与分布 | S1-C1 | Word Power and a World Power | concept | w31d1 | — |
| 词汇丰富的两面性 | S1-C1 | Word Power and a World Power | concept | w31d2 | — |
| 以形态规则替代逐词记忆 | S1-C1 | On the Attack | method | w12d7 | — |
| 外延与内涵决定近义词的分工 | S1-C1 | Precision and Adaptability | concept | w31d3 | — |
| 能产性使词典必然滞后 | S1-C1 | Precision and Adaptability | concept | w02d6, w03d3 | — |
| 词汇变化是常态而非衰败 | S1-C1 | The Constantly Evolving Nature of English Vocabulary | concept | w07d5 | — |
| 掌握词汇包括掌握语域 | S1-C1 | The Constantly Evolving Nature of English Vocabulary | concept | w09d1, w12d5 | — |
| 借词加本土化改造是词汇扩张主因 | S1-C1 | Why English Is So Rich | history | w09d5 | — |
| 本族词与借词的同义分工 | S1-C1 | Why English Is So Rich | rule | w09d1, w09d7 | — |
| 超长技术词可按词素逐段赋义 | S1-C1 | Pneumonoultramicroscopicsilicovolcanoconiosis | method | w32d1 | — |
| 解析与造词共用一套程序 | S1-C1 | Pneumonoultramicroscopicsilicovolcanoconiosis | method | w32d2 | — |
| 一词三形：cap 经法语音变留下三组借词 | S1-C1 | The History Hidden in Words | history | w31d4 | — |
| 语音对应可揭示语言亲缘 | S1-C1 | The History Hidden in Words | history | w31d5 | — |
| 词素结构可作拼写线索 | S1-C1 | Additional Goals | rule | w32d3 | — |
| 语言变化的评价：腐化还是丰富 | S1-C1 | Additional Goals | concept | w07d5 | — |
| 本书涉及的语言学分支 | S1-C1 | Additional Goals | concept | w32d4 | — |
| 英语的同一性来自共同历史 | S1-C2 | Background to the History of English | history | w33d1 | — |
| 语言起源不可考但分化可以比较 | S1-C2 | Origins of Language | history | w33d2 | — |
| 语言分化与谱系隐喻 | S1-C2 | Origins of Language | concept | w33d3 | — |
| 印欧语系的范围与高度屈折的祖语 | S1-C2 | Indo-European | history | w33d4 | — |
| 语言扩张源于权势而非优劣 | S1-C2 | Indo-European | history | w33d5 | — |
| 语系中 branch 与 family 的区别 | S1-C2 | Indo-European | classification | w33d6 | — |
| 英语属日耳曼支且屈折持续简化 | S1-C2 | Germanic | history | w33d6 | — |
| 格里姆定律：日耳曼辅音的系统对应 | S1-C2 | Germanic | rule | w34d1 | — |
| 东日耳曼与最早的拉丁借词 | S1-C2 | Germanic | history | w34d2 | — |
| 早期拉丁影响来自欧陆接触而非罗马治英 | S1-C2 | Germanic | history | w34d3 | — |
| 五世纪西日耳曼扩张与法兰克人的语言选择 | S1-C2 | West Germanic | history | w34d4 | — |
| 英语最近的亲属是弗里西亚语 | S1-C2 | West Germanic | classification | w34d4 | — |
| 以三阶段为纲叙述借词史 | S1-C2 | Major Stages in the History of English | classification | w09d7 | — |
| 凯尔特语被取代与威尔士语的存留 | S1-C2 | Prehistoric English | history | w34d5 | — |
| 为何不列颠未像高卢那样改说拉丁语 | S1-C2 | Prehistoric English | history | w34d6 | — |
| Angles、Saxons、Kents 与 England 之名 | S1-C2 | Prehistoric English | history | w35d1 | — |
| 文献稀少的前古英语期与基督教化借词 | S1-C2 | Prehistoric English | history | w35d1 | — |
| 历史英语的起点与三分期惯例 | S1-C2 | Old English | history | w35d2 | — |
| 古英语屈折词尾承担句法功能 | S1-C2 | Old English | concept | w35d2 | — |
| 阿尔弗雷德大帝与西撒克逊文学标准 | S1-C2 | Old English | history | w35d3 | — |
| 诺斯借词与同源双式词 | S1-C2 | Old English | history | w09d2 | — |
| 诺曼征服改变英语的社会地位 | S1-C2 | Middle English | history | w09d1 | — |
| 13世纪法语借词的三个语义领域 | S1-C2 | Middle English | history | w09d1 | — |
| Latinate：不必区分直接与间接借自拉丁 | S1-C2 | Middle English | concept | w35d4 | — |
| 词尾元音弱化导致屈折合并 | S1-C2 | Middle English | rule | w35d5 | — |
| 伦敦标准语转向中部方言 | S1-C2 | Middle English | history | w35d5 | — |
| 印刷术与文艺复兴推动标准化和古典借词 | S1-C2 | Modern English | history | w35d6 | — |
| 元音大推移的标志性对应 | S1-C2 | Modern English | rule | w35d6 | — |
| 殖民扩张带来世界性借词 | S1-C2 | Modern English | history | w09d5, w09d7 | — |
| 古典词素可造出古人未有的词 | S1-C2 | Modern English | rule | w06d2, w06d3, w06d6, w11d1, w11d7 | — |
| 英语的核心仍是日耳曼的 | S1-C2 | Modern English | classification | w09d2 | — |
| 词素是最小的形义单位 | S1-C3 | The Basics of Morphology | concept | w01d1 | — |
| 词素不等于音节 | S1-C3 | The Basics of Morphology | concept | w01d1 | — |
| 组合性：部件给线索但不等于全义 | S1-C3 | The Basics of Morphology | concept | w07d1 | — |
| 形态分析不等于词源追溯 | S1-C3 | The Basics of Morphology | rule | w01d6, w02d4, w05d3, w05d7, w08d6, w09d6 | — |
| 词素可按功能分为词根与词缀 | S1-C3 | Functions of Morphological Elements | classification | w01d1, w01d7 | — |
| 自由词根与粘着词根 | S1-C3 | Roots and Affixes | classification | w01d2, w02d2 | — |
| 词缀按位置分为五类 | S1-C3 | Affixes | classification | w36d1 | — |
| 屈折与派生：改语法还是造新词 | S1-C3 | Affixes | classification | w01d4 | — |
| 词结构是层级的而非线性的 | S1-C3 | Structure | rule | w01d3, w02d1, w02d4, w04d6, w11d2, w12d1 | — |
| 词缀的语义密度差异很大 | S1-C3 | Affix Meanings | concept | w36d2 | — |
| 无义的间缀仍有构词作用 | S1-C3 | Affix Meanings | concept | w01d5, w01d7, w06d1, w06d7, w11d1 | — |
| 词根义也只是提示，靠比喻延伸 | S1-C3 | Root Meanings | concept | w05d3, w05d4, w05d5 | — |
| 后缀既定词性也附加意义 | S1-C3 | Affix Meanings Again | rule | w01d4, w02d2, w04d1, w04d2, w04d3, w04d5, w04d7 | — |
| 同形异缀须分开处理 | S1-C3 | Affix Meanings Again | classification | w03d1, w04d2, w04d3, w04d4, w04d5 | — |
| 词素义随搭配环境漂移 | S1-C3 | Other Variations in the Meanings of Word Elements | concept | w03d4 | — |
| 义变常循可描述的规律 | S1-C3 | Other Variations in the Meanings of Word Elements | rule | w36d3 | — |
| 词义不等于部件义之和 | S1-C3 | Words as Symbols | concept | w36d4 | — |
| 解析的四重实用收益 | S1-C3 | Why Analyze Words? | method | w12d7 | — |
| 构词可理想化为逐层加缀 | S1-C3 | How We Make Words | method | w01d3, w02d1, w02d4, w02d7, w04d6, w12d1 | — |
| 两级派生的括号表示与拼写调整 | S1-C3 | New Components from Old | method | w02d1, w02d3, w02d7, w04d6, w08d4 | — |
| 复合词内部关系多种多样 | S1-C3 | Compounding | classification | w07d1, w07d7, w12d1 | — |
| 复合可用词素，希腊用 -o-、拉丁用 -i- | S1-C3 | Compounding | rule | w06d1 | — |
| 复合词书写形式的演化 | S1-C3 | Compounding | history | w07d1 | — |
| 转换以重音作超缀 | S1-C3 | Conversion | rule | w36d5 | — |
| 截短不尊重词素边界 | S1-C3 | Clipping | rule | w07d4, w07d7 | — |
| 混成保留可辨识片段 | S1-C3 | Blending | rule | w07d3, w07d7 | — |
| 混成可产出新词缀 | S1-C3 | Blending | rule | w07d6, w10d6 | — |
| 缩略词、首字母词与首字母缩拼词 | S1-C3 | Initialisms and Acronyms | classification | w06d3, w07d4, w07d7, w11d4 | — |
| 首字母缩拼词可再截短并衍生 | S1-C3 | Initialisms and Acronyms | rule | w36d6 | — |
| 拟声词的古音更贴切 | S1-C3 | Onomatopoeia and Sound Symbolism | concept | w37d1 | — |
| 声音象征比拟声更间接 | S1-C3 | Onomatopoeia and Sound Symbolism | concept | w37d2 | — |
| 类推按既有模式造新词 | S1-C3 | Analogy | rule | w37d3 | — |
| 逆构词由复杂词反推简单词 | S1-C3 | Analogy | rule | w07d5 | — |
| 重新分析与民间词源 | S1-C3 | Analogy | history | w08d6, w09d3, w09d6 | — |
| 逆向首字母词多为事后附会 | S1-C3 | Analogy | concept | w11d4 | — |
| 形态学看功能部件，词源学看历史 | S1-C3 | Morphology or Etymology? | concept | w01d6, w02d5, w09d6, w11d7 | — |
| 冲突时以可概括的现代规则为准 | S1-C3 | Morphology or Etymology? | rule | w37d4 | — |
| 标源语言是为预测词素行为 | S1-C3 | Morphology or Etymology? | method | w37d5 | — |
| 词素、形素与变体的三层关系 | S1-C4 | Allomorphs | concept | w08d1, w08d2, w08d7 | — |
| 判定同词素变体的三条标准 | S1-C4 | Allomorphs | rule | w03d5, w08d1 | — |
| 变体的引用方式与误切分风险 | S1-C4 | Allomorphs | method | w05d6 | — |
| 异形的两大来源：分化与合并 | S1-C4 | Phonology-Based Allomorphy | classification | w17d1 | — |
| 变体是为修补非法读音 | S1-C4 | Phonological Repairs | rule | w03d5 | — |
| 规则消失后交替残留为形态规则 | S1-C4 | Yesterday’s Phonology Is Today’s Allomorphy | rule | w17d2 | — |
| 借入的音系规则只作用于借词层 | S1-C4 | Borrowed Phonology | rule | w03d1 | — |
| 希腊否定前缀 an- 与 a- 的分布 | S1-C4 | Borrowed Phonology | rule | w17d3 | — |
| 拉丁元音弱化的基本机制 | S1-C4 | Borrowed Phonology | rule | w17d4 | — |
| 异干互补：屈折表里混入别的词 | S1-C4 | Suppletion | concept | w17d5 | — |
| 相邻词素可融合为一个 | S1-C4 | Morpheme Merger | rule | w17d6 | — |
| 词根加 t 形成常见变体 | S1-C4 | Allomorphy by Fusion | rule | w05d3 | — |
| 加音变体多不可预测，须随表记 | S1-C4 | Allomorphy by Fusion | concept | w17d7 | — |
| 鼻音中缀插在词根元音之后 | S1-C4 | Nasal Infixation | rule | w18d1 | — |
| 元音交替 e/o/零 | S1-C4 | Ablaut | rule | w18d2 | — |
| 拉丁与法语形式宜作双式词 | S1-C4 | Doublets or Allomorphs? | concept | w18d3 | — |
| 希腊与拉丁同源双式词 | S1-C4 | Doublets or Allomorphs? | classification | w18d4 | — |
| 个别变体只能逐个记 | S1-C4 | Doublets or Allomorphs? | concept | w18d5 | — |
| 元素表须连变体一起记 | S1-C4 | Word elements | method | w18d6 | — |
| 语音由气流受阻方式与位置决定 | S1-C5 | Basics of Sound Production | concept | w23d1 | — |
| 把音分解为区别特征可解释同化 | S1-C5 | Basics of Sound Production | concept | w23d1 | — |
| 肺部气流是所有英语音的来源 | S1-C5 | The Airstream | concept | w23d2 | — |
| 按阻塞方式分为五类辅音 | S1-C5 | Manner of Articulation | classification | w23d3 | — |
| 按发音部位分类辅音 | S1-C5 | Place of Articulation | classification | w23d4 | — |
| 清浊取决于声带是否振动 | S1-C5 | Phonation | concept | w23d5 | — |
| 送气与气声在英语不区别词义 | S1-C5 | Phonation | concept | w23d6 | — |
| 三元特征可唯一确定辅音 | S1-C5 | Phonation | method | w23d5 | — |
| 元音按舌位高低前后与松紧描写 | S1-C5 | Vowels | classification | w23d6 | — |
| 双元音与方言差异 | S1-C5 | Vowels | concept | w23d7 | — |
| schwa 是唯一的中央元音 | S1-C5 | Vowels | concept | w23d7 | — |
| 规则异形与需硬记的异形之分 | S1-C6 | Regular Allomorphy in General | concept | w08d2 | — |
| 按拉丁音值而非英语音值应用规则 | S1-C6 | Latin Letters and Sounds | rule | w19d1 | — |
| 希腊词素经罗马化转写 | S1-C6 | Latin Letters and Sounds | concept | w09d4 | — |
| 部位同化是右向的 | S1-C6 | Assimilation | rule | w03d5, w05d2, w08d1, w08d7 | — |
| 完全同化与部分同化 | S1-C6 | Assimilation | classification | w08d1, w08d7 | — |
| 清浊同化及前缀例外 | S1-C6 | Assimilation | rule | w19d2 | — |
| 流音同化与 d 的全同化 | S1-C6 | Assimilation | rule | w19d3 | — |
| 元音删除及其与拼写规则之别 | S1-C6 | Deletion | rule | w19d4 | — |
| s 删除与辅音丛简化 | S1-C6 | Deletion | rule | w19d5 | — |
| 希腊词末塞音失落 | S1-C6 | Deletion | rule | w19d6 | — |
| 前缀在元音前插入 d | S1-C6 | Insertion | rule | w20d1 | — |
| 无音理动机的插入 | S1-C6 | Insertion | rule | w20d1 | — |
| 元音间 s 变 r | S1-C6 | Rhotacism | rule | w20d2 | — |
| 拉丁元音弱化的细则 | S1-C6 | Vowel Changes | rule | w20d3 | — |
| 元音着色：辅音改变元音音质 | S1-C6 | Vowel Changes | rule | w20d4 | — |
| 词根末 s/ss 常是拉丁分词词干（mit→miss、ced→cess） | S1-C6 | Other Consonant Changes | history | w05d6 | — |
| 数词素倾向同语源搭配 | S1-C6 | Numeral Morphemes: Distinguishing between Latin and Greek Morphemes | rule | w20d5 | — |
| 从拼写判断希腊或拉丁来源 | S1-C6 | Numeral Morphemes: Distinguishing between Latin and Greek Morphemes | method | w09d4 | — |
| 数词素可独立作词根，故非纯粹前缀 | S1-C6 | Numeral Morphemes: Distinguishing between Latin and Greek Morphemes | classification | w20d6 | — |
| 拉丁与希腊数词对照 | S1-C6 | Numeral Morphemes: Distinguishing between Latin and Greek Morphemes | classification | w20d5 | — |
| 序数词与分配数词 | S1-C6 | Numeral Morphemes: Distinguishing between Latin and Greek Morphemes | classification | w20d6 | — |
| 大数命名：-illion 与 SI 前缀 | S1-C6 | Numeral Morphemes: Distinguishing between Latin and Greek Morphemes | history | w20d7 | — |
| 本章规则需整体掌握并用于解析 | S1-C6 | Rules from This Chapter | method | w20d7 | — |
| 多义性与形式变化同等重要 | S1-C7 | Meaning Shifts | concept | w10d1 | — |
| 专门化与泛化可以双向发生 | S1-C7 | Meaning Shifts | concept | w10d4 | — |
| 后缀也有初级多义 | S1-C7 | Meaning Shifts | rule | w21d1 | — |
| 前缀与词根的多义更普遍 | S1-C7 | Meaning Shifts | concept | w21d1 | — |
| 后缀 -ate 的词性与读音对应 | S1-C7 | Meaning Shifts | rule | w21d2 | — |
| 多义与同形异义的分界 | S1-C7 | Polysemy versus homonymy | classification | w05d2, w09d6, w10d1 | — |
| 判定靠可追溯的语义链 | S1-C7 | Polysemy versus homonymy | method | w10d1 | — |
| 书中的编排约定 | S1-C7 | Polysemy versus homonymy | rule | w21d2 | — |
| 用熟悉的词验证语素义 | S1-C7 | Polysemy versus homonymy | method | w21d3 | — |
| 语义变化的四类动因 | S1-C7 | Reasons for Semantic Change | classification | w21d4 | — |
| 误解与重新解释造成转义 | S1-C7 | Errors and Misinterpretation | concept | w21d5 | — |
| 求新求异驱动词义扩展 | S1-C7 | Creative Variation | concept | w21d6 | — |
| 省略使词义转移到截短形式 | S1-C7 | Abbreviation | rule | w22d1 | — |
| 词汇量有限是意义增殖的根源 | S1-C7 | The Finite Word Stock | concept | w22d2 | — |
| 新义沿路径从旧义长出且旧义常保留 | S1-C7 | Paths in the Development of Meaning | concept | w10d1, w10d6 | — |
| 原义可能彻底消失 | S1-C7 | Paths in the Development of Meaning | concept | w22d3 | — |
| 语境用于消解多义 | S1-C7 | Paths in the Development of Meaning | method | w10d6, w11d3 | — |
| 联想的两大类：相似与相关 | S1-C7 | Categories of Semantic Change | classification | w10d2 | — |
| 隐喻基于相似 | S1-C7 | Metaphor | concept | w10d2, w10d7, w11d1, w12d3 | — |
| 由具体到抽象的迁移 | S1-C7 | Metaphor | concept | w10d2 | — |
| 空间前缀的隐喻扩展 | S1-C7 | Metaphor | rule | w03d2 | — |
| literally 的语义磨损 | S1-C7 | Metaphor | history | w22d4 | — |
| 转喻基于邻接而非相似 | S1-C7 | Metonymy | concept | w10d3, w10d7 | — |
| 提喻并入转喻 | S1-C7 | Metonymy | classification | w10d3 | — |
| 判别标准：相似还是相关 | S1-C7 | Metaphor versus metonymy | method | w10d3 | — |
| 两种机制常叠加成链 | S1-C7 | Metaphor versus metonymy | concept | w22d5 | — |
| 缩小（专门化）与扩大（泛化） | S1-C7 | Outcomes of Semantic Shift | classification | w10d4, w10d7 | — |
| 义项替代 | S1-C7 | Outcomes of Semantic Shift | concept | w22d6 | — |
| 褒化与贬化 | S1-C7 | Outcomes of Semantic Shift | classification | w10d5, w10d7 | — |
| 委婉语与贬化的循环 | S1-C7 | Outcomes of Semantic Shift | concept | w22d6 | — |
| 变化作用于整词而非语素 | S1-C7 | Outcomes of Semantic Shift | rule | w22d6 | — |
| 英语是变体的集合而非单一语言 | S1-C8 | Many Englishes | concept | w24d1 | — |
| 语域与专业词汇的分工 | S1-C8 | Many Englishes | concept | w12d5 | — |
| 新词来源分散于各社会阶层 | S1-C8 | Many Englishes | concept | w24d1 | — |
| 变异不止于词汇层面 | S1-C8 | Many Englishes | concept | w24d2 | — |
| 内外动因共同制造分歧 | S1-C8 | Roots of Variation and Change | history | w24d3 | — |
| 统一是罕见的例外 | S1-C8 | Roots of Variation and Change | history | w24d3 | — |
| 变体的竞争与淘汰 | S1-C8 | Roots of Variation and Change | history | w24d4 | — |
| 并存的变体可以分工 | S1-C8 | Roots of Variation and Change | concept | w24d5 | — |
| 变体积淀即成新语言 | S1-C8 | Roots of Variation and Change | history | w24d6 | — |
| 英语从未真正统一 | S1-C8 | Seeds of Dialectal Division | history | w24d7 | — |
| 海外变体各自演变 | S1-C8 | Seeds of Dialectal Division | history | w24d7 | — |
| 新英语与通用语 | S1-C8 | Seeds of Dialectal Division | classification | w24d7 | — |
| 世界语言身份埋下分裂种子 | S1-C8 | Seeds of Dialectal Division | concept | w24d7 | — |
| 标准语是权威确立的规范 | S1-C8 | Where Do Standards Come From? | concept | w25d1 | — |
| 人人都掌握多种标准 | S1-C8 | Where Do Standards Come From? | concept | w25d1 | — |
| 标准的三种来源 | S1-C8 | Where Do Standards Come From? | history | w25d2 | — |
| 政府与语言学院介入规范 | S1-C8 | Where Do Standards Come From? | history | w25d3 | — |
| 印刷术与互联网两次定形 | S1-C8 | Where Do Standards Come From? | history | w25d3 | — |
| 口语先习得，书面标准后学 | S1-C8 | Speaking versus Writing | concept | w25d4 | — |
| 韦伯斯特式拼写改革的成败 | S1-C8 | Speaking versus Writing | history | w25d4 | — |
| 英语拼写的不规则性 | S1-C8 | Speaking versus Writing | rule | w25d5 | — |
| 标准本身也在变 | S1-C8 | Changing Standards | concept | w25d5 | — |
| 非标准不等于无效 | S1-C8 | Changing Standards | concept | w25d5 | — |
| 拉丁曾长期充当超地域标准 | S1-C8 | Where the Standard Fails | history | w26d1 | — |
| 方言在特定场合更适用 | S1-C8 | Where the Standard Fails | concept | w26d1 | — |
| 纯洁主义的自相矛盾 | S1-C8 | Can Our Tung Be Cleane and Pure? | history | w26d2 | — |
| 名家与政府的语言规训 | S1-C8 | Can Our Tung Be Cleane and Pure? | history | w26d3 | — |
| 语言管控为何屡屡失败 | S1-C8 | Can Our Tung Be Cleane and Pure? | rule | w07d5 | — |
| 清晰与逻辑不构成反对理由 | S1-C8 | Can Our Tung Be Cleane and Pure? | rule | w26d3 | — |
| 规定主义的问题在绝对化 | S1-C8 | Correctness Is Relative | concept | w26d4 | — |
| 以交际效果评判用法 | S1-C8 | Correctness Is Relative | method | w26d4 | — |
| 掌握标准不必贬低方言 | S1-C8 | Correctness Is Relative | concept | w26d5 | — |
| 术语是群体的通行证 | S1-C8 | Word Choice and Clarity | concept | w26d5 | — |
| 术语既可澄清也可遮蔽 | S1-C8 | Word Choice and Clarity | classification | w26d6 | — |
| 简明语言运动与立法 | S1-C8 | Word Choice and Clarity | history | w26d6 | — |
| 书面语更依赖选词 | S1-C8 | Word Choice and Clarity | concept | w26d6 | — |
| 屈折、词干与拉丁名词的格 | S1-C9 | Noun Inflection | rule | w13d1 | — |
| 复数配对规则与例外 | S1-C9 | Noun Inflection | classification | w09d3, w13d2 | — |
| 双复数与意义分化 | S1-C9 | Noun Inflection | concept | w13d3 | — |
| s 与 es 型的拼写、音变复原 | S1-C9 | Noun Inflection | rule | w13d4 | — |
| 复数形式提供构词词干 | S1-C9 | Noun Inflection | method | w13d4 | — |
| 过度类推与假拉丁词 | S1-C9 | Noun Inflection | rule | w13d5 | — |
| 派生即词根加后缀构干 | S1-C9 | Derivation | concept | w13d5 | — |
| 单音节词根可直接成词 | S1-C9 | Derivation | concept | w13d6 | — |
| 拉丁名词后缀（一） | S1-C9 | Nouns | classification | w13d6 | — |
| 拉丁名词后缀（二） | S1-C9 | Nouns | rule | w13d7 | — |
| 希腊名词后缀 | S1-C9 | Nouns | classification | w14d1 | — |
| 后缀的语义值 | S1-C9 | Nouns | rule | w14d1 | — |
| 形容词后缀表 | S1-C9 | Adjectives | classification | w14d2 | — |
| 借入时丢弃屈折词尾 | S1-C9 | Adjectives | rule | w14d3 | — |
| 比较级与「易被…」 | S1-C9 | Adjectives | rule | w14d3 | — |
| 动词词干与连接元音 | S1-C9 | Verbs | concept | w14d4 | — |
| -sc-、-ta- 与鼻音中缀 | S1-C9 | Verbs | rule | w14d4 | — |
| 现在分词与抽象名词 | S1-C9 | Verbs | rule | w14d5 | — |
| 完成分词及其音变 | S1-C9 | Verbs | rule | w14d6 | — |
| 动形词与 -um/-a 名词化 | S1-C9 | Verbs | rule | w14d7 | — |
| 分化是语言变化的常态结果 | S1-C10 | The discovery of the Deeper Linguistic Past of English and Related Languages | concept | w27d1 | — |
| 十八世纪的两项谱系发现 | S1-C10 | The discovery of the Deeper Linguistic Past of English and Related Languages | history | w27d1 | — |
| 同源词的三语对应 | S1-C10 | The discovery of the Deeper Linguistic Past of English and Related Languages | classification | w27d2 | — |
| 印欧语系的命名与范围 | S1-C10 | The discovery of the Deeper Linguistic Past of English and Related Languages | history | w27d2 | — |
| 十三个分支，八个仍有活语言 | S1-C10 | The Indo-European Languages | classification | w27d3 | — |
| 只有文献没有后裔的分支 | S1-C10 | The Indo-European Languages | history | w27d3 | — |
| 格里姆定律与拉斯克 | S1-C10 | From Proto-Indo-European to Germanic | rule | w27d4 | — |
| 规律对应比表面相似更可靠 | S1-C10 | From Proto-Indo-European to Germanic | method | w27d4 | — |
| 重构与星号约定 | S1-C10 | From Proto-Indo-European to Germanic | method | w27d5 | — |
| 链移解释三组齿音的去向 | S1-C10 | From Proto-Indo-European to Germanic | rule | w27d5 | — |
| 祖语研究的三个层面 | S1-C10 | The Nature of Proto-Indo-European | method | w28d1 | — |
| 辅音系统的三系列塞音 | S1-C10 | Sounds | classification | w28d1 | — |
| 三个喉音及其不确定读音 | S1-C10 | Sounds | concept | w28d2 | — |
| 五元音与成音节辅音 | S1-C10 | Sounds | concept | w28d2 | — |
| 喉音着色与喉音加长 | S1-C10 | Sounds | rule | w28d3 | — |
| 高度屈折：八格与单双复 | S1-C10 | Grammar | concept | w28d4 | — |
| 形容词的格数性一致 | S1-C10 | Grammar | rule | w28d4 | — |
| 第 4 章不规则变体的祖语来源 | S1-C10 | Grammar | concept | w28d5 | — |
| 以共享词汇做语言考古 | S1-C10 | The Indo-European World | method | w29d1 | — |
| 由动植物词推定温带林地 | S1-C10 | The Indo-European World | history | w29d1 | — |
| 金属、船、农业与轮轴 | S1-C10 | The Indo-European World | history | w29d2 | — |
| 父权家宅与神名 | S1-C10 | The Indo-European World | history | w29d2 | — |
| 库尔干假说与战车优势 | S1-C10 | The Indo-European World | history | w29d3 | — |
| 各支独立变化，拉丁希腊最关键 | S1-C10 | Changes Leading to Latin and Greek | concept | w29d3 | — |
| 希腊的元音变化 | S1-C10 | Greek | rule | w29d4 | — |
| 塞音：送气与唇化 | S1-C10 | Greek | rule | w29d4 | — |
| s、w 与喉音的去向 | S1-C10 | Greek | rule | w30d1 | — |
| 成音节辅音加 a | S1-C10 | Greek | rule | w30d1 | — |
| 拉丁的招牌音变 | S1-C10 | Latin | rule | w30d2 | — |
| 首音节保守，后音节弱化 | S1-C10 | Latin | rule | w30d2 | — |
| 送气音变 f，*gʷ 变 w | S1-C10 | Latin | rule | w30d3 | — |
| 喉音只变 a，成音节辅音加元音 | S1-C10 | Latin | rule | w30d3 | — |
| 六千年间稳定多于变化 | S1-C10 | Application to Word Study | method | w30d4 | — |
| 由对应推测英语同源词 | S1-C10 | Application to Word Study | method | w30d4 | — |
| 延伸阅读与工具书 | S1-C10 | Further Reading | method | w30d4 | — |
| 学术借词的定义 | S1-C11 | Learned Borrowings | concept | w15d1 | — |
| 借词变化的四个方面 | S1-C11 | Learned Borrowings | classification | w15d1 | — |
| 借词语义常被收窄或重造 | S1-C11 | Semantics | concept | w15d2 | — |
| 拼写是最保守的一环 | S1-C11 | Spelling | concept | w15d3 | — |
| 现代新增的字形区分 | S1-C11 | Spelling | history | w15d3 | — |
| ae、oe 与 e 的合并 | S1-C11 | Spelling | rule | w15d3 | — |
| 拉丁读音传统远离古罗马 | S1-C11 | Pronunciation | history | w15d4 | — |
| 软腭软化：c、g 的前化 | S1-C11 | Pronunciation | rule | w15d4 | — |
| 英语经由法国学者习得拉丁音 | S1-C11 | Pronunciation | history | w15d5 | — |
| 大元音推移改写拉丁元音 | S1-C11 | Pronunciation | rule | w15d5 | — |
| 近年反向的「复原」读音 | S1-C11 | Pronunciation | concept | w15d6 | — |
| 整词借入者保留原词尾 | S1-C11 | Endings | concept | w15d6 | — |
| 更常见的做法是削去词尾 | S1-C11 | Endings | rule | w16d1 | — |
| 法语的重音后音节脱落 | S1-C11 | Endings | rule | w16d1 | — |
| 词干加静音 e 的常态 | S1-C11 | Endings | rule | w16d2 | — |
| 法语化的词尾调整 | S1-C11 | Endings | rule | w16d2 | — |
| 复原过头：scissors 的误判 | S1-C11 | Endings | history | w16d3 | — |
| 民间法语词形已面目全非 | S1-C11 | Borrowings from Popular French | concept | w16d3 | — |
| 通俗拉丁语与未入文学传统的词 | S1-C11 | Borrowings from Popular French | concept | w16d4 | — |
| 不重拼的另一个原因 | S1-C11 | Borrowings from Popular French | rule | w16d4 | — |
| 法语只保词首与重读元音 | S1-C11 | Deletions | rule | w16d5 | — |
| 软腭音前移为舌冠音 | S1-C11 | Coronalizations | rule | w16d5 | — |
| 单元音变二合元音 | S1-C11 | Diphthongizations | rule | w16d5 | — |
