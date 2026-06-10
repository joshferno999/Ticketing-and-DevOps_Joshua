# Emergence-Devops

Azure Boards-style bridge application that connects a local workspace account system, Asana, and GitHub.

## Workspaces

- `frontend` - React + Vite dashboard with shadcn-inspired UI
- `backend` - Fastify API, webhooks, and integration services
- `packages/shared` - shared types, parsing rules, and domain helpers

## Quick start

1. Copy `backend/.env.example` to `backend/.env`
2. Copy `frontend/.env.example` to `frontend/.env`
3. Install dependencies with `npm install`
4. Generate Prisma client with `npm run prisma:generate`
5. Run database migrations with `npm run prisma:migrate`
6. Start the stack with `npm run dev`

## Product model

- Asana parent task = board
- Asana subtask = card
- GitHub commits, branches, and PRs = traceability linked to cards
- Asana custom field enum options = board columns
- Local workspace auth = app identity and session management

## Auth envs

- `APP_AUTH_SECRET` should be a strong local secret, for example from `openssl rand -base64 32`
- `VITE_API_BASE_URL` should point at the backend API, typically `http://localhost:4000/api`
