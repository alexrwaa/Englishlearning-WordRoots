# WordRoots 前端开发契约（v1）

所有页面子智能体必须遵守。目标：多个智能体并行写不同文件，合并时零冲突、视觉一致。

## 1. 技术栈与约束

- React 18 + TypeScript（strict）+ Vite；路由用 `HashRouter`（`src/App.tsx` 已配置）。
- **不要新增依赖**。没有图表库：折线图/柱状图用内联 SVG 手写。
- 样式：使用 `src/styles/global.css` 中已有的类与 CSS 变量；不要引入 Tailwind/CSS-in-JS。
  需要新样式时，只在你自己的组件里用内联 `style`，且颜色必须来自变量
  （`var(--accent)`、`var(--ink)`、`var(--line)` …），不得硬编码 `#fff`/`#333`。
- 不写 `any`；不吞异常；不写 `console.log`。
- 每个页面必须有：加载态（`ready` 为 false 时由外壳处理）、**空状态**、错误兜底。
- 文案：界面中文；英语词条用 `className="word"`（衬线斜体）。

## 2. 共享 API（只读使用，不要修改）

### 2.1 `src/lib/store.tsx`

```ts
const {
  ready, error, info,            // info: { dataDir, dbPath, version, portable, ... }
  settings, updateSettings,      // Settings: dailyMinutes, newCardsPerDay, targetRetention, theme, fontScale, explanationMode, showEtymologyByDefault
  states,                        // Record<lessonId, LessonState>
  cards,                         // Record<cardId, MemoryCard>，cardId = `concept:${refId}` | `inference:${refId}`
  notes, bookmarks,              // Note[], Bookmark[]
  stats,                         // { totals, daily, kinds, streak, morphemesMastered, rulesMastered, inferenceAccuracy, reviewCompletion }
  plan,                          // DailyPlan: { lesson?, reviewCards[], deferredCount, minutes, newCards, restDay }
  completedLessons,              // Set<string>
  refresh, saveLessonState, recordAttempt, gradeRef,
  addNote, deleteNote, toggleBookmark, backupNow, runExport,
  toast, toasts,
} = useApp();
```

- `recordAttempt({ lessonId, exercise, correct, durationMs, usedHint, phase, answer })`
  会自动写 attempt 日志、更新 FSRS 卡片、刷新统计。**页面不要自己算 FSRS。**
- `saveLessonState(state)` 持久化进度（`cursor` 用于断点续学）。
- 复习阶段（`phase: 'review'`）没有 `Exercise` 对象时，用 `gradeRef(refId, correct, { phase: 'review' })`。

### 2.2 `src/lib/content.ts`

```ts
curriculum, lessons, weekOf(n), getLesson(id), getWord(w), getMorpheme(form),
getConcept(id), labelFor(ref), allMorphemes(), allWords(), allConcepts(),
nextLesson(completed), lessonIndex(l)
```

### 2.3 `src/lib/morph.ts`

```ts
buildWord(prefix, base, suffix) // { word, steps[], attested, entry?, plausible }
applySuffix(base, suffix)       // { text, steps[] }
checkWordSum(parts, target)     // { ok, produced, steps[] }
explainSum(parts, result)       // SpellingStep[]（用于展示拼写变化过程）
parseWordSum(input)             // "un + help" -> ["un","help"]
```

### 2.4 `src/lib/answer.ts`

```ts
checkExercise(exercise, response) // response: {kind:'choice',index} | {kind:'text',value}
expectedAnswer(exercise)
```

### 2.5 `src/components/ui.tsx`（只读复用）

`Button`(variant: default|primary|ghost, size: sm|md|lg, block)、`Panel`(flat?)、`Badge`(tone:
default|accent|amber|green|red)、`Bar`、`Ring`、`Field`、`Toggle`、`Modal`、`EmptyState`、`Stat`、`SectionHead`。

### 2.6 `src/components/RichText.tsx`

`<RichText text={card.body} onMorpheme={(m, form) => ...} />` 负责渲染课程正文的轻量标记。

