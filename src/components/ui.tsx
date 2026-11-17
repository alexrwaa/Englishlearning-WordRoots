import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
};

export function Button({ variant = 'default', size = 'md', block, className, ...rest }: ButtonProps) {
  const cls = [
    'btn',
    variant === 'primary' ? 'btn-primary' : '',
    variant === 'ghost' ? 'btn-ghost' : '',
    size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '',
    block ? 'btn-block' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return <button className={cls} {...rest} />;
}

export function Panel({
  children,
  className,
  flat,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { flat?: boolean }) {
  return (
    <div className={`${flat ? 'panel-flat' : 'panel'} ${className ?? ''}`} {...rest}>
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = 'default',
  className,
}: {
  children: React.ReactNode;
  tone?: 'default' | 'accent' | 'amber' | 'green' | 'red';
  className?: string;
}) {
  const map = {
    default: '',
    accent: 'badge-accent',
    amber: 'badge-amber',
    green: 'badge-green',
    red: 'badge-red',
  } as const;
  return <span className={`badge ${map[tone]} ${className ?? ''}`}>{children}</span>;
}

export function Bar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Ring({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="ring" style={{ ['--p' as string]: pct }}>
      <i>{label}</i>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint ? <span className="tiny faint">{hint}</span> : null}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <div className="row">
      <button
        type="button"
        className="switch"
        data-on={on}
        aria-label={label ?? 'toggle'}
        aria-pressed={on}
        onClick={() => onChange(!on)}
      >
        <i />
      </button>
      {null}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {title ? (
          <div className="row-between" style={{ marginBottom: 14 }}>
            <h2>{title}</h2>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="关闭">
              ✕
            </Button>
          </div>
        ) : null}
        {children}
        {footer ? <div style={{ marginTop: 18 }}>{footer}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ padding: '38px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 26, opacity: 0.5, marginBottom: 8 }}>◌</div>
      <h3 style={{ marginBottom: 6 }}>{title}</h3>
      {body ? <p className="muted small" style={{ maxWidth: 420, margin: '0 auto 14px' }}>{body}</p> : null}
      {action}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div>
      <div className="tiny faint" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 640, fontFamily: 'var(--serif)', lineHeight: 1.3 }}>{value}</div>
      {hint ? <div className="tiny faint">{hint}</div> : null}
    </div>
  );
}

export function SectionHead({
  title,
  hint,
  right,
}: {
  title: string;
  hint?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="row-between" style={{ margin: '26px 0 12px' }}>
      <div>
        <h3>{title}</h3>
        {hint ? <div className="small faint">{hint}</div> : null}
      </div>
      {right}
    </div>
  );
}
