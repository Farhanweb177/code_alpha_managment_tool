import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useToast } from '../toast';
import { getSocket } from '../socket';
import { subscribeProject, unsubscribeProject, useSocketEvent } from '../realtime';
import { AvatarStack } from '../components/Avatar';
import TaskModal from '../components/TaskModal';
import FilterBar, { EMPTY_FILTERS } from '../components/FilterBar';
import { BoardSkeleton } from '../components/Skeleton';
import ErrorState from '../components/ErrorState';
import { Calendar, CheckSquare, ChevronRight, ListTodo, MessageSquare, Search, X } from '../components/Icons';

const PRIORITY_BADGE = { low: 'p-low', medium: 'p-medium', high: 'p-high', urgent: 'p-urgent' };

function dueLabel(iso) {
  if (!iso) return null;
  const d = new Date(iso.length > 10 ? iso : iso + 'T00:00:00');
  const today = new Date();
  const overdue = d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return { text: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), overdue };
}

function matchesDue(task, mode) {
  if (!task.dueDate) return false;
  const d = new Date(task.dueDate.length > 10 ? task.dueDate : task.dueDate + 'T00:00:00');
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (mode === 'overdue') return d < start;
  if (mode === 'today') return d >= start && d < new Date(start.getTime() + 86400000);
  if (mode === 'week') return d >= start && d < new Date(start.getTime() + 7 * 86400000);
  return true;
}

function TaskCard({ task, onOpen, onDragStart, onDragEnd, dragging, canDrag }) {
  const due = dueLabel(task.dueDate);
  const doneSub = task.subtaskDone || 0;
  const totalSub = task.subtaskCount || 0;

  return (
    <div
      className={`task-card ${dragging ? 'dragging' : ''} ${!canDrag ? 'no-drag' : ''}`.trim()}
      draggable={canDrag}
      onDragStart={(e) => canDrag && onDragStart(e, task)}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(task.id)}
      title={canDrag ? undefined : 'Clear filters to drag tasks'}
    >
      <div className="task-card-top">
        <span className={`priority-chip ${PRIORITY_BADGE[task.priority]}`}>{task.priority}</span>
        {task.completed && <span className="done-pill">done</span>}
      </div>

      {task.labels?.length > 0 && (
        <div className="card-labels">
          {task.labels.map((l) => (
            <span key={l.id} className="card-label" style={{ background: l.color }} title={l.name} />
          ))}
        </div>
      )}

      <div className={`task-card-title ${task.completed ? 'completed' : ''}`}>{task.title}</div>

      <div className="task-card-foot">
        <span className="task-meta">
          {due && (
            <span className={`meta-chip due-chip ${due.overdue ? 'overdue' : ''}`}>
              <Calendar size={13} />
              {due.text}
            </span>
          )}
          {task.commentCount > 0 && (
            <span className="meta-chip">
              <MessageSquare size={13} />
              {task.commentCount}
            </span>
          )}
          {totalSub > 0 && (
            <span className="meta-chip">
              <CheckSquare size={13} />
              {doneSub}/{totalSub}
            </span>
          )}
        </span>
        <AvatarStack users={task.assignees} size={22} max={3} />
      </div>
    </div>
  );
}

