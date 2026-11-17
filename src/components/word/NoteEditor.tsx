import { useEffect, useState } from 'react';
import { useApp } from '../../lib/store';
import { Button } from '../ui';
import { formatDate } from './tokens';

/**
 * Single-note editor for a target (word / morpheme / concept / lesson).
 * The store keeps one note per target, so "edit" re-saves the same record.
 */
export function NoteEditor({
  targetType,
  targetId,
  label = '我的笔记',
  compact,
}: {
  targetType: string;
  targetId: string;
  label?: string;
  compact?: boolean;
}) {
  const { notes, addNote, deleteNote, toast } = useApp();
  const existing = notes.find((n) => n.targetType === targetType && n.targetId === targetId);
  const existingBody = existing?.body ?? '';

  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(existingBody);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Switching target (or saving/deleting) resets the draft.
  useEffect(() => {
    setEditing(false);
    setBody(existingBody);
    setError(null);
  }, [targetId, targetType, existingBody]);

  const startEdit = () => {
    setBody(existingBody);
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    if (!body.trim()) {
      setError('笔记不能为空');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addNote(targetType, targetId, body);
      setEditing(false);
      toast('笔记已保存', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    setBusy(true);
    try {
      await deleteNote(existing.id);
      toast('笔记已删除', 'info');
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="row-between" style={{ gap: 10, marginBottom: 8 }}>
        <div className="tiny faint" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {label}
        </div>
        {!editing && existing ? (
          <div className="row" style={{ gap: 4 }}>
            <span className="tiny faint">{formatDate(existing.updatedAt)}</span>
            <Button size="sm" variant="ghost" onClick={startEdit} disabled={busy}>
              编辑
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void remove()} disabled={busy}>
              删除
            </Button>
          </div>
        ) : null}
      </div>

      {editing ? (
        <div className="col" style={{ gap: 8 }}>
          <textarea
            className="textarea"
            rows={compact ? 3 : 5}
            value={body}
            placeholder="写点什么：这个词让你意外的地方、记忆线索、自己造的例句…"
            onChange={(e) => {
              setBody(e.target.value);
              setError(null);
            }}
            aria-label="笔记内容"
          />
          {error ? (
            <div className="tiny" style={{ color: 'var(--red)' }}>
              {error}
            </div>
          ) : null}
          <div className="row" style={{ gap: 8 }}>
            <Button size="sm" variant="primary" onClick={() => void save()} disabled={busy}>
              {busy ? '保存中…' : '保存笔记'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              disabled={busy}
            >
              取消
            </Button>
          </div>
        </div>
      ) : existing ? (
        <p className="small" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
          {existing.body}
        </p>
      ) : (
        <div className="row" style={{ gap: 8 }}>
          <span className="small faint">还没有笔记。</span>
          <Button size="sm" variant="ghost" onClick={startEdit}>
            添加笔记
          </Button>
        </div>
      )}
    </div>
  );
}
