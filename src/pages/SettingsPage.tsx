import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { db, IS_TAURI } from '../lib/api';
import { useApp } from '../lib/store';
import type { Settings } from '../lib/types';
import { Badge, Button, Modal, Panel, SectionHead, Toggle } from '../components/ui';

const REPO_URL = 'https://github.com/alexrwaa/Englishlearning-WordRoots';

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="row wrap" role="radiogroup" aria-label={label} style={{ gap: 6 }}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '5px 12px',
              borderRadius: 9,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              border: `1px solid ${active ? 'var(--accent)' : 'var(--line-strong)'}`,
              background: active ? 'var(--accent-soft)' : 'var(--panel)',
              color: active ? 'var(--accent-ink)' : 'var(--ink-soft)',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function SettingRow({
  title,
  hint,
  last,
  children,
}: {
  title: string;
  hint?: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '13px 0',
        borderBottom: last ? 'none' : '1px solid var(--line)',
      }}
    >
      <div style={{ minWidth: 200, flex: '1 1 240px' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
        {hint ? <div className="tiny faint">{hint}</div> : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
      <span className="small faint" style={{ flex: '0 0 92px' }}>
        {label}
      </span>
      <span className="small mono" style={{ wordBreak: 'break-all', minWidth: 0 }}>
        {value}
      </span>
    </div>
  );
}

const MINUTE_OPTIONS: { value: number; label: string }[] = [15, 20, 25, 30, 45].map((m) => ({
  value: m,
  label: `${m} 分钟`,
}));
const NEW_CARD_OPTIONS: { value: number; label: string }[] = [4, 6, 8, 12].map((n) => ({
  value: n,
  label: `${n} 张`,
}));
const RETENTION_OPTIONS: { value: number; label: string }[] = [0.8, 0.85, 0.9, 0.95].map((r) => ({
  value: r,
  label: `${Math.round(r * 100)}%`,
}));
const THEME_OPTIONS: { value: Settings['theme']; label: string }[] = [
  { value: 'light', label: '浅色' },
  { value: 'sepia', label: '纸张' },
  { value: 'dark', label: '深色' },
];
const MODE_OPTIONS: { value: Settings['explanationMode']; label: string }[] = [
  { value: 'zh', label: '中文为主' },
  { value: 'bi', label: '中英对照' },
  { value: 'en', label: '英文为主' },
];

export default function SettingsPage() {
  const { settings, updateSettings, toast, info, backupNow, runExport } = useApp();

  const [health, setHealth] = useState<{ state: string; at: number } | null>(null);
  const [healthBusy, setHealthBusy] = useState(false);
  const [busy, setBusy] = useState<'backup' | 'export' | null>(null);
  const [lastPath, setLastPath] = useState<{ kind: '备份' | '导出'; path: string } | null>(null);
  const [pending, setPending] = useState<{ name: string; text: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const checkHealth = useCallback(async () => {
    setHealthBusy(true);
    try {
      const state = await db.health();
      setHealth({ state, at: Date.now() });
    } catch (err) {
      setHealth({ state: `检查失败：${errText(err)}`, at: Date.now() });
    } finally {
      setHealthBusy(false);
    }
  }, []);

  useEffect(() => {
    void checkHealth();
  }, [checkHealth]);

  /** Discrete controls: persist and confirm. */
  const save = (patch: Partial<Settings>) => {
    updateSettings(patch)
      .then(() => toast('设置已保存', 'success'))
      .catch((err) => toast(`设置保存失败：${errText(err)}`, 'warn'));
  };

  /** Slider: persist on every step but only confirm once the drag ends. */
  const saveLive = (patch: Partial<Settings>) => {
    updateSettings(patch).catch((err) => toast(`设置保存失败：${errText(err)}`, 'warn'));
  };

  const onBackup = async () => {
    setBusy('backup');
    try {
      const path = await backupNow();
      setLastPath({ kind: '备份', path });
      toast(`备份已保存：${path}`, 'success');
    } catch (err) {
      toast(`备份失败：${errText(err)}`, 'warn');
    } finally {
      setBusy(null);
    }
  };

  const onExport = async () => {
    setBusy('export');
    try {
      const path = await runExport();
      setLastPath({ kind: '导出', path });
      toast(`学习数据已导出：${path}`, 'success');
    } catch (err) {
      toast(`导出失败：${errText(err)}`, 'warn');
    } finally {
      setBusy(null);
    }
  };

  const onOpenFolder = async () => {
    if (!IS_TAURI) {
      toast('浏览器预览模式下没有数据文件夹，请在桌面版中打开', 'warn');
      return;
    }
    try {
      await db.openFolder('data');
    } catch (err) {
      toast(`无法打开数据文件夹：${errText(err)}`, 'warn');
    }
  };

  const onPickFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so picking the same file twice still fires a change event.
    event.target.value = '';
    if (!file) return;
    setImportError(null);
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('文件内容不是学习数据的 JSON 对象');
      }
      setPending({ name: file.name, text });
    } catch (err) {
      setImportError(`无法读取该文件：${errText(err)}`);
    }
  };

  const confirmImport = async () => {
    if (!pending) return;
    setImporting(true);
    try {
      await db.importData(pending.text);
      toast('导入完成，正在重新载入…', 'success');
      setPending(null);
      window.setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      setImportError(`导入失败：${errText(err)}`);
      setImporting(false);
      setPending(null);
    }
  };

  const closeImport = () => {
    if (importing) return;
    setPending(null);
  };

  const portableLabel = info?.portable ? '便携模式' : IS_TAURI ? '安装模式' : '浏览器预览';

  return (
    <div className="page fade-in">
      <header className="page-head">
        <div>
          <div className="eyebrow">设置与数据</div>
          <h1>按你的节奏学习</h1>
          <p className="lede">
            所有设置立即生效并写入本机数据库。学习记录保存在程序目录的 data/ 中，随文件夹一起迁移。
          </p>
        </div>
        <Badge tone={info?.portable ? 'accent' : 'default'}>{portableLabel}</Badge>
      </header>

      <SectionHead title="学习节奏" hint="影响今日计划如何分配复习与新内容。" />
      <Panel>
        <SettingRow title="每日学习时长" hint="计划会按这个预算切分复习、学习、练习、应用四段。">
          <Segmented
            label="每日学习时长"
            value={settings.dailyMinutes}
            options={MINUTE_OPTIONS}
            onChange={(dailyMinutes) => save({ dailyMinutes })}
          />
        </SettingRow>
        <SettingRow title="每日新卡上限" hint="新词素最多引入多少张，超出部分顺延到之后几天。">
          <Segmented
            label="每日新卡上限"
            value={settings.newCardsPerDay}
            options={NEW_CARD_OPTIONS}
            onChange={(newCardsPerDay) => save({ newCardsPerDay })}
          />
        </SettingRow>
        <SettingRow title="目标记忆保持率" hint="越高复习越频繁：95% 几乎每天见面，80% 间隔更长但更容易忘。" last>
          <Segmented
            label="目标记忆保持率"
            value={settings.targetRetention}
            options={RETENTION_OPTIONS}
            onChange={(targetRetention) => save({ targetRetention })}
          />
        </SettingRow>
      </Panel>

      <SectionHead title="阅读体验" hint="只影响显示，不改变内容与复习安排。" />
      <Panel>
        <SettingRow title="主题" hint="纸张模式偏暖，适合长时间阅读。">
          <Segmented label="主题" value={settings.theme} options={THEME_OPTIONS} onChange={(theme) => save({ theme })} />
        </SettingRow>
        <SettingRow title="字号" hint={`当前 ${Math.round(settings.fontScale * 100)}%，范围 90%–120%。`}>
          <div className="row" style={{ gap: 10 }}>
            <span className="tiny faint">A</span>
            <input
              type="range"
              min={0.9}
              max={1.2}
              step={0.05}
              value={settings.fontScale}
              aria-label="字号"
              onChange={(e) => saveLive({ fontScale: Number(e.target.value) })}
              onPointerUp={() => toast('设置已保存', 'success')}
              onKeyUp={() => toast('设置已保存', 'success')}
              style={{ width: 180, accentColor: 'var(--accent)' }}
            />
            <span className="small faint">A</span>
            <span className="tiny mono faint" style={{ width: 38, textAlign: 'right' }}>
              {Math.round(settings.fontScale * 100)}%
            </span>
          </div>
        </SettingRow>
        <SettingRow title="解释语言" hint="课程正文与释义的默认语言配比。">
          <Segmented
            label="解释语言"
            value={settings.explanationMode}
            options={MODE_OPTIONS}
            onChange={(explanationMode) => save({ explanationMode })}
          />
        </SettingRow>
        <SettingRow title="默认展开词源" hint="词条详情打开时直接展示词源时间线。" last>
          <div className="row" style={{ gap: 8 }}>
            <span className="tiny faint">{settings.showEtymologyByDefault ? '已展开' : '默认折叠'}</span>
            <Toggle
              on={settings.showEtymologyByDefault}
              label="默认展开词源"
              onChange={(showEtymologyByDefault) => save({ showEtymologyByDefault })}
            />
          </div>
        </SettingRow>
      </Panel>

      <SectionHead title="数据与便携" hint="数据库、备份与迁移都在这一节。" />
      <Panel>
        <InfoRow label="数据目录" value={info?.dataDir ?? '正在读取…'} />
        <InfoRow label="数据库文件" value={info?.dbPath ?? '正在读取…'} />
        <InfoRow label="备份目录" value={info?.backupsDir ?? '正在读取…'} />
        <InfoRow label="版本" value={info ? `${info.version}（schema v${info.schemaVersion}）` : '正在读取…'} />
        <InfoRow label="运行模式" value={portableLabel} />

        <div className="row wrap" style={{ gap: 8, marginTop: 16 }}>
          <Button variant="primary" size="sm" onClick={() => void onBackup()} disabled={busy !== null}>
            {busy === 'backup' ? '正在备份…' : '立即备份'}
          </Button>
          <Button size="sm" onClick={() => void onExport()} disabled={busy !== null}>
            {busy === 'export' ? '正在导出…' : '导出学习数据'}
          </Button>
          <Button size="sm" onClick={() => void onOpenFolder()}>
            打开数据文件夹
          </Button>
        </div>
        {lastPath ? (
          <div className="tiny faint mono" style={{ marginTop: 10, wordBreak: 'break-all' }}>
            最近{lastPath.kind}：{lastPath.path}
          </div>
        ) : null}
        {!IS_TAURI ? (
          <div className="tiny faint" style={{ marginTop: 8 }}>
            当前是浏览器预览，数据存在 localStorage，备份与文件夹操作只在桌面版有效。
          </div>
        ) : null}

        <div className="divider" />

        <div className="row-between wrap" style={{ gap: 10 }}>
          <div style={{ minWidth: 220 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>数据库健康</div>
            <div className="tiny faint">对 SQLite 执行完整性检查；损坏时请先备份再恢复。</div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {health === null ? (
              <Badge>检查中…</Badge>
            ) : health.state === 'ok' ? (
              <Badge tone="green">ok</Badge>
            ) : health.state === 'corrupt' ? (
              <Badge tone="red">corrupt</Badge>
            ) : (
              <Badge tone="amber">{health.state}</Badge>
            )}
            {health ? (
              <span className="tiny faint">
                {new Date(health.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => void checkHealth()} disabled={healthBusy}>
              {healthBusy ? '检查中…' : '刷新'}
            </Button>
          </div>
        </div>

        <div className="divider" />

        <div className="row-between wrap" style={{ gap: 10 }}>
          <div style={{ minWidth: 220 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>导入学习数据</div>
            <div className="tiny faint">选择之前导出的 .json 文件，覆盖当前数据库。</div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => void onPickFile(e)}
            style={{ display: 'none' }}
          />
          <Button size="sm" onClick={() => fileRef.current?.click()}>
            选择 JSON 文件
          </Button>
        </div>
        {importError ? (
          <div className="feedback no" role="alert" style={{ marginTop: 12 }}>
            <div className="title">导入未完成</div>
            <p>{importError}</p>
          </div>
        ) : null}

        <div className="panel-flat" style={{ marginTop: 16 }}>
          <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>
            便携说明
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            data/ 里是你的学习数据库，整个程序文件夹复制到别的磁盘或电脑，记录会一起带走，不写系统用户目录。
            backups/ 存放自动备份（每天一次、保留最近若干份）与手动备份；导出文件也落在该目录。
            升级版本时先点“立即备份”，再用新版程序文件覆盖 exe 与 courses/，<strong>不要</strong>覆盖 data/。
            换机或重装前，导出一份 JSON 作为最后的保险。
          </p>
        </div>
      </Panel>

      <SectionHead title="关于" />
      <Panel>
        <InfoRow label="应用" value="WordRoots · 英语构词学交互学习系统" />
        <InfoRow label="版本" value={info?.version ?? '—'} />
        <InfoRow label="许可证" value="MIT" />
        <InfoRow label="课程来源" value="原创课程内容，编写时参考公开的语言学与词源学资料" />
        <InfoRow label="仓库" value={REPO_URL} />
        <div className="row wrap" style={{ gap: 12, marginTop: 14 }}>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="small">
            在 GitHub 上查看源码
          </a>
          <span className="tiny faint">离线优先，不联网也能完整学习。</span>
        </div>
      </Panel>

      <Modal
        open={pending !== null}
        onClose={closeImport}
        title="导入学习数据"
        footer={
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={closeImport} disabled={importing}>
              取消
            </Button>
            <Button variant="primary" onClick={() => void confirmImport()} disabled={importing}>
              {importing ? '正在导入…' : '确认导入'}
            </Button>
          </div>
        }
      >
        <p className="small">
          将用 <strong>{pending?.name}</strong> 的内容覆盖当前数据库中的学习记录、卡片与笔记。
        </p>
        <p className="small muted" style={{ marginBottom: 0 }}>
          导入前系统会自动创建一份 pre-import 备份，位于 backups/ 目录；导入完成后页面会重新载入。
        </p>
      </Modal>
    </div>
  );
}
