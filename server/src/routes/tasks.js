import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireProject, requireTask, getMembership } from '../middleware/auth.js';
import { emitToProject, emitToBoard, notifyUsers, logActivity } from '../realtime.js';

const router = Router();
router.use(requireAuth);

const ROLE_RANK = { member: 1, admin: 2, owner: 3 };

function boardProjectId(boardId) {
  const row = db.prepare('SELECT project_id FROM boards WHERE id = ?').get(boardId);
  return row ? row.project_id : null;
}

function listProjectId(listId) {
  const row = db
    .prepare('SELECT b.project_id AS project_id FROM task_lists l JOIN boards b ON b.id = l.board_id WHERE l.id = ?')
    .get(listId);
  return row ? row.project_id : null;
}

function assertBoardAccess(boardId, user, minRole = 'member') {
  const projectId = boardProjectId(boardId);
  if (!projectId) return { error: 'Board not found', status: 404 };
  const member = getMembership(projectId, user.id);
  if (!member) return { error: 'Board not found or you are not a member', status: 404 };
  if (ROLE_RANK[member.role] < ROLE_RANK[minRole]) return { error: `Requires ${minRole} permissions`, status: 403 };
  return { projectId, member };
}

function assertListAccess(listId, user, minRole = 'member') {
  const projectId = listProjectId(listId);
  if (!projectId) return { error: 'List not found', status: 404 };
  const member = getMembership(projectId, user.id);
  if (!member) return { error: 'List not found or you are not a member', status: 404 };
  if (ROLE_RANK[member.role] < ROLE_RANK[minRole]) return { error: `Requires ${minRole} permissions`, status: 403 };
  return { projectId, member };
}

function userBrief(row) {
  return { id: row.id, username: row.username, displayName: row.display_name, avatarColor: row.avatar_color };
}

function assigneesForTasks(taskIds) {
  if (!taskIds.length) return new Map();
  const placeholders = taskIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT ta.task_id, u.* FROM task_assignees ta JOIN users u ON u.id = ta.user_id
       WHERE ta.task_id IN (${placeholders}) ORDER BY u.username`
    )
    .all(...taskIds);
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.task_id)) map.set(r.task_id, []);
    map.get(r.task_id).push(userBrief(r));
  }
  return map;
}

function commentCountsForTasks(taskIds) {
  if (!taskIds.length) return new Map();
  const placeholders = taskIds.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT task_id, COUNT(*) AS c FROM comments WHERE task_id IN (${placeholders}) GROUP BY task_id`)
    .all(...taskIds);
  return new Map(rows.map((r) => [r.task_id, r.c]));
}

function serializeTask(row, assigneeMap, commentCounts) {
  return {
    id: row.id,
    boardId: row.board_id,
    listId: row.list_id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    dueDate: row.due_date,
    position: row.position,
    completed: !!row.completed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: { id: row.creator_id, username: row.creator_username, displayName: row.creator_name, avatarColor: row.creator_color },
    assignees: assigneeMap.get(row.id) || [],
    commentCount: commentCounts.get(row.id) || 0,
    labels: taskLabelsMap.get(row.id) || [],
    subtaskCount: subtaskCounts.get(row.id) || 0,
    subtaskDone: subtaskDoneCounts.get(row.id) || 0,
  };
}

const TASK_SELECT = `
  SELECT t.*, u.id AS creator_id, u.username AS creator_username, u.display_name AS creator_name, u.avatar_color AS creator_color
  FROM tasks t JOIN users u ON u.id = t.created_by
`;

let taskLabelsMap = new Map();
let subtaskCounts = new Map();
let subtaskDoneCounts = new Map();

