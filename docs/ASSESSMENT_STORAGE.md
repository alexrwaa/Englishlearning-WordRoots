# 测评数据存储与迁移（0.9.0）

## 1. 为什么搬

0.8.0 把测评历史放在 WebView 的 `localStorage` 里，键 `wordroots.assessment.v1`，最多 50 条。
问题有三：

1. **不在备份里**。用户导出备份再恢复，历史消失，而这正是"长期学习数据"。
2. **不在便携包里**。整个文件夹搬走时，WebView 的用户数据目录是否跟着走取决于运行方式，不能保证。
3. **没有版本字段**。题库一换，旧分数就失去解释依据，却仍按同一标准比较。

## 2. 表结构（schema v3）

```sql
CREATE TABLE assessment_runs (
  id               TEXT PRIMARY KEY,
  mode             TEXT NOT NULL,          -- baseline | checkpoint | retest
  item_bank_version INTEGER NOT NULL,      -- 换题后旧分数仍可解释
  started_at       INTEGER NOT NULL,
  finished_at      INTEGER NOT NULL,
  duration_ms      INTEGER NOT NULL,
  payload          TEXT NOT NULL,          -- 完整 RunResult（含 dimensions/answers）
  created_at       INTEGER NOT NULL
);
CREATE INDEX idx_assessment_finished ON assessment_runs(finished_at DESC);
```

`payload` 存整份 `RunResult`，因此计分版本升级不需要改表；需要新维度时读旧 payload 仍能解释。
`item_bank_version` 单独列出来，是为了能按"哪一版题库"分组比较，而不是把不同题库的分数混在一起。

## 3. 迁移步骤（首次升级自动执行）

1. 读 `localStorage['wordroots.assessment.v1']`。
2. 若目标表为空且旧数据存在 → 逐条 `INSERT OR REPLACE`（按 `id` 去重，**幂等**）。
3. 导入后校验：条数与 `id` 集合必须与源一致。
4. 全部通过才写 `wordroots.assessment.migrated.v1 = <ISO 时间>`。
5. **旧数据保留**，不删除——迁移写错时可以回退。

判定"要不要迁移"只看标记与表是否为空，不看时间戳，所以重复运行不会产生重复行，也不会覆盖用户后来新增的记录。

## 4. 损坏与失败

- 单条 `payload` 解析失败：`assessment_list` 跳过并计入 `skipped`，返回 `{runs, skipped}`；
  其它记录照常返回，**应用照常启动**。
- 前端 `isStoredResult` 做同样的过滤，避免坏记录进入计分。
- 迁移失败不写标记，下次启动会重试。

## 5. 备份、恢复与便携

| 路径 | 行为 |
| --- | --- |
| 桌面导出 `export_data` | Rust `snapshot_json` 含 `assessment_run` 表 |
| 桌面导入 `import_data` | 文件含 `assessment_run` 才替换该表；**旧备份没有该字段则不动现有历史** |
| 浏览器预览导出 | `readBackup()` 后追加 `assessments`，`counts.assessments` 仅在非空时出现 |
| 浏览器预览导入 | 走同一条 `parseBackup` 校验，再写 localStorage 镜像 |
| 便携迁移 | 数据在 `data/*.db`，随文件夹移动 |

`BackupCounts.assessments` 是**可选**字段：空库导出的结构仍与 0.8.0 完全一致，
这样旧断言、旧脚本、旧备份校验都不受影响。

## 6. 测试

`src/lib/assessment-store.test.ts`（7 条）＋既有 `assessment.test.ts`（31 条）：

- 迁移幂等：导入两次，条数不变
- 损坏 payload 被跳过且计数正确
- `assessment_clear` 后 `assessment_count = 0`
- `item_bank_version` 往返保持
- 上限（50 条）与同 id 覆盖

## 7. 已知边界

- **未在真机验证 Rust 编译**：本机缺 MSVC/Windows SDK，`cargo check` 无法执行；
  Rust 侧由 CI 的 "Rust backend checks" 作业覆盖（v0.9.0 已通过）。
- 学习效果研究所需的长期跟踪（同一学习者跨月）目前只有数据结构，**没有任何真实样本**。
