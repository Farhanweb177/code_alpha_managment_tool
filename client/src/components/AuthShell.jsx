import { useTheme } from '../theme';
import { Activity, CheckCircle, Moon, Sparkles, Sun, Users } from './Icons';

export default function AuthShell({ title, subtitle, children }) {
  const { theme, toggle } = useTheme();

  return (
    <div className="auth-page">
      <aside className="auth-hero">
        <div className="brand auth-brand">
          <span className="brand-mark">TF</span>
          TaskFlow
        </div>

        <div className="auth-hero-copy">
          <span className="eyebrow">
            <Sparkles size={14} />
            Work in flow
          </span>
          <h1>Plan, track and ship work with your team.</h1>
          <p>Boards, tasks, checklists and real-time updates — everything in one calm workspace.</p>

          <ul className="auth-points">
            <li>
              <CheckCircle size={18} />
              Kanban boards with drag &amp; drop
            </li>
            <li>
              <Users size={18} />
              Roles, mentions and notifications
            </li>
            <li>
              <Activity size={18} />
              Live activity and presence
            </li>
          </ul>
        </div>

        <p className="auth-hero-foot">Built for small teams that like to move fast.</p>
      </aside>

      <main className="auth-panel">
        <button
          className="icon-btn auth-theme"
          onClick={toggle}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
        </button>

        <div className="brand auth-mobile-brand">
          <span className="brand-mark">TF</span>
          TaskFlow
        </div>

        <div className="auth-card">
          <div className="auth-card-head">
            <h1>{title}</h1>
            <p className="muted">{subtitle}</p>
          </div>
          {children}
        </div>

        <p className="auth-foot muted small-text">© TaskFlow · Built for focused teams</p>
      </main>
    </div>
  );
}
