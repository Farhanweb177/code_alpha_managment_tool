import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useToast } from '../toast';
import { subscribeProject, unsubscribeProject, useSocketEvent } from '../realtime';
import Modal from '../components/Modal';
import Avatar, { AvatarStack } from '../components/Avatar';
import { ProjectPageSkeleton, Spinner } from '../components/Skeleton';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import {
  Activity,
  CheckCircle,
  ChevronRight,
  Folder,
  LayoutGrid,
  ListTodo,
  Pencil,
  Plus,
  Settings,
  Tag,
  UserPlus,
  Users,
  X,
} from '../components/Icons';

function timeAgo(iso) {
  const then = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  const s = Math.max(1, Math.floor((Date.now() - then.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function activityText(a) {
  const p = a.payload || {};
  switch (a.type) {
    case 'project.created':
      return `created the project “${p.name}”`;
    case 'project.updated':
      return 'updated project details';
    case 'member.added':
      return `added @${p.username} as ${p.role}`;
    case 'member.role_changed':
      return `changed a member's role to ${p.role}`;
    case 'member.removed':
      return 'removed a member';
    case 'board.created':
      return `created board “${p.name}”`;
    case 'task.created':
      return `created “${p.title}” in ${p.listName}`;
    case 'task.moved':
      return `moved “${p.title}” to ${p.listName}`;
    case 'task.assigned':
      return `assigned a member to “${p.title}”`;
    case 'task.labelled':
      return `added label "${p.labelName}" to a task`;
    default:
      return a.type;
  }
}

function LabelManager({ projectId, onClose }) {
  const toast = useToast();
  const [labels, setLabels] = useState([]);
  const [form, setForm] = useState({ name: '', color: '#6366f1' });
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#14b8a6', '#f97316'];

  const load = () => {
    api(`/projects/${projectId}/labels`)
      .then((d) => setLabels(d.labels))
      .catch((e) => toast.error(e.message));
  };

  useEffect(load, [projectId]);

  const add = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      await api(`/projects/${projectId}/labels`, { method: 'POST', body: form });
      setForm({ name: '', color: '#6366f1' });
      toast.success('Label added');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async (id) => {
    try {
      await api(`/labels/${id}`, { method: 'DELETE' });
      toast.success('Label removed');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Modal title="Manage labels" onClose={onClose}>
      <div className="stack-form">
        <form className="label-create" onSubmit={add}>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Label name (e.g. Bug)"
          />
          <div className="color-row" style={{ margin: 0 }}>
            {colors.map((c) => (
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
          <button className="btn small primary">
            <Plus size={14} />
            Add label
          </button>
        </form>
        <div className="label-manage-list">
          {labels.map((l) => (
            <div key={l.id} className="label-manage-row">
              <span className="label-chip" style={{ background: l.color + '22', color: l.color, borderColor: l.color + '55' }}>
                {l.name}
              </span>
              <button className="icon-btn" onClick={() => remove(l.id)} aria-label={`Delete ${l.name}`}>
                <X size={14} />
              </button>
            </div>
          ))}
          {labels.length === 0 && <div className="empty-note">No labels yet</div>}
        </div>
      </div>
    </Modal>
  );
}

function InviteModal({ project, onDone, onClose }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [role, setRole] = useState('member');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!q.trim()) return setResults([]);
    const t = setTimeout(() => {
      api(`/auth/search?q=${encodeURIComponent(q)}`)
        .then((d) => setResults(d.users))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const invite = async (user) => {
    setError('');
    setBusyId(user.id);
    try {
      await api(`/projects/${project.id}/members`, { method: 'POST', body: { username: user.username, role } });
      toast.success(`Added @${user.username}`);
      onDone();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal title="Add members" onClose={onClose}>
      <div className="stack-form">
        {error && <div className="form-error">{error}</div>}
        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="member">Member — can create and edit tasks</option>
            <option value="admin">Admin — can manage board &amp; members</option>
          </select>
        </label>
        <label>
          Search by username or email
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. bob" autoFocus />
        </label>
        <div className="search-results">
          {results.map((u) => (
            <div key={u.id} className="search-row">
              <Avatar user={u} size={28} />
              <div>
                <strong>{u.displayName}</strong>
                <span className="muted"> @{u.username}</span>
              </div>
              <button className="btn small" onClick={() => invite(u)} disabled={busyId === u.id}>
                {busyId === u.id ? <Spinner size={13} /> : 'Add'}
              </button>
            </div>
          ))}
          {q && results.length === 0 && <div className="empty-note">No users found</div>}
        </div>
      </div>
    </Modal>
  );
}

export default function Project() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [activities, setActivities] = useState([]);
  const [error, setError] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [newBoard, setNewBoard] = useState('');
  const [editBoard, setEditBoard] = useState(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [boardBusy, setBoardBusy] = useState(false);

  const load = useCallback(() => {
    setError('');
    api(`/projects/${projectId}`)
      .then(setData)
      .catch((e) => setError(e.message));
    api(`/projects/${projectId}/activities`)
      .then((d) => setActivities(d.activities))
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    subscribeProject(projectId);
    return () => unsubscribeProject(projectId);
  }, [projectId]);

  useSocketEvent('activity:new', (a) => setActivities((prev) => [a, ...prev].slice(0, 50)));
  useSocketEvent('member:added', load);
  useSocketEvent('member:removed', load);
  useSocketEvent('member:updated', load);

  if (error && !data) {
    return (
      <main className="page">
        <ErrorState title="Couldn’t load this project" message={error} onRetry={load} />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="page">
        <ProjectPageSkeleton />
      </main>
    );
  }

  const { project, members, boards } = data;
  const me = members.find((m) => m.id === user.id);
  const canAdmin = ['owner', 'admin'].includes(me?.role);

  const createBoard = async (e) => {
    e.preventDefault();
    if (!newBoard.trim()) return;
    setBoardBusy(true);
    try {
      await api('/boards', { method: 'POST', body: { projectId: project.id, name: newBoard.trim() } });
      setNewBoard('');
      toast.success('Board created');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBoardBusy(false);
    }
  };

  const saveBoard = async (e) => {
    e.preventDefault();
    setBoardBusy(true);
    try {
      await api(`/boards/${editBoard.id}`, { method: 'PATCH', body: { name: editBoard.name } });
      setEditBoard(null);
      toast.success('Board renamed');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBoardBusy(false);
    }
  };

  const deleteBoard = async (id) => {
    if (!window.confirm('Delete this board and all of its tasks?')) return;
    try {
      await api(`/boards/${id}`, { method: 'DELETE' });
      toast.success('Board deleted');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const removeMember = async (member) => {
    if (!window.confirm(`Remove @${member.username} from this project?`)) return;
    try {
      await api(`/projects/${project.id}/members/${member.id}`, { method: 'DELETE' });
      toast.success('Member removed');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const changeRole = async (member, role) => {
    try {
      await api(`/projects/${project.id}/members/${member.id}`, { method: 'PATCH', body: { role } });
      toast.success('Role updated');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <main className="page project-page">
        <div className="project-hero" style={{ '--project-color': project.color }}>
          <div className="project-hero-main">
            <div className="crumbs">
              <Link to="/">Dashboard</Link>
              <ChevronRight size={12} />
              <span>{project.name}</span>
            </div>

            <div className="project-hero-title">
              <span className="project-avatar">
                <Folder size={24} />
              </span>
              <div>
                <h1>{project.name}</h1>
                <p className="muted">{project.description || 'No description yet'}</p>
              </div>
            </div>

            <div className="project-stats">
              <span className="hero-stat">
                <ListTodo size={15} />
                {project.taskCount} tasks
              </span>
              <span className="hero-stat">
                <CheckCircle size={15} />
                {project.doneTaskCount} done
              </span>
              <span className="hero-stat">
                <Users size={15} />
                {members.length} members
              </span>
              <span className="hero-stat">
                <LayoutGrid size={15} />
                {boards.length} boards
              </span>
            </div>
          </div>

          <div className="project-hero-actions">
            <AvatarStack users={members} size={30} max={5} />
            <button className="btn" onClick={() => setShowInvite(true)}>
              <UserPlus size={15} />
              Add members
            </button>
            {canAdmin && (
              <button className="btn" onClick={() => setShowLabels(true)}>
                <Tag size={15} />
                Labels
              </button>
            )}
            {canAdmin && (
              <button
                className="btn icon-only"
                onClick={() => setShowSettings(true)}
                title="Project settings"
                aria-label="Project settings"
              >
                <Settings size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="project-layout">
          <section className="project-main">
            <div className="section-heading">
              <div>
                <h2>Boards</h2>
                <p className="muted small-text">Open a board to manage its tasks.</p>
              </div>
            </div>

            <div className="board-tabs">
              {boards.map((b) => (
                <div key={b.id} className="board-tab">
                  <button
                    className="board-tab-link"
                    onClick={() => navigate(`/projects/${project.id}/boards/${b.id}`)}
                  >
                    <span className="board-tab-icon">
                      <LayoutGrid size={16} />
                    </span>
                    <span className="board-tab-text">
                      <strong>{b.name}</strong>
                      <em>Open board</em>
                    </span>
                  </button>
                  {canAdmin && (
                    <span className="board-tab-actions">
                      <button
                        className="icon-btn"
                        title="Rename"
                        aria-label={`Rename ${b.name}`}
                        onClick={() => setEditBoard({ id: b.id, name: b.name })}
                      >
                        <Pencil size={14} />
                      </button>
                      {boards.length > 1 && (
                        <button
                          className="icon-btn"
                          title="Delete"
                          aria-label={`Delete ${b.name}`}
                          onClick={() => deleteBoard(b.id)}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </span>
                  )}
                </div>
              ))}

              {canAdmin && (
                <form className="inline-form board-add-form" onSubmit={createBoard}>
                  <Plus size={15} />
                  <input
                    value={newBoard}
                    onChange={(e) => setNewBoard(e.target.value)}
                    placeholder="Add board"
                    aria-label="New board name"
                  />
                  {boardBusy && <Spinner size={14} />}
                </form>
              )}
            </div>

            {boards.length === 0 && (
              <EmptyState
                compact
                icon={<LayoutGrid size={22} />}
                title="No boards yet"
                description="Create a board to start adding tasks."
              />
            )}

            <div className="members-section">
              <div className="section-heading">
                <div>
                  <h2>Members</h2>
                  <p className="muted small-text">{members.length} people in this project</p>
                </div>
                <button className="btn small" onClick={() => setShowInvite(true)}>
                  <UserPlus size={14} />
                  Invite
                </button>
              </div>

              <div className="member-list">
                {members.map((m) => (
                  <div key={m.id} className="member-row">
                    <Avatar user={m} size={32} />
                    <div className="member-info">
                      <strong>
                        {m.displayName}
                        {m.id === user.id && <span className="muted"> (you)</span>}
                      </strong>
                      <span className="muted">@{m.username}</span>
                    </div>
                    {canAdmin && m.role !== 'owner' ? (
                      <div className="member-actions">
                        <select value={m.role} onChange={(e) => changeRole(m, e.target.value)} aria-label={`Role for ${m.username}`}>
                          <option value="member">member</option>
                          <option value="admin">admin</option>
                        </select>
                        <button className="icon-btn" title="Remove" aria-label={`Remove ${m.username}`} onClick={() => removeMember(m)}>
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <span className="role-pill">{m.role}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="activity-feed">
            <div className="feed-head">
              <span className="feed-icon">
                <Activity size={16} />
              </span>
              <div>
                <h2>Activity</h2>
                <p className="muted small-text">Latest updates</p>
              </div>
            </div>

            {activities.length === 0 && (
              <EmptyState
                compact
                icon={<Activity size={20} />}
                title="No activity yet"
                description="Actions across this project will appear here."
              />
            )}

            {activities.map((a) => (
              <div key={a.id} className="activity-row">
                <Avatar user={a.actor} size={26} />
                <div>
                  <strong>{a.actor.displayName}</strong> {activityText(a)}
                  <em>{timeAgo(a.createdAt)}</em>
                </div>
              </div>
            ))}
          </aside>
        </div>
      </main>

      {showInvite && <InviteModal project={project} onDone={load} onClose={() => setShowInvite(false)} />}
      {showLabels && <LabelManager projectId={project.id} onClose={() => setShowLabels(false)} />}

      {showSettings && (
        <Modal title="Project settings" onClose={() => setShowSettings(false)}>
          <form
            className="stack-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setSettingsBusy(true);
              try {
                await api(`/projects/${project.id}`, {
                  method: 'PATCH',
                  body: {
                    name: e.target.elements.pname.value,
                    description: e.target.elements.pdesc.value,
                    color: project.color,
                  },
                });
                toast.success('Project updated');
                setShowSettings(false);
                load();
              } catch (err) {
                toast.error(err.message);
              } finally {
                setSettingsBusy(false);
              }
            }}
          >
            <label>
              Project name
              <input name="pname" defaultValue={project.name} />
            </label>
            <label>
              Description
              <textarea name="pdesc" rows={3} defaultValue={project.description} />
            </label>
            <button className="btn primary" disabled={settingsBusy}>
              {settingsBusy ? <Spinner size={15} /> : 'Save changes'}
            </button>
          </form>

          {project.role === 'owner' && (
            <button
              className="btn danger"
              onClick={async () => {
                if (!window.confirm('Delete this project permanently?')) return;
                try {
                  await api(`/projects/${project.id}`, { method: 'DELETE' });
                  toast.success('Project deleted');
                  navigate('/');
                } catch (err) {
                  toast.error(err.message);
                }
              }}
            >
              Delete project
            </button>
          )}
        </Modal>
      )}

      {editBoard && (
        <Modal title="Rename board" onClose={() => setEditBoard(null)}>
          <form className="stack-form" onSubmit={saveBoard}>
            <label>
              Board name
              <input
                value={editBoard.name}
                onChange={(e) => setEditBoard({ ...editBoard, name: e.target.value })}
                autoFocus
              />
            </label>
            <button className="btn primary" disabled={boardBusy}>
              {boardBusy ? <Spinner size={15} /> : 'Save'}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
