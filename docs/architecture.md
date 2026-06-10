# Architecture notes

## Selected shadcn MCP references

- `dashboard-shell-09` for the activity-first dashboard shell
- `dashboard-sidebar-08` for the project-management navigation model
- `chart-component-48` for repository and release analytics inspiration
- `multi-step-form-01` for guided onboarding sequencing

## Auth split

- Local workspace auth handles app identity and sessions.
- `GitHub App` handles repository access and webhooks.
- `Asana OAuth` handles task and workspace access.
- The frontend should use `VITE_API_BASE_URL` and the backend should use `APP_AUTH_SECRET` for local session handling.

## Board model

- Asana parent task => board
- Asana subtasks => cards
- Asana enum custom field => board columns
- GitHub events => development links
