import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import Avatar from './Avatar';
import { Skeleton } from './Skeleton';
import { LayoutDashboard, LogOut, Plus, X } from './Icons';

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [projects, setProjects] = useState(null);

  useEffect(() => {
    let alive = true;
    api('/projects')
      .then((d) => alive && setProjects(d.projects))
      .catch(() => alive && setProjects([]));
    return () => {
      alive = false;
    };
  }, [location.pathname]);

  const newProject = () => {
    onClose();
    navigate('/?create=1');
  };

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`.trim()} aria-label="Main navigation">
      <div className="sidebar-head">
        <Link to="/" className="brand" onClick={onClose}>
          <span className="brand-mark">TF</span>
          <span className="brand-name">TaskFlow</span>
        </Link>
        <button className="icon-btn sidebar-close" onClick={onClose} aria-label="Close navigation">
          <X size={18} />
        </button>
      </div>

      <button className="btn primary sidebar-new" onClick={newProject}>
        <Plus size={16} />
        New project
      </button>

      <nav className="sidebar-nav">
        <NavLink to="/" end className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`.trim()} onClick={onClose}>
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </NavLink>
      </nav>

      <div className="sidebar-scroll">
        <div className="sidebar-section-head">
          <span>Recent projects</span>
          <Link to="/" onClick={onClose}>
            View all
          </Link>
        </div>

        {projects === null && (
          <div className="side-skeleton" aria-hidden="true">
            <Skeleton className="sk-line w80" />
            <Skeleton className="sk-line w60" />
            <Skeleton className="sk-line w70" />
          </div>
        )}

        {projects?.length === 0 && <p className="side-empty">No projects yet.</p>}

        {projects?.slice(0, 6).map((p) => {
          const active = location.pathname.startsWith(`/projects/${p.id}`);
          return (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className={`side-project ${active ? 'active' : ''}`.trim()}
              aria-current={active ? 'page' : undefined}
              onClick={onClose}
              title={p.name}
            >
              <span className="side-project-dot" style={{ background: p.color }} />
              <span className="side-project-name">{p.name}</span>
              {p.role === 'owner' && <span className="side-project-badge">owner</span>}
            </Link>
          );
        })}
      </div>

      <div className="sidebar-foot">
        <div className="side-user">
          <Avatar user={user} size={34} />
          <div className="side-user-meta">
            <strong>{user?.displayName}</strong>
            <span>@{user?.username}</span>
          </div>
          <button className="icon-btn" onClick={logout} title="Log out" aria-label="Log out">
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </aside>
  );
}
