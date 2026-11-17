import { useEffect } from 'react';
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './lib/store';
import Home from './pages/Home';
import Session from './pages/Session';
import Course from './pages/Course';
import MatrixLab from './pages/MatrixLab';
import WordLab from './pages/WordLab';
import Library from './pages/Library';
import Stats from './pages/Stats';
import SettingsPage from './pages/SettingsPage';

const nav = [
  { to: '/', label: '今日学习', icon: '◈', end: true },
  { to: '/course', label: '12 周课程', icon: '▤' },
  { to: '/matrix', label: '构词实验室', icon: '⊞' },
  { to: '/word', label: '词源词典', icon: '⌘' },
  { to: '/library', label: '知识库', icon: '❏' },
  { to: '/stats', label: '学习统计', icon: '◔' },
  { to: '/settings', label: '设置与数据', icon: '⚙' },
];

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">W</div>
        <div className="brand-text">
          <strong>WordRoots</strong>
          <span>Morphology Lab</span>
        </div>
      </div>
      {nav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon" aria-hidden>
            {item.icon}
          </span>
          <span className="label">{item.label}</span>
        </NavLink>
      ))}
      <div className="spacer" />
      <div className="tiny faint" style={{ padding: '10px 10px 0', lineHeight: 1.5 }}>
        离线优先 · 数据随文件夹迁移
      </div>
    </aside>
  );
}

function ThemeBridge() {
  const { settings, toasts } = useApp();
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.style.setProperty('--font-scale', String(settings.fontScale));
  }, [settings.theme, settings.fontScale]);

  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className="toast" data-tone={t.tone}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

function ScrollReset() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.querySelector('.main')?.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

function Shell() {
  const { ready, error } = useApp();
  if (!ready) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
        <div className="muted">正在打开学习数据…</div>
      </div>
    );
  }
  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        {error ? (
          <div className="page">
            <div className="panel" style={{ borderColor: 'var(--red)' }}>
              <h3>数据层启动失败</h3>
              <p className="small muted">{error}</p>
              <p className="small">
                应用仍可浏览课程，但学习记录无法保存。请检查 data 目录是否可写，或在备份中恢复数据库。
              </p>
            </div>
          </div>
        ) : null}
        <ScrollReset />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/session/:lessonId" element={<Session />} />
          <Route path="/course" element={<Course />} />
          <Route path="/matrix" element={<MatrixLab />} />
          <Route path="/word" element={<WordLab />} />
          <Route path="/word/:word" element={<WordLab />} />
          <Route path="/library" element={<Library />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <ThemeBridge />
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppProvider>
        <Shell />
      </AppProvider>
    </HashRouter>
  );
}
