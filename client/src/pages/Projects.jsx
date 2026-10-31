import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useToast } from '../toast';
import Modal from '../components/Modal';
import ProjectCard from '../components/ProjectCard';
import { DashboardSkeleton, Spinner } from '../components/Skeleton';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import {
  CheckCircle,
  Clock,
  Folder,
  ListTodo,
  Plus,
  Search,
  Sparkles,
  X,
} from '../components/Icons';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6'];

function progressOf(p) {
  return p.taskCount ? p.doneTaskCount / p.taskCount : 0;
}

export default function Projects() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';

  const [projects, setProjects] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', color: COLORS[0] });
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState('recent');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api('/projects')
      .then((d) => setProjects(d.projects))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setShowCreate(true);
      const next = new URLSearchParams(searchParams);
      next.delete('create');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const list = projects || [];

  const stats = useMemo(() => {
    const tasks = list.reduce((sum, p) => sum + p.taskCount, 0);
    const done = list.reduce((sum, p) => sum + p.doneTaskCount, 0);
    return {
      projects: list.length,
      owned: list.filter((p) => p.role === 'owner').length,
      tasks,
      done,
      active: Math.max(0, tasks - done),
      completion: tasks ? Math.round((done / tasks) * 100) : 0,
    };
  }, [list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) =>
      [p.name, p.description, p.owner?.displayName, p.owner?.username]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [list, query]);

  const sorted = useMemo(() => {
    const next = [...filtered];
    switch (sort) {
      case 'name':
        return next.sort((a, b) => a.name.localeCompare(b.name));
      case 'progress':
        return next.sort((a, b) => progressOf(b) - progressOf(a));
      case 'tasks':
        return next.sort((a, b) => b.taskCount - a.taskCount);
      default:
        return next.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  }, [filtered, sort]);

  const updateQuery = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('q', value);
    else next.delete('q');
    setSearchParams(next, { replace: true });
  };

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      const d = await api('/projects', { method: 'POST', body: form });
      toast.success('Project created');
      navigate(`/projects/${d.project.id}`);
    } catch (err) {
      setFormError(err.message);
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.displayName?.split(' ')[0] || user?.username || 'there';
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <main className="page dashboard-page">
      <div className="dash-hero">
        <div>
          <span className="eyebrow">
            <Sparkles size={14} />
            Dashboard
          </span>
          <h1>
            {greeting}, {firstName}
          </h1>
          <p className="muted">Here’s what’s happening across your projects · {today}</p>
        </div>
        <button className="btn primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} />
          New project
        </button>
      </div>

      {loading && projects === null && <DashboardSkeleton />}

      {error && projects === null && (
        <ErrorState title="Couldn’t load your projects" message={error} onRetry={load} />
      )}

      {projects !== null && (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <span className="stat-icon tone-accent">
                <Folder size={19} />
              </span>
              <div className="stat-body">
                <span className="stat-label">Projects</span>
                <strong className="stat-value">{stats.projects}</strong>
                <span className="stat-hint">{stats.owned} owned by you</span>
              </div>
            </div>

            <div className="stat-card">
              <span className="stat-icon tone-violet">
                <ListTodo size={19} />
              </span>
              <div className="stat-body">
                <span className="stat-label">Total tasks</span>
                <strong className="stat-value">{stats.tasks}</strong>
                <span className="stat-hint">Across all projects</span>
              </div>
            </div>

            <div className="stat-card">
              <span className="stat-icon tone-ok">
                <CheckCircle size={19} />
              </span>
              <div className="stat-body">
                <span className="stat-label">Completed</span>
                <strong className="stat-value">{stats.done}</strong>
                <span className="stat-hint">{stats.completion}% completion rate</span>
                <span className="stat-mini-progress">
                  <span style={{ width: `${stats.completion}%` }} />
                </span>
              </div>
            </div>

            <div className="stat-card">
              <span className="stat-icon tone-warn">
                <Clock size={19} />
              </span>
              <div className="stat-body">
                <span className="stat-label">In progress</span>
                <strong className="stat-value">{stats.active}</strong>
                <span className="stat-hint">Open tasks to move forward</span>
              </div>
            </div>
          </div>

          <div className="dash-toolbar">
            <div className="search-field">
              <Search size={17} />
              <input
                value={query}
                onChange={(e) => updateQuery(e.target.value)}
                placeholder="Search projects by name, description or owner…"
                aria-label="Search projects"
              />
              {query && (
                <button className="icon-btn" onClick={() => updateQuery('')} aria-label="Clear search">
                  <X size={15} />
                </button>
              )}
            </div>

            <div className="dash-toolbar-right">
              <span className="muted small-text">
                {filtered.length} of {list.length} projects
              </span>
              <label className="sort-field">
                <span>Sort</span>
                <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort projects">
                  <option value="recent">Recently created</option>
                  <option value="name">Name A–Z</option>
                  <option value="progress">Most progress</option>
                  <option value="tasks">Most tasks</option>
                </select>
              </label>
            </div>
          </div>

          {error && (
            <div className="inline-alert" role="alert">
              <span>{error}</span>
              <button className="link-btn" onClick={load}>
                Retry
              </button>
            </div>
          )}

          {sorted.length > 0 ? (
            <div className="project-grid">
              {sorted.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          ) : list.length === 0 ? (
            <EmptyState
              icon={<Folder size={26} />}
              title="No projects yet"
              description="Create your first project to get your team organized."
              action={
                <button className="btn primary" onClick={() => setShowCreate(true)}>
                  <Plus size={16} />
                  New project
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={<Search size={26} />}
              title="No matching projects"
              description={`Nothing matched “${query}”. Try a different search term.`}
              action={
                <button className="btn" onClick={() => updateQuery('')}>
                  Clear search
                </button>
              }
            />
          )}
        </>
      )}

      {showCreate && (
        <Modal title="Create project" onClose={() => setShowCreate(false)}>
          <form onSubmit={create} className="stack-form">
            {formError && <div className="form-error">{formError}</div>}
            <label>
              Name
              <input
                name="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Mobile App Launch"
                required
                autoFocus
              />
            </label>
            <label>
              Description
              <textarea
                name="description"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What is this project about?"
              />
            </label>
            <div className="color-row">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-swatch ${form.color === c ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setForm({ ...form, color: c })}
                  aria-label={`Use color ${c}`}
                />
              ))}
            </div>
            <button className="btn primary" disabled={busy || !form.name.trim()}>
              {busy ? (
                <>
                  <Spinner size={15} /> Creating…
                </>
              ) : (
                'Create project'
              )}
            </button>
          </form>
        </Modal>
      )}
    </main>
  );
}
