import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { getSocket } from '../socket';

export default function Subtasks({ taskId, onUpdate }) {
  const [subtasks, setSubtasks] = useState([]);
  const [title, setTitle] = useState('');
  const [adding, setAdding] = useState(false);

  const load = () => {
    api(`/tasks/${taskId}/subtasks`).then((d) => setSubtasks(d.subtasks)).catch(() => {});
  };

  useEffect(load, [taskId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    const onCreated = (p) => p.taskId === Number(taskId) && setSubtasks((prev) => [...prev, p.subtask]);
    const onUpdated = (p) => p.taskId === Number(taskId) && setSubtasks((prev) => prev.map((s) => (s.id === p.subtask.id ? p.subtask : s)));
    const onDeleted = (p) => p.taskId === Number(taskId) && setSubtasks((prev) => prev.filter((s) => s.id !== p.id));
    socket.on('subtask:created', onCreated);
    socket.on('subtask:updated', onUpdated);
    socket.on('subtask:deleted', onDeleted);
    return () => {
      socket.off('subtask:created', onCreated);
      socket.off('subtask:updated', onUpdated);
      socket.off('subtask:deleted', onDeleted);
    };
  }, [taskId]);

  const add = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    const t = title.trim();
    setTitle('');
    setAdding(false);
    const d = await api(`/tasks/${taskId}/subtasks`, { method: 'POST', body: { title: t } });
    setSubtasks((prev) => [...prev, d.subtask]);
    onUpdate?.();
  };

  const toggle = async (s) => {
    setSubtasks((prev) => prev.map((x) => (x.id === s.id ? { ...x, completed: s.completed ? 0 : 1 } : x)));
    await api(`/subtasks/${s.id}`, { method: 'PATCH', body: { completed: !s.completed } });
    onUpdate?.();
  };

  const rename = async (s, val) => {
    const v = val.trim();
    if (!v) return;
    await api(`/subtasks/${s.id}`, { method: 'PATCH', body: { title: v } });
    onUpdate?.();
  };

  const remove = async (s) => {
    setSubtasks((prev) => prev.filter((x) => x.id !== s.id));
    await api(`/subtasks/${s.id}`, { method: 'DELETE' });
    onUpdate?.();
  };

  const done = subtasks.filter((s) => s.completed).length;
  const pct = subtasks.length ? Math.round((done / subtasks.length) * 100) : 0;

  return (
    <section>
      <div className="section-head">
        <h4>Checklist</h4>
        <span className="muted">{done}/{subtasks.length}</span>
      </div>
      {subtasks.length > 0 && (
        <div className="progress small">
          <div className="progress-bar" style={{ width: `${pct}%` }} />
        </div>
      )}
      <div className="subtask-list">
        {subtasks.map((s) => (
          <div key={s.id} className="subtask-row">
            <input type="checkbox" checked={!!s.completed} onChange={() => toggle(s)} />
            <input
              className={`subtask-input ${s.completed ? 'done' : ''}`}
              defaultValue={s.title}
              onBlur={(e) => e.target.value !== s.title && rename(s, e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
            />
            <button className="icon-btn" onClick={() => remove(s)}>✕</button>
          </div>
        ))}
      </div>
      {adding ? (
        <form className="subtask-add" onSubmit={add}>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add an item" />
          <div className="row-actions">
            <button className="btn small primary">Add</button>
            <button type="button" className="btn small" onClick={() => { setAdding(false); setTitle(''); }}>Cancel</button>
          </div>
        </form>
      ) : (
        <button className="btn small" onClick={() => setAdding(true)}>+ Add item</button>
      )}
    </section>
  );
}
