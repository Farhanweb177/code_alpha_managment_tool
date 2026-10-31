import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { signToken, requireAuth, publicUser } from '../middleware/auth.js';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PALETTE = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6'];

router.post('/register', (req, res) => {
  const { username, email, password, displayName } = req.body || {};
  if (!username || !/^[a-zA-Z0-9_.-]{3,24}$/.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-24 chars (letters, numbers, _ . -)' });
  }
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Valid email is required' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const exists = db
    .prepare('SELECT id FROM users WHERE username = ? OR email = ?')
    .get(username, email);
  if (exists) return res.status(409).json({ error: 'Username or email is already taken' });

  const hash = bcrypt.hashSync(password, 10);
  const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
  const info = db
    .prepare(
      'INSERT INTO users (username, email, password_hash, display_name, avatar_color) VALUES (?, ?, ?, ?, ?)'
    )
    .run(username, email, hash, displayName?.trim() || username, color);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) return res.status(400).json({ error: 'Username/email and password are required' });
  const user = db
    .prepare('SELECT * FROM users WHERE username = ? OR email = ?')
    .get(identifier, identifier);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.put('/profile', requireAuth, (req, res) => {
  const { displayName, avatarColor } = req.body || {};
  const name = (displayName || '').trim();
  if (!name || name.length > 50) return res.status(400).json({ error: 'Display name must be 1-50 characters' });
  db.prepare('UPDATE users SET display_name = ?, avatar_color = COALESCE(?, avatar_color) WHERE id = ?').run(
    name,
    avatarColor || null,
    req.user.id
  );
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(user) });
});

router.get('/search', requireAuth, (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ users: [] });
  const rows = db
    .prepare(
      `SELECT * FROM users
       WHERE (username LIKE ? OR email LIKE ? OR display_name LIKE ?) AND id != ?
       ORDER BY username LIMIT 12`
    )
    .all(`%${q}%`, `%${q}%`, `%${q}%`, req.user.id);
  res.json({ users: rows.map(publicUser) });
});

export default router;
