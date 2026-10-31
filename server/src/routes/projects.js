import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireProject, publicUser, getMembership } from '../middleware/auth.js';
import { emitToProject, notifyUsers, logActivity } from '../realtime.js';

const router = Router();
router.use(requireAuth);

const DEFAULT_LISTS = ['To Do', 'In Progress', 'Review', 'Done'];

function projectSummary(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    createdAt: row.created_at,
    role: row.role,
    memberCount: row.member_count,
    taskCount: row.task_count,
    doneTaskCount: row.done_task_count,
    owner: { id: row.owner_id, username: row.owner_username, displayName: row.owner_name, avatarColor: row.owner_color },
  };
}

const SUMMARY_SQL = `
  SELECT p.*, pm.role AS role,
    (SELECT COUNT(*) FROM project_members m WHERE m.project_id = p.id) AS member_count,
    (SELECT COUNT(*) FROM tasks t JOIN boards b ON b.id = t.board_id WHERE b.project_id = p.id) AS task_count,
    (SELECT COUNT(*) FROM tasks t JOIN boards b ON b.id = t.board_id WHERE b.project_id = p.id AND t.completed = 1) AS done_task_count,
    u.id AS owner_id, u.username AS owner_username, u.display_name AS owner_name, u.avatar_color AS owner_color
  FROM projects p
  JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
  JOIN users u ON u.id = p.created_by
`;

router.get('/', (req, res) => {
  const rows = db.prepare(SUMMARY_SQL + ' ORDER BY p.created_at DESC').all(req.user.id);
  res.json({ projects: rows.map(projectSummary) });
});

router.post('/', (req, res) => {
  const { name, description, color } = req.body || {};
  const trimmed = (name || '').trim();
  if (!trimmed || trimmed.length > 80) return res.status(400).json({ error: 'Project name must be 1-80 characters' });

  const result = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO projects (name, description, color, created_by) VALUES (?, ?, ?, ?)')
      .run(trimmed, (description || '').trim(), color || '#6366f1', req.user.id);
    const projectId = info.lastInsertRowid;
    db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(
      projectId,
      req.user.id,
      'owner'
    );
    const boardInfo = db
      .prepare('INSERT INTO boards (project_id, name, position) VALUES (?, ?, 0)')
      .run(projectId, 'Main Board');
    const insertList = db.prepare('INSERT INTO task_lists (board_id, name, position) VALUES (?, ?, ?)');
    DEFAULT_LISTS.forEach((listName, i) => insertList.run(boardInfo.lastInsertRowid, listName, i));
    return projectId;
  })();

  logActivity(result, req.user.id, 'project.created', { name: trimmed });
  const row = db.prepare(SUMMARY_SQL + ' WHERE p.id = ?').get(req.user.id, result);
  res.status(201).json({ project: projectSummary(row) });
});

router.get('/:id', requireProject('member'), (req, res) => {
  const row = db.prepare(SUMMARY_SQL + ' WHERE p.id = ?').get(req.user.id, req.projectId);
  const members = db
    .prepare(
      `SELECT pm.role, pm.joined_at, u.* FROM project_members pm
       JOIN users u ON u.id = pm.user_id WHERE pm.project_id = ?
       ORDER BY CASE pm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.username`
    )
    .all(req.projectId)
    .map((m) => ({ ...publicUser(m), role: m.role, joinedAt: m.joined_at }));
  const boards = db
    .prepare('SELECT id, name, position, created_at FROM boards WHERE project_id = ? ORDER BY position')
    .all(req.projectId)
    .map((b) => ({ id: b.id, name: b.name, position: b.position, createdAt: b.created_at }));
  res.json({ project: projectSummary(row), members, boards });
});

router.patch('/:id', requireProject('admin'), (req, res) => {
  const { name, description, color } = req.body || {};
  const current = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.projectId);
  const nextName = name === undefined ? current.name : String(name).trim();
  if (!nextName || nextName.length > 80) return res.status(400).json({ error: 'Project name must be 1-80 characters' });
  db.prepare('UPDATE projects SET name = ?, description = ?, color = ? WHERE id = ?').run(
    nextName,
    description === undefined ? current.description : String(description).trim(),
    color || current.color,
    req.projectId
  );
  logActivity(req.projectId, req.user.id, 'project.updated', { name: nextName });
  emitToProject(req.projectId, 'project:updated', { id: req.projectId, name: nextName });
  const row = db.prepare(SUMMARY_SQL + ' WHERE p.id = ?').get(req.user.id, req.projectId);
  res.json({ project: projectSummary(row) });
});

