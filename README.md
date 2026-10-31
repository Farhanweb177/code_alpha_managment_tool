# TaskFlow — Collaborative Project Management

A full-stack Trello/Asana-style tool: group projects, Kanban boards, task cards with
assignees, in-task comments with @mentions, notifications, and real-time updates over WebSockets.

## Stack

| Layer    | Tech |
|----------|------|
| Backend  | Node.js, Express, better-sqlite3, JWT auth, bcryptjs, Socket.IO |
| Frontend | React 18, Vite, react-router, socket.io-client |
| Realtime | Socket.IO (JWT-authenticated), live board sync, presence, notifications |

## Features

- **Auth** — register / login (JWT, 7-day expiry), bcrypt-hashed passwords
- **Group projects** — create projects, invite members by username/email, roles (owner / admin / member)
- **Project boards** — multiple Kanban boards per project, custom lists, rename/delete
- **Task cards** — drag & drop between lists, priority, due dates, completion, description
- **Assignment** — assign any project member to a task
- **Comments** — threaded discussion inside each task, edit/delete own comments, `@username` mentions
- **Notifications** — bell with unread badge for assignments, comments, mentions, project invites
- **Real-time** — every board change (tasks, lists, moves, comments, members) broadcasts live to
  all project members via Socket.IO; plus "who's viewing" presence on open tasks
- **Activity feed** — per-project audit trail of what teammates are doing
- **Modern UI** — collapsible sidebar, dashboard stats, project search & sorting,
  board filters (search, assignee, priority, label, status, due date)
- **Themes** — dark by default, optional light theme persisted in `localStorage`
- **Responsive** — mobile drawer navigation, stacked layouts, horizontal board scrolling

## Getting started

```bash
npm install          # installs server + client workspaces
npm run seed         # optional: demo data (alice/bob/carol)
npm run dev          # starts API on :4000 and Vite dev server on :5173
```

Open http://localhost:5173 — log in as `alice@example.com` / `alice123`
(also `bob@example.com` / `bob12345`, `carol@example.com` / `carol123`).

### Production

```bash
npm run serve        # builds the client, then serves API + WebSockets + UI on :4000
```

Or step by step:

```bash
npm run build        # builds client into client/dist
npm start            # Express serves the API, WebSockets, and the built client on :4000
```

> Opening **http://localhost:4000** serves the compiled build from `client/dist`.
> After changing anything in `client/src` (including `styles.css`), run `npm run build`
> again and restart the server. For development with hot reload use `npm run dev` and open
> **http://localhost:5173** instead.

Environment variables (server): `PORT` (default 4000), `JWT_SECRET`, `CLIENT_ORIGIN`
(default `http://localhost:5173`, used for CORS + Socket.IO).

## API overview

```
POST   /api/auth/register | /api/auth/login      GET /api/auth/me
GET    /api/auth/search?q=                       PUT /api/auth/profile
GET    /api/projects          POST /api/projects
GET    /api/projects/:id      PATCH|DELETE /api/projects/:id
GET|POST /api/projects/:id/members                PATCH|DELETE /api/projects/:id/members/:userId
GET    /api/projects/:id/activities
GET    /api/boards/:id        POST|PATCH|DELETE /api/boards
POST   /api/boards/:id/lists  PATCH|DELETE /api/lists/:id
POST   /api/lists/:id/tasks   GET|PATCH|DELETE /api/tasks/:id
POST   /api/tasks/:id/assignees                   DELETE /api/tasks/:id/assignees/:userId
GET|POST /api/tasks/:id/comments                  PATCH|DELETE /api/comments/:id
GET    /api/notifications     POST /api/notifications/read-all | /:id/read
```

All routes (except register/login/health) require `Authorization: Bearer <token>`.

### WebSocket events

Client → server: `project:subscribe`, `presence:track`, `presence:update`.
Server → client: `task:created|updated|moved|deleted`, `list:*`, `board:*`,
`comment:created|updated|deleted`, `member:*`, `activity:new`, `notification`, `presence:update`.

## Project layout

```
server/src/         Express app, SQLite schema, REST routes, Socket.IO realtime
client/src/         React app (pages: Projects, Project, Board; components: AppLayout, Sidebar, Topbar, TaskModal…)
```
