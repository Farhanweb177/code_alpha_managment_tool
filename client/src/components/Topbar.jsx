import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useTheme } from '../theme';
import { useSocketEvent } from '../realtime';
import Avatar from './Avatar';
import NotificationsMenu from './NotificationsMenu';
import { Bell, Menu, Moon, Search, Sun, X } from './Icons';

export default function Topbar({ onMenu }) {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const notifRef = useRef(null);
  const isDashboard = location.pathname === '/';

  useEffect(() => {
    api('/notifications')
      .then((d) => setUnread(d.unread))
      .catch(() => {});
  }, []);

  useSocketEvent('notification', () => setUnread((u) => u + 1));

  useEffect(() => {
    const fn = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setNotifOpen(false);
    document.addEventListener('mousedown', fn);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', fn);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const submitSearch = (e) => {
    e.preventDefault();
    const value = q.trim();
    navigate(value ? `/?q=${encodeURIComponent(value)}` : '/');
    setQ('');
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="icon-btn menu-btn" onClick={onMenu} aria-label="Open navigation">
          <Menu size={20} />
        </button>

        {!isDashboard && (
          <form className="topbar-search" onSubmit={submitSearch} role="search">
            <Search size={16} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search projects…"
              aria-label="Search projects"
            />
            {q && (
              <button type="button" className="icon-btn" onClick={() => setQ('')} aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </form>
        )}
      </div>

      <div className="topbar-actions">
        <button
          className="icon-btn topbar-btn"
          onClick={toggle}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
        </button>

        <div className="notif-wrap" ref={notifRef}>
          <button
            className="icon-btn topbar-btn bell"
            onClick={() => setNotifOpen((o) => !o)}
            title="Notifications"
            aria-label="Notifications"
            aria-expanded={notifOpen}
          >
            <Bell size={19} />
            {unread > 0 && <span className="badge">{unread > 9 ? '9+' : unread}</span>}
          </button>
          <NotificationsMenu open={notifOpen} onClose={() => setNotifOpen(false)} onUnreadChange={setUnread} />
        </div>

        <div className="topbar-user" title={`${user?.displayName} (@${user?.username})`}>
          <Avatar user={user} size={32} />
        </div>
      </div>
    </header>
  );
}
