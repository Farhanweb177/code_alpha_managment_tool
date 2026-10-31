import { useState } from 'react';
import { Search, SlidersHorizontal, X } from './Icons';

export const EMPTY_FILTERS = {
  q: '',
  assignee: '',
  priority: '',
  label: '',
  due: '',
  status: '',
};

export default function FilterBar({ filters, onChange, members = [], labels = [], total = 0, shown = 0 }) {
  const [expanded, setExpanded] = useState(false);
  const activeCount = ['assignee', 'priority', 'label', 'due', 'status'].filter((k) => filters[k]).length;
  const hasAny = Boolean(filters.q) || activeCount > 0;

  const set = (key) => (e) => onChange({ ...filters, [key]: e.target.value });
  const clear = () => onChange(EMPTY_FILTERS);

  return (
    <div className="board-toolbar">
      <div className="filter-search">
        <Search size={16} />
        <input
          value={filters.q}
          onChange={set('q')}
          placeholder="Search tasks…"
          aria-label="Search tasks"
        />
        {filters.q && (
          <button className="icon-btn filter-clear-q" onClick={() => onChange({ ...filters, q: '' })} aria-label="Clear search">
            <X size={14} />
          </button>
        )}
      </div>

      <button
        className={`btn filter-toggle ${expanded ? 'active' : ''}`.trim()}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <SlidersHorizontal size={15} />
        Filters
        {activeCount > 0 && <span className="filter-count">{activeCount}</span>}
      </button>

      <div className={`filter-advanced ${expanded ? 'open' : ''}`.trim()}>
        <select value={filters.assignee} onChange={set('assignee')} aria-label="Filter by assignee">
          <option value="">All assignees</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </select>

        <select value={filters.priority} onChange={set('priority')} aria-label="Filter by priority">
          <option value="">All priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>

        <select value={filters.label} onChange={set('label')} aria-label="Filter by label">
          <option value="">All labels</option>
          {labels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>

        <select value={filters.status} onChange={set('status')} aria-label="Filter by status">
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="done">Completed</option>
        </select>

        <select value={filters.due} onChange={set('due')} aria-label="Filter by due date">
          <option value="">Any due date</option>
          <option value="overdue">Overdue</option>
          <option value="today">Due today</option>
          <option value="week">Due this week</option>
        </select>

        {hasAny && (
          <button className="btn small ghost" onClick={clear}>
            <X size={14} />
            Clear
          </button>
        )}
      </div>

      <span className="filter-summary muted small-text">
        {hasAny ? `${shown} of ${total} tasks` : `${total} tasks`}
      </span>
    </div>
  );
}
