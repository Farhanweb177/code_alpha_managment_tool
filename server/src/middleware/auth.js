import jwt from 'jsonwebtoken';
import db from '../db.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'taskflow-dev-secret-change-in-production';

export function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
}

export function publicUser(row) {
  if (!row) return null;
  const { id, username, email, display_name, avatar_color, created_at } = row;
  return { id, username, email, displayName: display_name, avatarColor: avatar_color, createdAt: created_at };
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
    if (!user) return res.status(401).json({ error: 'User no longer exists' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

const ROLE_RANK = { member: 1, admin: 2, owner: 3 };

export function getMembership(projectId, userId) {
  return db
    .prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?')
    .get(projectId, userId);
}

export function requireProject(minRole = 'member') {
  return (req, res, next) => {
    const projectId = Number(req.params.id || req.params.projectId);
    const member = getMembership(projectId, req.user.id);
    if (!member) return res.status(404).json({ error: 'Project not found or you are not a member' });
    if (ROLE_RANK[member.role] < ROLE_RANK[minRole]) {
      return res.status(403).json({ error: `Requires ${minRole} permissions` });
    }
    req.projectId = projectId;
    req.membership = member;
    next();
  };
}

export function taskProjectId(taskId) {
  const row = db
    .prepare(
      `SELECT t.board_id AS taskId, b.project_id AS projectId
       FROM tasks t JOIN boards b ON b.id = t.board_id WHERE t.id = ?`
    )
    .get(taskId);
  return row ? row.projectId : null;
}

export function requireTask(minRole = 'member') {
  return (req, res, next) => {
    const taskId = Number(req.params.id || req.params.taskId);
    const projectId = taskProjectId(taskId);
    if (!projectId) return res.status(404).json({ error: 'Task not found' });
    const member = getMembership(projectId, req.user.id);
    if (!member) return res.status(404).json({ error: 'Task not found or you are not a member' });
    if (ROLE_RANK[member.role] < ROLE_RANK[minRole]) {
      return res.status(403).json({ error: `Requires ${minRole} permissions` });
    }
    req.taskId = taskId;
    req.projectId = projectId;
    req.membership = member;
    next();
  };
}
