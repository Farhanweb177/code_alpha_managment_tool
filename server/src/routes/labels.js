import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { emitToProject, logActivity } from '../realtime.js';

const router = Router();
router.use(requireAuth);

function getProjectIdFromTask(taskId) {
  const row = db
    .prepare('SELECT b.project_id FROM tasks t JOIN boards b ON b.id = t.board_id WHERE t.id = ?')
    .get(taskId);
  return row?.project_id || null;
}

function isMember(projectId, userId) {
  return db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, userId);
}

// Labels
router.get('/projects/:projectId/labels', (req, res) => {
  const projectId = Number(req.params.projectId);
  if (!isMember(projectId, req.user.id)) return res.status(404).json({ error: 'Project not found' });
  const labels = db.prepare('SELECT * FROM labels WHERE project_id = ? ORDER BY id').all(projectId);
  res.json({ labels });
});

router.post('/projects/:projectId/labels', (req, res) => {
  const projectId = Number(req.params.projectId);
  const member = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, req.user.id);
  if (!member || !['owner', 'admin'].includes(member.role)) return res.status(403).json({ error: 'Requires admin permissions' });
  const { name, color } = req.body || {};
  const trimmed = (name || '').trim();
  if (!trimmed) return res.status(400).json({ error: 'Label name is required' });
  try {
    const info = db.prepare('INSERT INTO labels (project_id, name, color) VALUES (?, ?, ?)').run(projectId, trimmed, color || '#6366f1');
    const label = db.prepare('SELECT * FROM labels WHERE id = ?').get(info.lastInsertRowid);
    emitToProject(projectId, 'label:created', label);
    res.status(201).json({ label });
  } catch (e) {
    res.status(409).json({ error: 'Label already exists' });
  }
});

router.delete('/labels/:id', (req, res) => {
  const id = Number(req.params.id);
  const label = db.prepare('SELECT * FROM labels WHERE id = ?').get(id);
  if (!label) return res.status(404).json({ error: 'Label not found' });
  const member = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(label.project_id, req.user.id);
  if (!member || !['owner', 'admin'].includes(member.role)) return res.status(403).json({ error: 'Requires admin permissions' });
  db.prepare('DELETE FROM labels WHERE id = ?').run(id);
  emitToProject(label.project_id, 'label:deleted', { id });
  res.json({ ok: true });
});

// Subtasks
router.get('/tasks/:taskId/subtasks', (req, res) => {
  const taskId = Number(req.params.taskId);
  const pid = getProjectIdFromTask(taskId);
  if (!pid || !isMember(pid, req.user.id)) return res.status(404).json({ error: 'Task not found' });
  const subtasks = db.prepare('SELECT * FROM subtasks WHERE task_id = ? ORDER BY position, id').all(taskId);
  res.json({ subtasks });
});

router.post('/tasks/:taskId/subtasks', (req, res) => {
  const taskId = Number(req.params.taskId);
  const pid = getProjectIdFromTask(taskId);
  if (!pid || !isMember(pid, req.user.id)) return res.status(404).json({ error: 'Task not found' });
  const { title } = req.body || {};
  const trimmed = (title || '').trim();
  if (!trimmed) return res.status(400).json({ error: 'Title is required' });
  const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) AS p FROM subtasks WHERE task_id = ?').get(taskId).p;
  const info = db.prepare('INSERT INTO subtasks (task_id, title, position) VALUES (?, ?, ?)').run(taskId, trimmed, maxPos + 1);
  const subtask = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(info.lastInsertRowid);
  emitToProject(pid, 'subtask:created', { taskId, subtask });
  res.status(201).json({ subtask });
});

router.patch('/subtasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const subtask = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(id);
  if (!subtask) return res.status(404).json({ error: 'Subtask not found' });
  const pid = getProjectIdFromTask(subtask.task_id);
  if (!pid || !isMember(pid, req.user.id)) return res.status(404).json({ error: 'Subtask not found' });
  const { title, completed, position } = req.body || {};
  const nextTitle = title === undefined ? subtask.title : String(title).trim();
  if (title !== undefined && !nextTitle) return res.status(400).json({ error: 'Title cannot be empty' });
  const nextCompleted = completed === undefined ? subtask.completed : (completed ? 1 : 0);
  const nextPos = position === undefined ? subtask.position : Number(position);
  db.prepare('UPDATE subtasks SET title = ?, completed = ?, position = ? WHERE id = ?').run(nextTitle, nextCompleted, nextPos, id);
  const updated = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(id);
  emitToProject(pid, 'subtask:updated', { taskId: subtask.task_id, subtask: updated });
  res.json({ subtask: updated });
});

router.delete('/subtasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const subtask = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(id);
  if (!subtask) return res.status(404).json({ error: 'Subtask not found' });
  const pid = getProjectIdFromTask(subtask.task_id);
  if (!pid || !isMember(pid, req.user.id)) return res.status(404).json({ error: 'Subtask not found' });
  db.prepare('DELETE FROM subtasks WHERE id = ?').run(id);
  emitToProject(pid, 'subtask:deleted', { taskId: subtask.task_id, id });
  res.json({ ok: true });
});

// Task labels
router.get('/tasks/:taskId/labels', (req, res) => {
  const taskId = Number(req.params.taskId);
  const pid = getProjectIdFromTask(taskId);
  if (!pid || !isMember(pid, req.user.id)) return res.status(404).json({ error: 'Task not found' });
  const labels = db
    .prepare(`SELECT l.* FROM task_labels tl JOIN labels l ON l.id = tl.label_id WHERE tl.task_id = ? ORDER BY l.id`)
    .all(taskId);
  res.json({ labels });
});

router.post('/tasks/:taskId/labels', (req, res) => {
  const taskId = Number(req.params.taskId);
  const pid = getProjectIdFromTask(taskId);
  if (!pid || !isMember(pid, req.user.id)) return res.status(404).json({ error: 'Task not found' });
  const { labelId } = req.body || {};
  const label = db.prepare('SELECT * FROM labels WHERE id = ? AND project_id = ?').get(Number(labelId), pid);
  if (!label) return res.status(404).json({ error: 'Label not found' });
  db.prepare('INSERT OR IGNORE INTO task_labels (task_id, label_id) VALUES (?, ?)').run(taskId, label.id);
  emitToProject(pid, 'tasklabel:added', { taskId, label });
  logActivity(pid, req.user.id, 'task.labelled', { taskId, labelName: label.name });
  res.status(201).json({ label });
});

router.delete('/tasks/:taskId/labels/:labelId', (req, res) => {
  const taskId = Number(req.params.taskId);
  const labelId = Number(req.params.labelId);
  const pid = getProjectIdFromTask(taskId);
  if (!pid || !isMember(pid, req.user.id)) return res.status(404).json({ error: 'Task not found' });
  db.prepare('DELETE FROM task_labels WHERE task_id = ? AND label_id = ?').run(taskId, labelId);
  emitToProject(pid, 'tasklabel:removed', { taskId, labelId });
  res.json({ ok: true });
});

export default router;