router.delete('/:id', requireProject('owner'), (req, res) => {
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.projectId);
  res.json({ ok: true });
});

router.get('/:id/members', requireProject('member'), (req, res) => {
  const members = db
    .prepare(
      `SELECT pm.role, pm.joined_at, u.* FROM project_members pm
       JOIN users u ON u.id = pm.user_id WHERE pm.project_id = ? ORDER BY u.username`
    )
    .all(req.projectId)
    .map((m) => ({ ...publicUser(m), role: m.role, joinedAt: m.joined_at }));
  res.json({ members });
});

router.post('/:id/members', requireProject('admin'), (req, res) => {
  const { username, role } = req.body || {};
  const query = (username || '').trim();
  if (!query) return res.status(400).json({ error: 'Username or email is required' });
  const user = db
    .prepare('SELECT * FROM users WHERE username = ? OR email = ?')
    .get(query, query);
  if (!user) return res.status(404).json({ error: 'No user found with that username or email' });
  if (getMembership(req.projectId, user.id)) return res.status(409).json({ error: 'User is already a member' });
  if (!['member', 'admin'].includes(role)) return res.status(400).json({ error: 'Role must be member or admin' });

  db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(
    req.projectId,
    user.id,
    role
  );
  const project = db.prepare('SELECT name FROM projects WHERE id = ?').get(req.projectId);
  notifyUsers([user.id], {
    type: 'added_to_project',
    actorId: req.user.id,
    payload: { projectId: req.projectId, projectName: project.name, role },
  });
  logActivity(req.projectId, req.user.id, 'member.added', { username: user.username, role });
  emitToProject(req.projectId, 'member:added', { user: publicUser(user), role });
  res.status(201).json({ member: { ...publicUser(user), role } });
});

router.patch('/:id/members/:userId', requireProject('admin'), (req, res) => {
  const targetId = Number(req.params.userId);
  const target = getMembership(req.projectId, targetId);
  if (!target) return res.status(404).json({ error: 'Member not found' });
  if (target.role === 'owner') return res.status(403).json({ error: "The owner's role cannot be changed" });
  const { role } = req.body || {};
  if (!['member', 'admin'].includes(role)) return res.status(400).json({ error: 'Role must be member or admin' });
  db.prepare('UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?').run(
    role,
    req.projectId,
    targetId
  );
  logActivity(req.projectId, req.user.id, 'member.role_changed', { userId: targetId, role });
  emitToProject(req.projectId, 'member:updated', { userId: targetId, role });
  res.json({ ok: true });
});

router.delete('/:id/members/:userId', requireProject('admin'), (req, res) => {
  const targetId = Number(req.params.userId);
  const target = getMembership(req.projectId, targetId);
  if (!target) return res.status(404).json({ error: 'Member not found' });
  if (target.role === 'owner') return res.status(403).json({ error: 'The owner cannot be removed' });
  db.transaction(() => {
    db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(req.projectId, targetId);
    db.prepare(
      `DELETE FROM task_assignees WHERE user_id = ? AND task_id IN
       (SELECT t.id FROM tasks t JOIN boards b ON b.id = t.board_id WHERE b.project_id = ?)`
    ).run(targetId, req.projectId);
  })();
  logActivity(req.projectId, req.user.id, 'member.removed', { userId: targetId });
  emitToProject(req.projectId, 'member:removed', { userId: targetId });
  res.json({ ok: true });
});

router.get('/:id/activities', requireProject('member'), (req, res) => {
  const rows = db
    .prepare(
      `SELECT a.*, u.username, u.display_name, u.avatar_color
       FROM activities a JOIN users u ON u.id = a.actor_id
       WHERE a.project_id = ? ORDER BY a.id DESC LIMIT 50`
    )
    .all(req.projectId);
  res.json({
    activities: rows.map((r) => ({
      id: r.id,
      type: r.type,
      payload: JSON.parse(r.payload),
      createdAt: r.created_at,
      actor: { id: r.actor_id, username: r.username, displayName: r.display_name, avatarColor: r.avatar_color },
    })),
  });
});

export default router;
