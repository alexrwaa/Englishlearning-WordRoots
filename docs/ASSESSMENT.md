# 学习效果测评（可选模块）

> 这是一个**测评工具**，不是学习效果实验。分数变化不等于教学有效。

## 1. 它解决什么问题

课程本身能记录“学完了没有”，但不能回答“学到的构词能力能不能用在没见过的词上”。
本模块提供一套独立于课程的题池，用五个维度分别计分：

| 维度 | key | 问什么 | 题量 |
| --- | --- | --- | --- |
| 已学词素记忆 | `recall` | 课程里出现过的词素，核心义是否记得 | 12 |
| 词素边界判断 | `boundary` | 陌生词的切分是否落在真正的词素边界 | 12 |
| 词源与现代构词 | `etymology` | 能否区分历史词源、民间词源与现代可分析结构 | 12 |
| 陌生词推理 | `transfer` | 能否用已知词素推断未见词的意思 | 12 |
| 语境修正词义 | `repair` | 按词素猜错时，能否据上下文改回正确词义 | 12 |

合计 **60 题**，每个维度 **12 题**，每个难度档（1/2/3）各 **4 题**。
正确项位置均匀分布：A/B/C/D 各 15 题。

## 2. 与“自动化软件测试”的区别

| | 自动化软件测试 | 本测评 |
| --- | --- | --- |
| 文件 | `src/lib/assessment.test.ts` 等 `*.test.ts` | `src/pages/Assessment.tsx` + `items.json` |
| 被测对象 | 代码行为 | 人的作答 |
| 结果 | 确定：通过 / 失败 | 不确定：0–100 的分数 + 置信说明 |
| 能证明什么 | 计分公式、边界防护、题库结构正确 | 只描述“这一套题上的表现” |
| 不能证明什么 | —— | 课程是否有效、学习者整体水平 |

`npx vitest run src/lib/assessment.test.ts` 通过，只说明**测评工具本身没坏**，不说明任何教学效果。
页面上也直接写了这句话，避免把两者混为一谈。

## 3. 题库与课程隔离

要求：`items.json` 中带 `word` 字段的词，不得出现在 `src/content/weeks/**` 的任何文本里。

实现方式（测试中自动执行）：

```ts
// src/lib/assessment.test.ts
const courseText = readAllLessonText('src/content/weeks').toLowerCase();
const collisions = bank
  .filter((item) => item.word)
  .filter((item) => courseText.includes(item.word!.toLowerCase()));
expect(collisions).toEqual([]);
```

要点：

- 递归读取 39 周共 282 个 JSON 文件，**拼接全部文本**后做子串匹配；
- 用子串而不是整词匹配，因此课程里出现 `episodes`、`subscription` 也会被判为冲突（实际开发中就因此替换了 `episode` 与 `subscript`）；
- `recall` 维度不带 `word` 字段：它考的就是课程已教词素（如 `duc`、`fer`、`circum`），这是设计意图；
- 其余四个维度共 48 个不同的词，全部不在课程文本中。

手工复核：

```bash
node -e "
const fs=require('fs'),path=require('path');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
let t='';for(const f of walk('src/content/weeks')) t+=fs.readFileSync(f,'utf8');
t=t.toLowerCase();
const j=JSON.parse(fs.readFileSync('src/content/assessment/items.json','utf8'));
console.log(j.items.filter(i=>i.word&&t.includes(i.word.toLowerCase())).map(i=>i.word));
"
```

## 4. 题库格式

```json
{
  "version": 1,
  "items": [
    {
      "id": "as-transfer-01",
      "dimension": "transfer",
      "difficulty": 1,
      "word": "antisocial",
      "prompt": "没见过 antisocial 这个词。根据词素，它最可能的意思是？",
      "choices": ["反社会的、不合群的", "非常社交的", "社会之前的", "多社会的"],
      "answer": 0,
      "explain": "anti「反对」+ social「社会的」：反对社会交往的。"
    }
  ]
}
```

校验规则（`inspectItemBank`）：

- `version === 1`；
- `id` 唯一，且前缀必须为 `as-<dimension>-`；
- `difficulty ∈ {1,2,3}`，`dimension` 属于五个维度；
- `choices` 至少 2 项、全为字符串、无重复；
- `answer` 为整数且 `0 ≤ answer < choices.length`（越界即判错，不会误判为对）；
- `explain` 必填；
- 非法项被丢弃并记录 `problems`，不会让整页崩溃；测试断言正式题库的 `problems` 为空。

## 5. 三种测评形式

| 形式 | 每维题量 | 蓝图（难度 → 变体序号） | 用途 |
| --- | --- | --- | --- |
| `baseline` | 3 | 1→0, 2→0, 3→0 | 首次使用，建立个人基线 |
| `checkpoint` | 2 | 1→1, 2→1 | 完成一组课程后的阶段检查 |
| `retest` | 3 | 1→2, 2→2, 3→1 | 延迟复测，与基线**平行** |