function enrichTasks(rows) {
  if (!rows.length) {
    taskLabelsMap = new Map();
    subtaskCounts = new Map();
    subtaskDoneCounts = new Map();
    return [];
  }
  const assignees = assigneesForTasks(rows.map((r) => r.id));
  const counts = commentCountsForTasks(rows.map((r) => r.id));
  const taskIds = rows.map((r) => r.id);
  const ph = taskIds.map(() => '?').join(',');
  const labelRows = db
    .prepare(`SELECT tl.task_id, l.* FROM task_labels tl JOIN labels l ON l.id = tl.label_id WHERE tl.task_id IN (${ph})`)
    .all(...taskIds);
  taskLabelsMap = new Map();
  for (const lr of labelRows) {
    if (!taskLabelsMap.has(lr.task_id)) taskLabelsMap.set(lr.task_id, []);
    taskLabelsMap.get(lr.task_id).push({ id: lr.id, projectId: lr.project_id, name: lr.name, color: lr.color });
  }
  const sc = db.prepare(`SELECT task_id, COUNT(*) AS c FROM subtasks WHERE task_id IN (${ph}) GROUP BY task_id`).all(...taskIds);
  const sdc = db.prepare(`SELECT task_id, COUNT(*) AS c FROM subtasks WHERE task_id IN (${ph}) AND completed = 1 GROUP BY task_id`).all(...taskIds);
  subtaskCounts = new Map(sc.map((r) => [r.task_id, r.c]));
  subtaskDoneCounts = new Map(sdc.map((r) => [r.task_id, r.c]));
  return rows.map((r) => serializeTask(r, assignees, counts));
}

function tasksInBoard(boardId) {
  const rows = db
    .prepare(TASK_SELECT + ' WHERE t.board_id = ? ORDER BY t.position, t.id')
    .all(boardId);
  return enrichTasks(rows);
}

function singleTask(taskId) {
  const row = db.prepare(TASK_SELECT + ' WHERE t.id = ?').get(taskId);
  if (!row) return null;
  return enrichTasks([row])[0];
}

function projectMemberIds(projectId) {
  return db.prepare('SELECT user_id FROM project_members WHERE project_id = ?').all(projectId).map((r) => r.user_id);
}

function projectMemberNames(projectId) {
  return db
    .prepare(
      'SELECT u.username FROM project_members pm JOIN users u ON u.id = pm.user_id WHERE pm.project_id = ?'
    )
    .all(projectId)
    .map((r) => r.username.toLowerCase());
}

// ---------- Boards ----------

router.get('/boards/:id', (req, res) => {
  const boardId = Number(req.params.id);
  const access = assertBoardAccess(boardId, req.user);
  if (access.error) return res.status(access.status).json({ error: access.error });
  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(boardId);
  const lists = db
    .prepare('SELECT * FROM task_lists WHERE board_id = ? ORDER BY position, id')
    .all(boardId);
  const tasks = tasksInBoard(boardId);
  res.json({
    board: { id: board.id, projectId: board.project_id, name: board.name, position: board.position },
    lists: lists.map((l) => ({ id: l.id, name: l.name, position: l.position })),
    tasks,
  });
});

router.post('/boards', (req, res) => {
  const { projectId, name } = req.body || {};
  const trimmed = (name || '').trim();
  if (!trimmed) return res.status(400).json({ error: 'Board name is required' });
  const access = assertBoardAccess(projectId, req.user, 'admin');
  if (access.error) return res.status(access.status).json({ error: access.error });
  const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) AS p FROM boards WHERE project_id = ?').get(projectId).p;
  const info = db
    .prepare('INSERT INTO boards (project_id, name, position) VALUES (?, ?, ?)')
    .run(projectId, trimmed, maxPos + 1);
  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(info.lastInsertRowid);
  logActivity(projectId, req.user.id, 'board.created', { name: trimmed });
  emitToProject(projectId, 'board:created', { id: board.id, projectId, name: board.name, position: board.position });
  res.status(201).json({ board: { id: board.id, projectId, name: board.name, position: board.position } });
});

router.patch('/boards/:id', (req, res) => {
  const boardId = Number(req.params.id);
  const access = assertBoardAccess(boardId, req.user, 'admin');
  if (access.error) return res.status(access.status).json({ error: access.error });
  const { name } = req.body || {};
  const trimmed = (name || '').trim();
  if (!trimmed) return res.status(400).json({ error: 'Board name is required' });
  db.prepare('UPDATE boards SET name = ? WHERE id = ?').run(trimmed, boardId);
  emitToProject(access.projectId, 'board:updated', { id: boardId, name: trimmed });
  res.json({ ok: true });
});

