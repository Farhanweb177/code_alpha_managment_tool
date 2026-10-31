import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useSocketEvent } from '../realtime';
import Avatar from './Avatar';
import { Spinner } from './Skeleton';
import { Bell } from './Icons';

function timeAgo(iso) {
  if (!iso) return '';
  const then = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  const s = Math.max(1, Math.floor((Date.now() - then.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function describe(n) {
  const p = n.payload || {};
  switch (n.type) {
    case 'task_assigned':
      return { text: `assigned you to “${p.title}”`, to: p.projectId ? `/projects/${p.projectId}` : null };
    case 'comment':
      return { text: `commented on “${p.title}”: ${p.comment}`, to: p.projectId ? `/projects/${p.projectId}` : null };
    case 'mention':
      return { text: `mentioned you in “${p.title}”: ${p.comment}`, to: p.projectId ? `/projects/${p.projectId}` : null };
    case 'added_to_project':
      return { text: `added you to “${p.projectName}” as ${p.role}`, to: `/projects/${p.projectId}` };
    default:
      return { text: n.type, to: null };
  }
}

export default function NotificationsMenu({ open, onClose, onUnreadChange }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    api('/notifications')
      .then((d) => {
        setItems(d.notifications);
        setUnread(d.unread);
        onUnreadChange?.(d.unread);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  useSocketEvent('notification', (n) => {
    setItems((prev) => [n, ...prev].slice(0, 50));
    setUnread((u) => u + 1);
  });

  if (!open) return null;

  const markAll = async () => {
    await api('/notifications/read-all', { method: 'POST' }).catch(() => {});
    setUnread(0);
    onUnreadChange?.(0);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const click = async (n) => {
    if (!n.read) {
      await api(`/notifications/${n.id}/read`, { method: 'POST' }).catch(() => {});
      setUnread((u) => Math.max(0, u - 1));
      onUnreadChange?.(Math.max(0, unread - 1));
    }
    const { to } = describe(n);
    onClose();
    if (to) navigate(to);
  };

  return (
    <div className="notif-panel">
      <div className="notif-head">
        <strong>Notifications</strong>
        {unread > 0 && (
          <button className="link-btn" onClick={markAll}>
            Mark all read
          </button>
        )}
      </div>
      <div className="notif-list">
        {loading && (
          <div className="notif-loading">
            <Spinner size={18} />
            <span className="muted small-text">Loading notifications…</span>
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="notif-empty">
            <Bell size={22} />
            <span>You’re all caught up</span>
            <span className="muted small-text">New mentions and assignments will show up here.</span>
          </div>
        )}
        {!loading &&
          items.map((n) => {
            const d = describe(n);
            return (
              <button key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`} onClick={() => click(n)}>
                <Avatar
                  user={{
                    displayName: n.payload?.title || 'T',
                    avatarColor: n.payload?.actorColor || '#6366f1',
                    username: '',
                  }}
                  size={30}
                  title=""
                />
                <span className="notif-text">
                  <strong>{n.type.replace(/_/g, ' ')}</strong> — {d.text}
                  <em>{timeAgo(n.createdAt)}</em>
                </span>
              </button>
            );
          })}
      </div>
    </div>
  );
}