`baseline` 与 `retest` 的维度/难度结构完全一致，但题目集合不相交（测试断言）。
因此复测是**平行卷**，不是把同一批题再做一遍；这也意味着两种卷之间仍存在题目难度差异，差值不能当成纯进步。

每套题内部不重复；题目顺序为“难度升序 + 固定维度顺序”。

## 6. 计分

- 每题权重：难度 1 → ×1，难度 2 → ×1.5，难度 3 → ×2；
- 单维得分 = 该维加权正确率 × 100，保留一位小数；
- 总分为全部已出题目的加权正确率，保留一位小数；
- **分母是全部已出题目**，未作答按 0 计，不会被跳过；
- 越界/非整数选项一律记为错误；
- 答题耗时为各题耗时之和（不含页面停留）。

## 7. 置信说明

| 每维已答题数 | 等级 | 文案 |
| --- | --- | --- |
| < 5 | low | 样本过小（每个维度不足 5 题），仅作参考 |
| 5–9 | medium | 样本仍偏小，分数的波动可能大于真实差异 |
| ≥ 10 | high | 样本量可支持同一次测评内的比较，但仍不能推断教学效果 |

整套测评的置信度取**最弱维度**，而不是总题量：15 题平均到 5 个维度后，每维只有 3 题，因此基线/复测都会显示“样本过小”。
这是有意为之，不用总分掩盖单维的不确定性。

## 8. 存储

- 键名：`wordroots.assessment.v1`
- 介质：`localStorage`（浏览器预览与 Tauri WebView 均可用）
- 未走 `src/lib/api.ts`：该层是产品数据库，没有通用 KV 命令；为了不改动数据层与 Rust 端，测评记录单独存放
- 上限：最近 50 次
- 损坏数据、配额不足、存储不可用时都不会抛错，页面退化为“本次可用、历史为空”

数据结构：

```json
{
  "version": 1,
  "runs": [
    {
      "id": "baseline-1763712000000",
      "mode": "baseline",
      "startedAt": 1763712000000,
      "finishedAt": 1763712600000,
      "durationMs": 420000,
      "answers": [{ "itemId": "as-recall-01", "choice": 0, "ms": 12000 }],
      "dimensions": [
        {
          "dimension": "recall",
          "label": "已学词素记忆",
          "score": 66.7,
          "correct": 2,
          "answered": 3,
          "total": 3,
          "weightedCorrect": 3.5,
          "weightedTotal": 4.5,
          "confidence": "low",
          "note": "样本过小（每个维度不足 5 题），仅作参考"
        }
      ],
      "overall": 66.7,
      "overallConfidence": "low",
      "itemCount": 15
    }
  ]
}
```

读取时会做最小结构校验，缺字段的旧记录被忽略；同一 `id` 重存会替换而不是重复。

## 9. 页面上的诚实声明（原文）

> 这是测评工具，不是学习效果实验。分数变化不等于教学有效：没有对照组、没有随机分组，每个维度的题量也很小。要判断教学是否有效，需要对照设计与更大样本。

配套说明：

> 题池中带单词的题目，所用单词都不出现在任何课程里，因此这里测的是迁移，不是对课文例句的记忆。

结果页的对比区还会写：

> 这仍不是教学效果证据：两次题不同、状态不同、样本都很小。

## 10. 已知局限

1. **没有对照组、没有随机分配**，任何分数变化都不能归因于课程。
2. **题量小**：每维 3 题（基线）不足以稳定估计能力，单题失误可造成 20–30 分波动。
3. **平行卷不等值**：`baseline` 与 `retest` 题目不同，难度只是按 1/2/3 粗配，未做等值（equating）。
4. **存在练习与熟悉效应**：同一维度反复测会记住词义，第二次分数可能偏高。
5. **未做项目反应理论/信度分析**：没有区分度、难度参数，也没有 Cronbach's α。
6. **自评偏差**：愿意做可选测评的人，未必代表全部学习者。

因此页面只显示分数与置信说明，**不显示“提升 X%”**，也不生成“教学有效”的结论。

## 11. 接入方式

`src/pages/Assessment.tsx` 默认导出 `Assessment` 组件，自带样式导入：

```tsx
import Assessment from './pages/Assessment';
```

路由与侧边栏入口由主端接入，本模块未修改 `App.tsx` / `store.tsx` / `types.ts` / `content.ts`。

自检命令：

```bash
npx tsc -b
npx eslint src/lib/assessment.ts src/pages/Assessment.tsx src/lib/assessment.test.ts
npx vitest run src/lib/assessment.test.ts
```
