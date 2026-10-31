import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import db from './db.js';
import { JWT_SECRET } from './middleware/auth.js';

let io = null;

export function initRealtime(httpServer, corsOrigin) {
  io = new Server(httpServer, {
    cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
      if (!user) return next(new Error('User no longer exists'));
      socket.user = { id: user.id, username: user.username, displayName: user.display_name };
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user.id}`);

    socket.on('project:subscribe', (projectId) => {
      const member = db
        .prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?')
        .get(Number(projectId), socket.user.id);
      if (member) socket.join(`project:${Number(projectId)}`);
    });

    socket.on('project:unsubscribe', (projectId) => {
      socket.leave(`project:${Number(projectId)}`);
    });

    socket.on('presence:track', ({ taskId, boardId }) => {
      if (taskId) socket.join(`task:${Number(taskId)}`);
      if (boardId) socket.join(`boardview:${Number(boardId)}`);
    });

    socket.on('presence:untrack', ({ taskId, boardId }) => {
      if (taskId) socket.leave(`task:${Number(taskId)}`);
      if (boardId) socket.leave(`boardview:${Number(boardId)}`);
    });

    socket.on('presence:update', ({ boardId, taskId, viewing }) => {
      if (!boardId && !taskId) return;
      const room = taskId ? `task:${Number(taskId)}` : `boardview:${Number(boardId)}`;
      socket.to(room).emit('presence:update', {
        userId: socket.user.id,
        displayName: socket.user.displayName,
        taskId: taskId ? Number(taskId) : null,
        viewing: !!viewing,
      });
    });
  });

  return io;
}

export function emitToProject(projectId, event, payload) {
  if (io) io.to(`project:${projectId}`).emit(event, payload);
}

export function emitToBoard(boardId, event, payload) {
  if (io) io.to(`boardview:${boardId}`).emit(event, payload);
}

export function emitToTask(taskId, event, payload) {
  if (io) io.to(`task:${taskId}`).emit(event, payload);
}

export function emitToUser(userId, event, payload) {
  if (io) io.to(`user:${userId}`).emit(event, payload);
}

export function notifyUsers(userIds, { type, payload, actorId }) {
  const unique = [...new Set(userIds.filter(Boolean).map(Number))].filter((id) => id !== actorId);
  if (!unique.length) return [];
  const insert = db.prepare(
    "INSERT INTO notifications (user_id, type, payload) VALUES (?, ?, ?)"
  );
  const rows = [];
  for (const userId of unique) {
    const info = insert.run(userId, type, JSON.stringify(payload));
    const row = db.prepare('SELECT * FROM notifications WHERE id = ?').get(info.lastInsertRowid);
    rows.push(row);
    emitToUser(userId, 'notification', {
      id: row.id,
      type: row.type,
      payload: JSON.parse(row.payload),
      read: row.read,
      createdAt: row.created_at,
    });
  }
  return rows;
}

export function logActivity(projectId, actorId, type, payload) {
  const info = db
    .prepare('INSERT INTO activities (project_id, actor_id, type, payload) VALUES (?, ?, ?, ?)')
    .run(projectId, actorId, type, JSON.stringify(payload));
  const row = db
    .prepare(
      `SELECT a.*, u.username, u.display_name, u.avatar_color
       FROM activities a JOIN users u ON u.id = a.actor_id WHERE a.id = ?`
    )
    .get(info.lastInsertRowid);
  const activity = {
    id: row.id,
    projectId: row.project_id,
    type: row.type,
    payload: JSON.parse(row.payload),
    createdAt: row.created_at,
    actor: { id: row.actor_id, username: row.username, displayName: row.display_name, avatarColor: row.avatar_color },
  };
  emitToProject(projectId, 'activity:new', activity);
  return activity;
}