router.delete('/boards/:id', (req, res) => {
  const boardId = Number(req.params.id);
  const access = assertBoardAccess(boardId, req.user, 'admin');
  if (access.error) return res.status(access.status).json({ error: access.error });
  const count = db.prepare('SELECT COUNT(*) AS c FROM boards WHERE project_id = ?').get(access.projectId).c;
  if (count <= 1) return res.status(400).json({ error: 'A project must keep at least one board' });
  db.prepare('DELETE FROM boards WHERE id = ?').run(boardId);
  emitToProject(access.projectId, 'board:deleted', { id: boardId });
  res.json({ ok: true });
});

// ---------- Lists ----------

router.post('/boards/:id/lists', (req, res) => {
  const boardId = Number(req.params.id);
  const access = assertBoardAccess(boardId, req.user);
  if (access.error) return res.status(access.status).json({ error: access.error });
  const { name } = req.body || {};
  const trimmed = (name || '').trim();
  if (!trimmed) return res.status(400).json({ error: 'List name is required' });
  const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) AS p FROM task_lists WHERE board_id = ?').get(boardId).p;
  const info = db
    .prepare('INSERT INTO task_lists (board_id, name, position) VALUES (?, ?, ?)')
    .run(boardId, trimmed, maxPos + 1);
  const list = db.prepare('SELECT * FROM task_lists WHERE id = ?').get(info.lastInsertRowid);
  emitToProject(access.projectId, 'list:created', { id: list.id, boardId, name: list.name, position: list.position });
  res.status(201).json({ list: { id: list.id, boardId, name: list.name, position: list.position } });
});

router.patch('/lists/:id', (req, res) => {
  const listId = Number(req.params.id);
  const access = assertListAccess(listId, req.user);
  if (access.error) return res.status(access.status).json({ error: access.error });
  const { name, position } = req.body || {};
  const list = db.prepare('SELECT * FROM task_lists WHERE id = ?').get(listId);
  const nextName = name === undefined ? list.name : String(name).trim();
  if (!nextName) return res.status(400).json({ error: 'List name is required' });
  const nextPos = position === undefined ? list.position : Number(position);
  db.prepare('UPDATE task_lists SET name = ?, position = ? WHERE id = ?').run(nextName, nextPos, listId);
  emitToProject(access.projectId, 'list:updated', { id: listId, boardId: list.board_id, name: nextName, position: nextPos });
  res.json({ ok: true });
});

router.delete('/lists/:id', (req, res) => {
  const listId = Number(req.params.id);
  const access = assertListAccess(listId, req.user);
  if (access.error) return res.status(access.status).json({ error: access.error });
  const list = db.prepare('SELECT * FROM task_lists WHERE id = ?').get(listId);
  const count = db.prepare('SELECT COUNT(*) AS c FROM task_lists WHERE board_id = ?').get(list.board_id).c;
  if (count <= 1) return res.status(400).json({ error: 'A board must keep at least one list' });
  db.prepare('DELETE FROM task_lists WHERE id = ?').run(listId);
  emitToProject(access.projectId, 'list:deleted', { id: listId, boardId: list.board_id });
  res.json({ ok: true });
});

// ---------- Tasks ----------

router.post('/lists/:id/tasks', (req, res) => {
  const listId = Number(req.params.id);
  const access = assertListAccess(listId, req.user);
  if (access.error) return res.status(access.status).json({ error: access.error });
  const { title } = req.body || {};
  const trimmed = (title || '').trim();
  if (!trimmed || trimmed.length > 200) return res.status(400).json({ error: 'Task title must be 1-200 characters' });
  const list = db.prepare('SELECT * FROM task_lists WHERE id = ?').get(listId);
  const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) AS p FROM tasks WHERE list_id = ?').get(listId).p;
  const info = db
    .prepare('INSERT INTO tasks (board_id, list_id, title, position, created_by) VALUES (?, ?, ?, ?, ?)')
    .run(list.board_id, listId, trimmed, maxPos + 1, req.user.id);
  logActivity(access.projectId, req.user.id, 'task.created', { taskId: info.lastInsertRowid, title: trimmed, listName: list.name });
  const task = singleTask(info.lastInsertRowid);
  emitToProject(access.projectId, 'task:created', task);
  res.status(201).json({ task });
});