export default function Board() {
  const { projectId, boardId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [board, setBoard] = useState(null);
  const [lists, setLists] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [openTaskId, setOpenTaskId] = useState(null);
  const [newList, setNewList] = useState('');
  const [addingTo, setAddingTo] = useState(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [drag, setDrag] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const load = useCallback(() => {
    setError('');
    api(`/boards/${boardId}`)
      .then((d) => {
        setBoard(d.board);
        setLists(d.lists);
        setTasks(d.tasks);
      })
      .catch((e) => setError(e.message));
    api(`/projects/${projectId}`)
      .then((d) => setMembers(d.members))
      .catch(() => {});
  }, [boardId, projectId]);

  useEffect(load, [load]);

  useEffect(() => {
    subscribeProject(projectId);
    const socket = getSocket();
    if (socket) socket.emit('presence:track', { boardId });
    return () => {
      unsubscribeProject(projectId);
      if (socket) socket.emit('presence:untrack', { boardId });
    };
  }, [projectId, boardId]);

  const upsertTask = useCallback((t) => {
    setTasks((prev) => {
      const i = prev.findIndex((x) => x.id === t.id);
      if (i === -1) return [...prev, t];
      const next = [...prev];
      next[i] = t;
      return next;
    });
  }, []);

  useSocketEvent('task:created', upsertTask);
  useSocketEvent('task:updated', upsertTask);
  useSocketEvent('task:moved', upsertTask);
  useSocketEvent('task:deleted', ({ id }) => setTasks((prev) => prev.filter((t) => t.id !== id)));
  useSocketEvent('list:created', (l) => {
    if (l.boardId === Number(boardId)) setLists((prev) => [...prev, l].sort((a, b) => a.position - b.position));
  });
  useSocketEvent('list:updated', (l) => {
    if (l.boardId === Number(boardId))
      setLists((prev) => prev.map((x) => (x.id === l.id ? l : x)).sort((a, b) => a.position - b.position));
  });
  useSocketEvent('list:deleted', ({ id, boardId: bid }) => {
    if (bid === Number(boardId)) {
      setLists((prev) => prev.filter((l) => l.id !== id));
      setTasks((prev) => prev.filter((t) => t.listId !== id));
    }
  });
  useSocketEvent('board:updated', (b) => {
    if (b.id === Number(boardId)) setBoard((prev) => (prev ? { ...prev, name: b.name } : prev));
  });

  const filtersActive = useMemo(() => Object.values(filters).some(Boolean), [filters]);

  const filteredTasks = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return tasks.filter((t) => {
      if (q && !`${t.title} ${t.description || ''}`.toLowerCase().includes(q)) return false;
      if (filters.assignee && !t.assignees.some((a) => a.id === Number(filters.assignee))) return false;
      if (filters.priority && t.priority !== filters.priority) return false;
      if (filters.label && !(t.labels || []).some((l) => l.id === Number(filters.label))) return false;
      if (filters.status === 'active' && t.completed) return false;
      if (filters.status === 'done' && !t.completed) return false;
      if (filters.due && !matchesDue(t, filters.due)) return false;
      return true;
    });
  }, [tasks, filters]);

  const availableLabels = useMemo(() => {
    const map = new Map();
    tasks.forEach((t) => (t.labels || []).forEach((l) => !map.has(l.id) && map.set(l.id, l)));
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const tasksIn = (listId) =>
    filteredTasks
      .filter((t) => t.listId === listId)
      .sort((a, b) => a.position - b.position || a.id - b.id);

  const allTasksIn = (listId) => tasks.filter((t) => t.listId === listId);

  const onDragStart = (e, task) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(task.id));
    setDrag(task);
  };

  const computePosition = (targetListId, overTaskId) => {
    const listTasks = allTasksIn(targetListId).filter((t) => t.id !== drag?.id);
    if (!overTaskId) {
      return listTasks.length ? listTasks[listTasks.length - 1].position + 1 : 0;
    }
    const idx = listTasks.findIndex((t) => t.id === overTaskId);
    if (idx === -1) return listTasks.length ? listTasks[listTasks.length - 1].position + 1 : 0;
    const prev = listTasks[idx - 1];
    const next = listTasks[idx];
    if (!prev && !next) return 0;
    if (!prev) return next.position - 1;
    if (!next) return prev.position + 1;
    return (prev.position + next.position) / 2;
  };

  const onDrop = async (e, listId, overTaskId) => {
    e.preventDefault();
    setDropTarget(null);
    if (filtersActive) return;
    const taskId = Number(e.dataTransfer.getData('text/plain')) || drag?.id;
    const task = tasks.find((t) => t.id === taskId);
    setDrag(null);
    if (!task) return;
    const position = computePosition(listId, overTaskId);
    if (task.listId === listId && Math.abs(position - task.position) < 1e-9) return;
    upsertTask({ ...task, listId, position });
    try {
      await api(`/tasks/${task.id}`, { method: 'PATCH', body: { listId, position } });
    } catch (err) {
      toast.error(err.message);
      load();
    }
  };

  const addList = async (e) => {
    e.preventDefault();
    if (!newList.trim()) return;
    try {
      await api(`/boards/${boardId}/lists`, { method: 'POST', body: { name: newList.trim() } });
      setNewList('');
      toast.success('List added');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const addTask = async (e) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    const title = quickTitle.trim();
    setQuickTitle('');
    try {
      const d = await api(`/lists/${addingTo}/tasks`, { method: 'POST', body: { title } });
      setOpenTaskId(d.task.id);
      setAddingTo(null);
    } catch (err) {
      toast.error(err.message);
      setQuickTitle(title);
    }
  };

  const deleteList = async (id) => {
    const count = allTasksIn(id).length;
    if (!window.confirm(`Delete this list${count ? ` and its ${count} task(s)` : ''}?`)) return;
    try {
      await api(`/lists/${id}`, { method: 'DELETE' });
      toast.success('List deleted');
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (error && !board) {
    return (
      <main className="board-page">
        <div className="board-state">
          <ErrorState title="Couldn’t load this board" message={error} onRetry={load} />
        </div>
      </main>
    );
  }

  if (!board) {
    return (
      <main className="board-page">
        <div className="board-loading">
          <BoardSkeleton />
        </div>
      </main>
    );
  }

  const me = members.find((m) => m.id === user.id);
  const canAdmin = ['owner', 'admin'].includes(me?.role);
  const doneCount = tasks.filter((t) => t.completed).length;
  const canDrag = !filtersActive;

  return (
    <>
      <main className="board-page">
        <div className="board-head">
          <div className="board-head-main">
            <div className="crumbs">
              <Link to="/">Dashboard</Link>
              <ChevronRight size={12} />
              <Link to={`/projects/${projectId}`}>Project</Link>
              <ChevronRight size={12} />
              <span>{board.name}</span>
            </div>
            <div className="board-title-row">
              <h1 className="board-title">{board.name}</h1>
              <span className="board-count-pill">
                <ListTodo size={13} />
                {doneCount}/{tasks.length} done
              </span>
            </div>
          </div>

          <div className="board-head-right">
            <AvatarStack users={members} size={30} max={6} />
          </div>
        </div>

        <FilterBar
          filters={filters}
          onChange={setFilters}
          members={members}
          labels={availableLabels}
          total={tasks.length}
          shown={filteredTasks.length}
        />

        {filtersActive && filteredTasks.length === 0 && tasks.length > 0 && (
          <div className="filter-empty">
            <Search size={18} />
            <span>No tasks match your filters.</span>
            <button className="link-btn" onClick={() => setFilters(EMPTY_FILTERS)}>
              Clear filters
            </button>
          </div>
        )}

        <div className="kanban">
          {lists.map((list) => {
            const listTasks = tasksIn(list.id);
            return (
              <div
                key={list.id}
                className={`kanban-col ${dropTarget === `list-${list.id}` ? 'drop-active' : ''}`.trim()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropTarget(`list-${list.id}`);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget))
                    setDropTarget((d) => (d === `list-${list.id}` ? null : d));
                }}
                onDrop={(e) => onDrop(e, list.id, null)}
              >
                <div className="kanban-col-head">
                  <span className="kanban-col-name">{list.name}</span>
                  <span className="col-count">{listTasks.length}</span>
                  {canAdmin && (
                    <button className="icon-btn" title="Delete list" aria-label={`Delete ${list.name}`} onClick={() => deleteList(list.id)}>
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="kanban-col-body">
                  {listTasks.map((t) => (
                    <div
                      key={t.id}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDropTarget(`task-${t.id}`);
                      }}
                      onDrop={(e) => {
                        e.stopPropagation();
                        onDrop(e, list.id, t.id);
                      }}
                    >
                      <TaskCard
                        task={t}
                        dragging={drag?.id === t.id}
                        canDrag={canDrag}
                        onOpen={setOpenTaskId}
                        onDragStart={onDragStart}
                        onDragEnd={() => {
                          setDrag(null);
                          setDropTarget(null);
                        }}
                      />
                    </div>
                  ))}

                  {addingTo === list.id ? (
                    <form className="quick-add" onSubmit={addTask}>
                      <textarea
                        rows={2}
                        autoFocus
                        value={quickTitle}
                        onChange={(e) => setQuickTitle(e.target.value)}
                        placeholder="Task title"
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setAddingTo(null);
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            addTask(e);
                          }
                        }}
                      />
                      <div className="row-actions">
                        <button className="btn small primary">Add task</button>
                        <button type="button" className="btn small" onClick={() => setAddingTo(null)}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      className="add-card-btn"
                      onClick={() => {
                        setAddingTo(list.id);
                        setQuickTitle('');
                      }}
                    >
                      + Add a task
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <form className="kanban-col add-col" onSubmit={addList}>
            <input
              value={newList}
              onChange={(e) => setNewList(e.target.value)}
              placeholder="+ Add another list"
              aria-label="New list name"
            />
          </form>
        </div>
      </main>

      {openTaskId && (
        <TaskModal
          taskId={openTaskId}
          members={members}
          projectId={projectId}
          onChanged={upsertTask}
          onDeleted={(id) => setTasks((prev) => prev.filter((t) => t.id !== id))}
          onClose={() => setOpenTaskId(null)}
        />
      )}
    </>
  );
}
