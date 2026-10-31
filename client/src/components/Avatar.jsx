export default function Avatar({ user, size = 28, title }) {
  if (!user) return null;
  const initial = (user.displayName || user.username || '?').trim()[0]?.toUpperCase() || '?';
  return (
    <span
      className="avatar"
      title={title || `${user.displayName || user.username} (@${user.username})`}
      style={{
        width: size,
        height: size,
        background: user.avatarColor || '#6366f1',
        fontSize: size * 0.42,
      }}
    >
      {initial}
    </span>
  );
}

export function AvatarStack({ users, size = 26, max = 4 }) {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <span className="avatar-stack">
      {shown.map((u) => (
        <Avatar key={u.id} user={u} size={size} />
      ))}
      {extra > 0 && (
        <span className="avatar avatar-more" style={{ width: size, height: size, fontSize: size * 0.36 }}>
          +{extra}
        </span>
      )}
    </span>
  );
}