router.get('/tasks/:id', requireTask('member'), (req, res) => {
  const task = singleTask(req.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json({ task });
});

router.patch('/tasks/:id', requireTask('member'), (req, res) => {
  const body = req.body || {};
  const current = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.taskId);
  const fields = {};
  if (body.title !== undefined) {
    const t = String(body.title).trim();
    if (!t) return res.status(400).json({ error: 'Title cannot be empty' });
    fields.title = t;
  }
  if (body.description !== undefined) fields.description = String(body.description);
  if (body.priority !== undefined) {
    if (!['low', 'medium', 'high', 'urgent'].includes(body.priority))
      return res.status(400).json({ error: 'Invalid priority' });
    fields.priority = body.priority;
  }
  if (body.dueDate !== undefined) fields.due_date = body.dueDate ? String(body.dueDate) : null;
  if (body.completed !== undefined) fields.completed = body.completed ? 1 : 0;

  const movedToOtherList = body.listId !== undefined && Number(body.listId) !== current.list_id;
  if (movedToOtherList) {
    const access = assertListAccess(Number(body.listId), req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (access.projectId !== req.projectId) return res.status(400).json({ error: 'Cannot move a task to another project' });
    fields.list_id = Number(body.listId);
  }
  if (body.position !== undefined) fields.position = Number(body.position);

  const keys = Object.keys(fields);
  if (keys.length) {
    const sets = keys.map((k) => `${k} = ?`).join(', ');
    db.prepare(`UPDATE tasks SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(
      ...keys.map((k) => fields[k]),
      req.taskId
    );
  }

  const task = singleTask(req.taskId);
  if (movedToOtherList) {
    const list = db.prepare('SELECT name FROM task_lists WHERE id = ?').get(task.listId);
    logActivity(req.projectId, req.user.id, 'task.moved', { taskId: task.id, title: task.title, listName: list?.name });
    emitToProject(req.projectId, 'task:moved', task);
  } else if (keys.length) {
    emitToProject(req.projectId, 'task:updated', task);
  }
  res.json({ task });
});

router.delete('/tasks/:id', requireTask('member'), (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.taskId);
  emitToProject(req.projectId, 'task:deleted', { id: req.taskId });
  res.json({ ok: true });
});

router.post('/tasks/:id/assignees', requireTask('member'), (req, res) => {
  const { userId } = req.body || {};
  const targetId = Number(userId);
  const member = getMembership(req.projectId, targetId);
  if (!member) return res.status(400).json({ error: 'User is not a member of this project' });
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.taskId);
  db.prepare('INSERT OR IGNORE INTO task_assignees (task_id, user_id, assigned_by) VALUES (?, ?, ?)').run(
    req.taskId,
    targetId,
    req.user.id
  );
  const list = db.prepare('SELECT name FROM task_lists WHERE id = ?').get(task.list_id);
  notifyUsers([targetId], {
    type: 'task_assigned',
    actorId: req.user.id,
    payload: { taskId: task.id, title: task.title, listName: list?.name || '', projectId: req.projectId },
  });
  logActivity(req.projectId, req.user.id, 'task.assigned', { taskId: task.id, title: task.title, userId: targetId });
  const updated = singleTask(req.taskId);
  emitToProject(req.projectId, 'task:updated', updated);
  res.json({ task: updated });
});

router.delete('/tasks/:id/assignees/:userId', requireTask('member'), (req, res) => {
  db.prepare('DELETE FROM task_assignees WHERE task_id = ? AND user_id = ?').run(req.taskId, Number(req.params.userId));
  const updated = singleTask(req.taskId);
  emitToProject(req.projectId, 'task:updated', updated);
  res.json({ task: updated });
});

// ---------- Comments ----------

function serializeComment(row) {
  return {
    id: row.id,
    taskId: row.task_id,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    edited: row.created_at !== row.updated_at,
    author: userBrief(row),
  };
}

router.get('/tasks/:id/comments', requireTask('member'), (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.*, u.username, u.display_name, u.avatar_color
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.task_id = ? ORDER BY c.created_at, c.id`
    )
    .all(req.taskId);
  res.json({ comments: rows.map(serializeComment) });
});

router.post('/tasks/:id/comments', requireTask('member'), (req, res) => {
  const body = (req.body?.body || '').trim();
  if (!body || body.length > 5000) return res.status(400).json({ error: 'Comment must be 1-5000 characters' });
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.taskId);
  const info = db
    .prepare('INSERT INTO comments (task_id, user_id, body) VALUES (?, ?, ?)')
    .run(req.taskId, req.user.id, body);
  const row = db
    .prepare(
      `SELECT c.*, u.username, u.display_name, u.avatar_color
       FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?`
    )
    .get(info.lastInsertRowid);
  const comment = serializeComment(row);

  const assigneeIds = db.prepare('SELECT user_id FROM task_assignees WHERE task_id = ?').all(req.taskId).map((r) => r.user_id);
  const mentionedNames = [...new Set([...body.matchAll(/@([a-zA-Z0-9_.-]+)/g)].map((m) => m[1].toLowerCase()))];
  const memberNames = projectMemberNames(req.projectId);
  const mentionedIds = mentionedNames
    .filter((n) => memberNames.includes(n))
    .map(
      (n) =>
        db
          .prepare(
            'SELECT u.id FROM users u JOIN project_members pm ON pm.user_id = u.id WHERE u.username = ? AND pm.project_id = ?'
          )
          .get(n, req.projectId)?.id
    )
    .filter(Boolean);

  notifyUsers([...assigneeIds, task.created_by, ...mentionedIds], {
    type: mentionedIds.length ? 'mention' : 'comment',
    actorId: req.user.id,
    payload: { taskId: task.id, title: task.title, comment: body.slice(0, 200), projectId: req.projectId },
  });

  emitToProject(req.projectId, 'comment:created', comment);
  const updated = singleTask(req.taskId);
  emitToProject(req.projectId, 'task:updated', updated);
  res.status(201).json({ comment });
});

router.patch('/comments/:id', (req, res) => {
  const commentId = Number(req.params.id);
  const row = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);
  if (!row) return res.status(404).json({ error: 'Comment not found' });
  if (row.user_id !== req.user.id) return res.status(403).json({ error: 'You can only edit your own comments' });
  const body = (req.body?.body || '').trim();
  if (!body) return res.status(400).json({ error: 'Comment cannot be empty' });
  db.prepare("UPDATE comments SET body = ?, updated_at = datetime('now') WHERE id = ?").run(body, commentId);
  const updated = db
    .prepare(
      `SELECT c.*, u.username, u.display_name, u.avatar_color
       FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?`
    )
    .get(commentId);
  const projectId = row.task_id ? taskProject(row.task_id) : null;
  if (projectId) emitToProject(projectId, 'comment:updated', serializeComment(updated));
  res.json({ comment: serializeComment(updated) });
});

router.delete('/comments/:id', (req, res) => {
  const commentId = Number(req.params.id);
  const row = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);
  if (!row) return res.status(404).json({ error: 'Comment not found' });
  const member = getMembership(taskProject(row.task_id), req.user.id);
  if (row.user_id !== req.user.id && (!member || ROLE_RANK[member.role] < ROLE_RANK.admin)) {
    return res.status(403).json({ error: 'You cannot delete this comment' });
  }
  const projectId = taskProject(row.task_id);
  db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
  if (projectId) emitToProject(projectId, 'comment:deleted', { id: commentId, taskId: row.task_id });
  res.json({ ok: true });
});

function taskProject(taskId) {
  const row = db
    .prepare('SELECT b.project_id AS project_id FROM tasks t JOIN boards b ON b.id = t.board_id WHERE t.id = ?')
    .get(taskId);
  return row ? row.project_id : null;
}

export default router;
