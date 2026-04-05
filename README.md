# CrOMS Full App

CrOMS (Contributions Operations Management System) implemented from the handbook blueprint with a Docker-first workflow.

## Implemented modules
- Authentication and user roles (admin, treasurer, viewer)
- Forgot password and reset password flow
- Group management and group members
- Group branding fields and group update/delete operations
- Campaign management with target and status
- Contributor identity model with alternate senders
- Regex-first transaction parsing for MPesa/bank message text
- Contribution recording and duplicate transaction detection
- Campaign totals and deficit computation
- Payment methods per campaign
- WhatsApp summary generation
- Contributor CSV export report
- Branded web operations dashboard using assets in favicon_io

## Tech stack
- Backend: Node.js + Express + TypeScript
- Frontend: React + Vite
- Database: PostgreSQL 16
- Auth: JWT
- Runtime: Docker + Docker Compose

## Docker-only runbook
1. Start full stack (PostgreSQL + API):
   docker compose up --build -d croms
2. Open app:
   http://localhost:4000
3. Default seeded admin:
   email: admin@croms.local
   password: Admin@12345
4. Stop stack:
   docker compose down

## Docker dev mode
1. Start dev profile:
   docker compose --profile dev up --build croms-dev web-dev
2. Open React web app:
   http://localhost:5173
3. Backend API remains on:
   http://localhost:4001
4. Stop:
   docker compose down

## Useful endpoints
- GET /api/health
- POST /api/auth/login
- POST /api/auth/register (admin only)
- POST /api/auth/forgot-password
- POST /api/auth/reset-password
- GET /api/auth/me
- GET /api/auth/users
- GET/POST /api/groups
- PATCH /api/groups/:groupId
- DELETE /api/groups/:groupId
- POST /api/groups/:groupId/members
- DELETE /api/groups/:groupId/members/:userId
- GET/POST /api/campaigns
- PATCH /api/campaigns/:id/target
- PATCH /api/campaigns/:id/status
- POST /api/campaigns/:id/payment-methods
- POST /api/parse
- POST /api/transactions/parse
- GET /api/transactions/:campaignId
- GET /api/contributors/:campaignId
- POST /api/contributors/:id/add-sender
- GET /api/payment-methods/campaign/:campaignId
- POST /api/payment-methods
- PATCH /api/payment-methods/:id
- DELETE /api/payment-methods/:id
- GET /api/summary/:campaignId/whatsapp
- GET /api/reports/:campaignId/contributors.csv

## Environment reference
See backend/.env.example for all supported environment variables.

## Blueprint alignment notes
- Matches the blueprint data model for campaigns, contributors, transactions, and payment methods.
- Uses PostgreSQL, Docker, JWT auth, multi-group membership, regex-first parsing, and WhatsApp summary generation as specified.
- AI fallback parsing, PDF/Excel exports, graphs/trends UI, and Flutter mobile client remain roadmap items.
