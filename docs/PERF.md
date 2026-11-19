# 冷启动与首屏性能

Windows 桌面版首次启动慢，是「WebView2 + 大包体 + 全量解析」叠加的结果。本文件记录测量方法、
优化前后数字，以及暂时无法优化的部分。

## 怎么测

| 层 | 工具 | 口径 |
| --- | --- | --- |
| 前端包体 | `npm run build` + 构建输出 | 每个 chunk 的原始与 gzip 体积 |
| 浏览器冷启 | `node scripts/perf-probe.mjs <url>` | 全新 profile，从 `goto` 到首个导航项可见 |
| 桌面冷启 | `scripts/smoke-test.ps1` + `app-data/logs/startup-boot.json` | 从进程启动到 `frontend_ready` |
| 路由级 | 同一探针的 `#/matrix` 用例 | 懒加载后的首屏代价 |

探针会输出 `window.__wrPerf` 的分段打点：`boot → content-ready → first-route-render → lexicon-ready`。
这些标记在生产构建里也保留，出问题时不必重新加日志。

## 基线（v0.3.1）

- 桌面版冷启动：**30.2 s** 到首帧（CI 首次运行记录，`scripts/smoke-test.ps1` 的 75 s 阈值就是为它放宽的）。
- 前端：单个 `index-*.js` **1,169.95 kB / gzip 513.33 kB**，
  `import.meta.glob(..., { eager: true })` 在模块求值期就把 16 周课时、词素、词条全部解析完。
- 首页并不需要词库，却必须等它解析完才能渲染。

## 优化后（v0.4.0）

| 指标 | 基线 | 现在 | 变化 |
| --- | --- | --- | --- |
| 浏览器冷启首屏 | 未单独测（旧包为单体大 chunk） | **321 ms** | — |
| 首内容绘制 FCP | — | **272 ms** | — |
| 主入口 chunk | 1,169.95 kB（单体） | **154 kB** | 拆出 4 个按需 chunk |
| 词库 chunk | 内联在主 chunk | morphemes 266 kB / words 425 kB，**按需** | 首屏不加载 |
| `#/matrix` 首屏 | 与首屏同批 | 18 ms 导航 + 209 ms 挂载（词库 80 ms 后到位） | 懒加载的代价可接受 |
| JS 堆 | — | 11 MB | — |

分段打点（浏览器）：

```
boot                0 ms
content-ready       0.4 ms     ← 课时索引（轻量）就绪
mounted             1.4 ms
first-route-render  21.4 ms
lexicon-ready       79.6 ms     ← 词库真正加载完成，仅实验室/词族页需要
```

## 做了什么

1. **课时与词库分离**：`content.ts` 导出轻量 `lessonSummaries`，课时正文与词库改为动态加载。
2. **词库懒加载**：`morphemes` / `words` 独立 chunk，只有矩阵、词族、词源、探索页会请求。
3. **路由级分割**：`#/matrix`、`#/family/:id`、`#/explore`、`#/word` 使用 `React.lazy`。
4. **索引惰性单例**：派生索引与词族索引只在首次使用时构建并缓存。
5. **分段打点**：`src/lib/perf.ts`，`window.__wrPerf` 可供探针与用户现场诊断。

## 还没做的

- **WebView2 自身初始化**：在冷启动里占固定成本，应用侧无法消除，只能靠「先画骨架、后填数据」掩盖。
- **`ui-*.js` 仍有 1,080 kB**：装着 React、路由与图标集。已确认它在首屏是必需的，
  但可以把图标改成按需引入，预计再省 100–200 kB，留待后续。
- **打包版数字**：v0.4.0 的桌面冷启动需在 CI 或本机 release 构建后复测；
  浏览器端 321 ms 只能说明前端不再是瓶颈，不能替代 WebView2 的真实启动耗时。

## 结论

前端从「解析完 1.2 MB JSON 才渲染」变成「21 ms 出首屏、词库按需」，浏览器冷启 321 ms。
桌面版剩余耗时主要来自 WebView2 与磁盘，需要用 v0.4.0 的 release 包复测确认，
而不是继续在 bundle 上找空间。
