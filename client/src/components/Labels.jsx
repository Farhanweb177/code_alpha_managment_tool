import React, { useEffect, useState } from 'react';
import { api } from '../api';

export function useLabels(projectId) {
  const [labels, setLabels] = useState([]);
  const refresh = () => {
    if (!projectId) return;
    api(`/projects/${projectId}/labels`).then((d) => setLabels(d.labels)).catch(() => {});
  };
  useEffect(refresh, [projectId]);
  return { labels, refresh, setLabels };
}

export function LabelPicker({ projectId, taskId, taskLabels = [], members = [], onChange }) {
  const [labels, setLabels] = useState(taskLabels);
  const [all, setAll] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => setLabels(taskLabels), [taskLabels]);

  const load = () => {
    api(`/projects/${projectId}/labels`).then((d) => setAll(d.labels)).catch(() => {});
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const toggle = async (label) => {
    const has = labels.some((l) => l.id === label.id);
    if (has) {
      setLabels((prev) => prev.filter((l) => l.id !== label.id));
      await api(`/tasks/${taskId}/labels/${label.id}`, { method: 'DELETE' });
    } else {
      setLabels((prev) => [...prev, label]);
      await api(`/tasks/${taskId}/labels`, { method: 'POST', body: { labelId: label.id } });
    }
    onChange?.();
  };

  return (
    <div className="label-picker">
      <div className="label-list-inline">
        {labels.map((l) => (
          <span key={l.id} className="label-chip" style={{ background: l.color + '22', color: l.color, borderColor: l.color + '55' }}>
            {l.name}
          </span>
        ))}
        <button className="btn small" onClick={() => setOpen((o) => !o)}>+ Labels</button>
      </div>
      {open && (
        <div className="label-menu">
          {all.map((l) => (
            <button key={l.id} className="label-option" onClick={() => toggle(l)}>
              <span className="label-dot" style={{ background: l.color }} />
              {l.name}
              {labels.some((x) => x.id === l.id) && <span className="check">✓</span>}
            </button>
          ))}
          {all.length === 0 && <div className="empty-note">No labels yet. Create them in project settings.</div>}
        </div>
      )}
    </div>
  );
}
