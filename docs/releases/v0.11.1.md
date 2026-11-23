# WordRoots 0.11.1

**这是打包修复版，不动内容。** 0.11.0 的 ZIP 里没有 `courses/textbook`：引用记录与来源注册表只在仓库里有，
拿到 ZIP 的人无法核对一条词源引文。这一版把证据记录打进包，并对它们做数量与结构校验。
上一版见 [`releases/v0.11.0.md`](v0.11.0.md)。

## 改了什么

| 项 | 内容 |
| --- | --- |
| 打包资源 | 新增 `courses/textbook/sources.json` 与 `courses/textbook/reviews.json`，缺失即构建失败 |
| 数量校验 | 审校条目 < 200，或带核验记录的条目 < 10 时构建失败 |
| 哈希 | `courses/CONTENT-HASHES.json` 现在也为 textbook 下每个 JSON 记录 sha256 |

这样一来，只拿到 ZIP 的人也能：

1. 打开 `courses/textbook/reviews.json`，找到某个词素的 `verification`；
2. 看它支持的是哪一类主张（`root-sense` / `borrowing-path` / …）；
3. 按记录里的 URL、词头、行号回到 Wiktionary 或 Lewis & Short 核对原文。

## 没变的

内容、课程、词库、证据数字与 0.11.0 完全一致：1506 词条、1393 verified、partial 87、quizSafe 1046；
213 条审校、18 条带核验、跨来源 14。

## 仍未完成

1. `classical-derivation` 与 `modern-sense` 无证据；`borrowing-path` 仅 2 条单来源。
2. 提示使用次数未记录。
3. S1 仍有 41 条 partial（多为"讲到了但缺专项练习"）。
4. 没有真人学习效果数据。
