TaskFlow — Collaborative Project Management
code_alpha_managment_tool

A full-stack Trello/Asana-style project management tool featuring group projects, Kanban boards, task cards, assignees, comments, notifications, and real-time updates.

Tech Stack
Layer	Technology
Backend	Node.js, Express, better-sqlite3, JWT, bcryptjs, Socket.IO
Frontend	React 18, Vite, react-router
Realtime	Socket.IO
Features
Authentication — Register and login with JWT authentication.
Group Projects — Create projects and invite team members.
Project Boards — Multiple Kanban boards with custom lists.
Task Management — Create, edit, delete, and move tasks.
Assignments — Assign project members to tasks.
Comments — Task discussions with @mentions.
Notifications — Notifications for assignments, comments, and invitations.
Real-time Updates — Live board synchronization using Socket.IO.
Activity Feed — Track project activities.
Modern UI — Responsive dashboard, sidebar, and search.
Themes — Dark and light themes.
Responsive Design — Mobile-friendly interface.
Getting Started

Install dependencies:

bash
npm install


Seed demo data (optional):

bash
npm run seed


Start development servers:

bash
npm run dev


Open:

http://localhost:5173

Demo Accounts
alice@example.com / alice123
bob@example.com / bob12345
carol@example.com / carol123
Production

Build the client:

bash
npm run build


Start the application:

bash
npm start

Environment Variables
PORT — Default: 4000
JWT_SECRET — JWT authentication secret
CLIENT_ORIGIN — Default: http://localhost:5173
API Overview
Authentication
Projects and Members
Boards and Lists
Tasks and Assignments
Comments
Notifications

All protected routes require:

text
Authorization: Bearer <token>

WebSocket

Socket.IO provides real-time updates for tasks, boards, comments, members, notifications, and user presence.

Project Structure
text
server/
  src/
    Express app, database, routes, middleware

client/
  src/
    React components, pages, styles

License

This project is developed as a collaborative project management tool.