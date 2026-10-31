import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useToast } from '../toast';
import { getSocket } from '../socket';
import { useSocketEvent } from '../realtime';
import Modal from './Modal';
import Avatar from './Avatar';
import Subtasks from './Subtasks';
import { LabelPicker } from './Labels';
import { TaskModalSkeleton } from './Skeleton';
import ErrorState from './ErrorState';
import { Eye, Plus, X } from './Icons';

const PRIORITIES = [
  { value: 'low', label: 'Low', cls: 'p-low' },
  { value: 'medium', label: 'Medium', cls: 'p-medium' },
  { value: 'high', label: 'High', cls: 'p-high' },
  { value: 'urgent', label: 'Urgent', cls: 'p-urgent' },
];

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.length > 10 ? iso : iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function timeAgo(iso) {
  const then = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  const s = Math.max(1, Math.floor((Date.now() - then.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function TaskModal({ taskId, members, projectId, onChanged, onClose, onDeleted }) {
  const { user } = useAuth();
  const toast = useToast();
  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [editingComment, setEditingComment] = useState(null);
  const [editBody, setEditBody] = useState('');
  const [showAssign, setShowAssign] = useState(false);
  const [viewers, setViewers] = useState({});
  const commentRef = useRef(null);

  const load = useCallback(() => {
    setError('');
    api(`/tasks/${taskId}`)
      .then((d) => setTask(d.task))
      .catch((e) => setError(e.message));
    api(`/tasks/${taskId}/comments`)
      .then((d) => setComments(d.comments))
      .catch(() => {});
  }, [taskId]);

  useEffect(load, [load]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    socket.emit('presence:track', { taskId });
    socket.emit('presence:update', { taskId, viewing: true });
    const onPresence = ({ userId, displayName, viewing }) => {
      setViewers((v) => {
        const next = { ...v };
        if (viewing && userId !== user.id) next[userId] = displayName;
        else delete next[userId];
        return next;
      });
    };
    socket.on('presence:update', onPresence);
    return () => {
      socket.emit('presence:update', { taskId, viewing: false });
      socket.emit('presence:untrack', { taskId });
      socket.off('presence:update', onPresence);
    };
  }, [taskId, user.id]);

  useSocketEvent('comment:created', (c) => {
    if (c.taskId === Number(taskId)) {
      setComments((prev) => (prev.some((p) => p.id === c.id) ? prev : [...prev, c]));
      setTask((t) => (t ? { ...t, commentCount: (t.commentCount || 0) + 1 } : t));
    }
  });
  useSocketEvent('comment:updated', (c) => {
    if (c.taskId === Number(taskId)) setComments((prev) => prev.map((p) => (p.id === c.id ? c : p)));
  });
  useSocketEvent('comment:deleted', ({ id, taskId: tid }) => {
    if (Number(tid) === Number(taskId)) setComments((prev) => prev.filter((p) => p.id !== id));
  });
  useSocketEvent('task:updated', (t) => {
    if (t.id === Number(taskId)) setTask(t);
  });
  useSocketEvent('task:deleted', ({ id }) => {
    if (id === Number(taskId)) {
      onDeleted?.(id);
      onClose();
    }
  });

  const patch = async (body) => {
    try {
      const d = await api(`/tasks/${taskId}`, { method: 'PATCH', body });
      setTask(d.task);
      onChanged?.(d.task);
    } catch (err) {
      toast.error(err.message);
      load();
    }
  };

  const addComment = async (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    const body = draft;
    setDraft('');
    try {
      await api(`/tasks/${taskId}/comments`, { method: 'POST', body: { body } });
    } catch (err) {
      setDraft(body);
      toast.error(err.message);
    }
  };

  const assign = async (member) => {
    setShowAssign(false);
    try {
      const d = await api(`/tasks/${taskId}/assignees`, { method: 'POST', body: { userId: member.id } });
      setTask(d.task);
      onChanged?.(d.task);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const unassign = async (userId) => {
    try {
      const d = await api(`/tasks/${taskId}/assignees/${userId}`, { method: 'DELETE' });
      setTask(d.task);
      onChanged?.(d.task);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await api(`/tasks/${taskId}`, { method: 'DELETE' });
      onDeleted?.(Number(taskId));
      onClose();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (error && !task) {
    return (
      <Modal title="Task" onClose={onClose}>
        <ErrorState title="Couldn’t load this task" message={error} onRetry={load} />
      </Modal>
    );
  }

  if (!task) {
    return (
      <Modal title="Task" onClose={onClose} wide>
        <TaskModalSkeleton />
      </Modal>
    );
  }

  const unassigned = members.filter((m) => !task.assignees.some((a) => a.id === m.id));
  const viewerList = Object.entries(viewers);

  return (
    <Modal ariaLabel={`Task: ${task.title}`} onClose={onClose} wide>
      <div className="task-modal">
        <div className="task-modal-top">
          <input
            className="task-title-input"
            aria-label="Task title"
            defaultValue={task.title}
            key={`title-${task.id}-${task.title}`}
            onBlur={(e) => e.target.value.trim() && e.target.value !== task.title && patch({ title: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
          />
          <label className="check-label">
            <input type="checkbox" checked={task.completed} onChange={(e) => patch({ completed: e.target.checked })} />
            Done
          </label>
        </div>

        {viewerList.length > 0 && (
          <div className="presence-line">
            {viewerList.map(([id, name]) => (
              <span key={id}>
                <Eye size={14} />
                {name} is viewing
              </span>
            ))}
          </div>
        )}

        <div className="task-modal-grid">
          <div className="task-modal-main">
            <section>
              <h4>Description</h4>
              <textarea
                className="desc-area"
                aria-label="Task description"
                rows={5}
                placeholder="Add a more detailed description…"
                defaultValue={task.description}
                key={`desc-${task.id}-${task.updatedAt}`}
                onBlur={(e) => e.target.value !== task.description && patch({ description: e.target.value })}
              />
            </section>

            <section>
              <h4>Labels</h4>
              <LabelPicker projectId={projectId} taskId={taskId} taskLabels={task.labels || []} onChange={() => load()} />
            </section>

            <Subtasks taskId={taskId} onUpdate={load} />

            <section>
              <div className="section-head">
                <h4>Comments</h4>
                <span className="muted">{comments.length}</span>
              </div>
              <div className="comment-list">
                {comments.map((c) => (
                  <div key={c.id} className="comment">
                    <Avatar user={c.author} size={28} />
                    <div className="comment-body">
                      <div className="comment-meta">
                        <strong>{c.author.displayName}</strong>
                        <span className="muted">
                          @{c.author.username} · {timeAgo(c.createdAt)}
                          {c.edited ? ' · edited' : ''}
                        </span>
                        {c.author.id === user.id && (
                          <span className="comment-actions">
                            <button
                              className="link-btn"
                              onClick={() => {
                                setEditingComment(c.id);
                                setEditBody(c.body);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="link-btn danger"
                              onClick={async () => {
                                try {
                                  await api(`/comments/${c.id}`, { method: 'DELETE' });
                                  setComments((p) => p.filter((x) => x.id !== c.id));
                                } catch (err) {
                                  toast.error(err.message);
                                }
                              }}
                            >
                              Delete
                            </button>
                          </span>
                        )}
                      </div>
                      {editingComment === c.id ? (
                        <div className="comment-edit">
                          <textarea rows={3} value={editBody} onChange={(e) => setEditBody(e.target.value)} autoFocus />
                          <div className="row-actions">
                            <button
                              className="btn small primary"
                              onClick={async () => {
                                try {
                                  const d = await api(`/comments/${c.id}`, { method: 'PATCH', body: { body: editBody } });
                                  setComments((p) => p.map((x) => (x.id === c.id ? d.comment : x)));
                                  setEditingComment(null);
                                } catch (err) {
                                  toast.error(err.message);
                                }
                              }}
                            >
                              Save
                            </button>
                            <button className="btn small" onClick={() => setEditingComment(null)}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="comment-text">{c.body}</p>
                      )}
                    </div>
                  </div>
                ))}
                {comments.length === 0 && <div className="empty-note">No comments yet — start the conversation.</div>}
              </div>
              <form className="comment-form" onSubmit={addComment}>
                <Avatar user={user} size={28} />
                <textarea
                  ref={commentRef}
                  aria-label="Write a comment"
                  rows={2}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Write a comment… use @username to mention"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addComment(e);
                  }}
                />
                <button className="btn small primary" disabled={!draft.trim()}>
                  Comment
                </button>
              </form>
            </section>
          </div>

          <aside className="task-modal-side">
            <section>
              <h4>Assignees</h4>
              <div className="assignee-list">
                {task.assignees.map((a) => (
                  <div key={a.id} className="assignee-chip">
                    <Avatar user={a} size={22} />
                    <span>{a.displayName}</span>
                    <button className="icon-btn" title="Unassign" aria-label={`Unassign ${a.displayName}`} onClick={() => unassign(a.id)}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
                {task.assignees.length === 0 && <div className="empty-note">Unassigned</div>}
                <button className="btn small" onClick={() => setShowAssign((s) => !s)}>
                  <Plus size={14} />
                  Assign
                </button>
                {showAssign && (
                  <div className="assign-menu">
                    {unassigned.length === 0 && <div className="empty-note">Everyone is assigned</div>}
                    {unassigned.map((m) => (
                      <button key={m.id} className="assign-option" onClick={() => assign(m)}>
                        <Avatar user={m} size={22} /> {m.displayName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section>
              <h4>Priority</h4>
              <div className="priority-row">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    className={`priority-chip ${p.cls} ${task.priority === p.value ? 'active' : ''}`.trim()}
                    onClick={() => patch({ priority: p.value })}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h4>Due date</h4>
              <input
                type="date"
                value={task.dueDate ? task.dueDate.slice(0, 10) : ''}
                onChange={(e) => patch({ dueDate: e.target.value || null })}
              />
              {task.dueDate && <div className="muted">Due {fmtDate(task.dueDate)}</div>}
            </section>

            {(task.subtaskCount > 0 || task.labels?.length) && (
              <section>
                <h4>Progress</h4>
                {task.subtaskCount > 0 && (
                  <div className="progress">
                    <div
                      className="progress-bar"
                      style={{ width: `${Math.round(((task.subtaskDone || 0) / task.subtaskCount) * 100)}%` }}
                    />
                  </div>
                )}
                <div className="muted small-text">
                  {task.subtaskDone || 0}/{task.subtaskCount || 0} subtasks done
                </div>
              </section>
            )}

            <section>
              <h4>Details</h4>
              <div className="muted small-text">
                Created by {task.createdBy?.displayName}
                <br />
                {fmtDate(task.createdAt)}
              </div>
            </section>

            <button className="btn danger" onClick={remove}>
              Delete task
            </button>
          </aside>
        </div>
      </div>
    </Modal>
  );
}