## 3. 文件所有权（只改自己名下的文件）

| 归属 | 文件 |
|---|---|
| 主智能体 | `src/lib/**`、`src/App.tsx`、`src/components/ui.tsx`、`src/components/RichText.tsx`、`src/styles/global.css`、`scripts/**`、`.github/**`、`package.json` |
| 页面 A（学习流） | `src/pages/Home.tsx`、`src/pages/Session.tsx`、`src/components/session/**` |
| 页面 B（课程与实验室） | `src/pages/Course.tsx`、`src/pages/MatrixLab.tsx`、`src/components/matrix/**` |
| 页面 C（词源与知识库） | `src/pages/WordLab.tsx`、`src/pages/Library.tsx`、`src/components/word/**` |
| 页面 D（统计与设置） | `src/pages/Stats.tsx`、`src/pages/SettingsPage.tsx`、`src/components/stats/**` |
| 内容 | `src/content/weeks/*.json`、`src/content/lexicon/morphemes.json`、`words.json` |

新建组件一律放在自己目录下。**禁止**修改他人文件，禁止改 `src/lib/types.ts`。

## 4. 页面规格

### `/` 今日学习（Home.tsx）
- 顶部：问候 + 连续天数 + 今日进度环（`Ring`）+ 预计时长。
- 主卡片：今日课程（`plan.lesson` 的 week/day/title/tagline/objectives 前两条）→ “开始今天的学习”按钮跳 `/session/:id`。
  若该课 `states[id].status === 'in_progress'` → 按钮文案“继续学习”，显示 `cursor` 进度。
- 复习卡片：`plan.reviewCards.length` 与 `plan.deferredCount`；无任务时给空状态。
- 若 `restDay`：显示“今天没有新任务”，可浏览课程。
- 周计划条：7 个圆点显示本周 7 课完成情况（周次取 `plan.lesson.week`，无则取第一个未完成课的周）。
- 快速入口：构词实验室 / 词源词典。
- 数据全部来自 store 与 content，不得造假数据。

### `/session/:lessonId` 每日学习（Session.tsx）
四阶段流水线，阶段可回退但不能跳步：
1. **复习**（`plan.reviewCards` 对应概念，用 `getMorpheme/getConcept` 生成简答题：给词素问含义 / 给含义写词素）；
   无复习卡则跳过。用 `gradeRef(refId, correct, { phase:'review' })`。
2. **学习**：逐张渲染 `lesson.cards`（7 种 kind 都要支持）。`matrix` 卡用可点击词素展示词族；
   `sum` 卡展示构词算式与拼写变化（`explainSum`）；`passage` 卡展示英文片段与可选中文对照。
   每张卡记录阅读时间。
3. **练习**：`lesson.practice` 逐题作答，用 `checkExercise` 判定，展示 `explain`。
   答错允许重试一次，但只有**首次**结果计入 `recordAttempt` 的 `correct`。
4. **应用**：`lesson.apply`（infer），展示 `strategy` 提示（可折叠），提交后展示推理路径。
5. **小结**：正确率、用时、本次新学词素、下次复习时间（取 `cards` 中对应卡片 `due`），
   写 `saveLessonState({status:'completed', score, elapsedMs, cursor})`。
- 顶部进度条（4 段 + 当前段内进度）；`cursor` 持久化，刷新后回到上次位置。
- 键盘：`1-4` 选项、`Enter` 提交、`←/→` 卡片翻页（有输入框聚焦时不拦截）。
- 离开页面时保存 `status:'in_progress'` 与 `cursor`。

### `/course` 12 周课程（Course.tsx）
- 12 周卡片网格（或用 `Week` 折叠列表）：主题、完成度 `n/7`、`Bar`。
- 点击展开 7 天列表：标题、状态（完成/进行中/未开始）、预计分钟、先修提示（未完成先修时给警示 badge）。
- 顶部：总进度、已掌握词素数、当前周定位。
- 支持 `?week=3` 锚点展开。

