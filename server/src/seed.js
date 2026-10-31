import bcrypt from 'bcryptjs';
import db from './db.js';

const hash = (p) => bcrypt.hashSync(p, 10);

const users = [
  ['alice', 'alice@example.com', 'alice123', 'Alice Nguyen', '#6366f1'],
  ['bob', 'bob@example.com', 'bob12345', 'Bob Martinez', '#10b981'],
  ['carol', 'carol@example.com', 'carol123', 'Carol Okafor', '#f59e0b'],
];

const insertUser = db.prepare(
  'INSERT INTO users (username, email, password_hash, display_name, avatar_color) VALUES (?, ?, ?, ?, ?)'
);

const ids = users.map(([u, e, p, d, c]) => insertUser.run(u, e, hash(p), d, c).lastInsertRowid);

const [alice, bob, carol] = ids;

const projectId = db
  .prepare('INSERT INTO projects (name, description, color, created_by) VALUES (?, ?, ?, ?)')
  .run('Website Redesign', 'Rebuild the marketing site with a fresh design system.', '#8b5cf6', alice)
  .lastInsertRowid;

const addMember = db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)');
addMember.run(projectId, alice, 'owner');
addMember.run(projectId, bob, 'admin');
addMember.run(projectId, carol, 'member');

const boardId = db
  .prepare('INSERT INTO boards (project_id, name, position) VALUES (?, ?, 0)')
  .run(projectId, 'Main Board').lastInsertRowid;

const insertList = db.prepare('INSERT INTO task_lists (board_id, name, position) VALUES (?, ?, ?)');
const listIds = ['To Do', 'In Progress', 'Review', 'Done'].map((n, i) => insertList.run(boardId, n, i).lastInsertRowid);

const insertTask = db.prepare(
  'INSERT INTO tasks (board_id, list_id, title, description, priority, due_date, position, completed, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
);
const t1 = insertTask.run(boardId, listIds[0], 'Audit current site pages', 'List every page and flag outdated content.', 'medium', '2026-11-05', 0, 0, alice).lastInsertRowid;
const t2 = insertTask.run(boardId, listIds[1], 'Design new landing page', 'Hero, social proof, pricing tiers.', 'high', '2026-10-30', 0, 0, alice).lastInsertRowid;
insertTask.run(boardId, listIds[3], 'Set up design tokens', 'Colors, spacing, type scale.', 'low', null, 0, 1, bob);

const assign = db.prepare('INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (?, ?, ?)');
assign.run(t1, carol, alice);
assign.run(t2, bob, alice);

const comment = db.prepare('INSERT INTO comments (task_id, user_id, body) VALUES (?, ?, ?)');
comment.run(t2, bob, 'Started on the hero section — will push a draft today.');
comment.run(t2, alice, 'Great, cc @carol for the copy review please.');

db.prepare('INSERT INTO notifications (user_id, type, payload) VALUES (?, ?, ?)').run(
  bob,
  'task_assigned',
  JSON.stringify({ taskId: t2, title: 'Design new landing page', listName: 'In Progress' })
);

console.log('Seeded demo data.');
console.log('Login with: alice@example.com / alice123 (also bob12345, carol123)');