### `/matrix` 构词实验室（MatrixLab.tsx）
- 左侧：选择词基（`allWords()` 中 `parts.length >= 2` 的词，按词族聚合；或输入框搜索）。
- 中间：矩阵网格 —— 行=前缀（含“—无—”），列=后缀（含“—无—”）。单元格由
  `buildWord(prefix, base, suffix)` 计算，仅当 `attested` 时显示真实单词与释义；未 attest 显示虚线占位。
  点击已 attest 的格子 → 右侧详情（构词算式、拼写变化步骤、词性、释义、来源）。
- 右侧：当前组合的 word sum 视图 + `steps` 拼写规则说明 + “加入练习”按钮（把该词加入本地练习队列，存 localStorage 可，key `wordroots.matrix.practice`）。
- 顶部筛选：只看已 attest / 只看含某后缀 / 按词性。
- 说明条：解释“为什么某些格子是空的”——形态合法不等于词汇存在。

### `/word` 与 `/word/:word` 词源词典（WordLab.tsx）
- 无参数时：搜索框 + 全部词条列表（按首字母分组），支持按词根/领域筛选。
- 有参数时：词条详情 —— 现代释义、词素拆分（可点击跳到对应词素）、词源时间线（`ety.from`/`firstAttested`/`note` 有则显示）、
  同族词（共享任一 `parts` 的词）、相关概念、来源、笔记（`addNote('word', w, body)`）、收藏（`toggleBookmark`）。
- 必须能正确处理 `token`、`gate`、`network`、`model`、`hydrogen`、`localization` 这类“现代义 ≠ 古代词根直拼”的词：
  词条若 `ety.note` 存在则显著展示，不要伪造词源。
- 找不到词时给空状态 + 建议相近词（编辑距离 ≤ 2）。

### `/library` 知识库（Library.tsx）
- 三个分页：词素、词条、笔记与收藏。
- 搜索（词形/中文/英文释义模糊匹配），筛选（已学/未学：`cards['concept:'+refId]` 是否存在）。
- 每条可展开：释义、例词、来源、我的笔记（可编辑）、收藏按钮。
- 空状态引导去学习。

### `/stats` 学习统计（Stats.tsx）
- 顶部四个 `Stat`：连续天数、总时长（分钟）、完成课程、已掌握词素。
- 近 30 天学习时长折线图（内联 SVG，横轴日期、纵轴分钟）；近 14 天复习量柱状图。
- 能力分栏：记忆（`stats.morphemesMastered`/`rulesMastered`）与迁移（`stats.inferenceAccuracy`）**必须分开呈现并解释区别**。
- 错误类型分布（`stats.kinds`，按题型显示正确率）。
- 薄弱知识：`cards` 中 `lapses >= 2` 排序，取前 8，显示 `labelFor(refId)` 与失误次数。
- 无数据时提示“完成第一课后这里会有数据”，不得展示假数据。

### `/settings` 设置与数据（SettingsPage.tsx）
- 学习：每日时长（15–45 滑块/选项）、每日新卡上限、目标记忆保持率（0.8–0.95）。
- 阅读：主题（light/sepia/dark）、字号（0.9–1.2）、解释语言模式（zh/bi/en）、默认展开词源。
- 数据：显示 `info.dataDir`/`dbPath`/`version`/`portable`；“立即备份”“导出学习数据”“打开数据文件夹”；
  数据库健康检查（`db.health()` 需通过 `src/lib/api.ts` 的 `db` 对象，可在页面 import `db` from '../lib/api'）。
- 便携说明：解释 data/ 随文件夹迁移、备份位置、升级流程。
- 危险区：无（不要提供清空数据按钮）。

## 5. 完成标准（自检）

```bash
npx tsc -b          # 必须 0 error
npx eslint src/pages src/components   # 0 error
npm run build       # 必须成功
```

提交前确认：没有 `STUB` 标记、没有 `console.log`、没有硬编码颜色、所有按钮都有真实行为
（跳转或写库），没有“敬请期待”。
