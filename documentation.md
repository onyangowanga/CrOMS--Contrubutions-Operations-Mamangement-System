# CrOMS Project Documentation

## 1. Overview

CrOMS stands for Contributions Management System.

It is a Docker-first contributions and fundraising operations platform designed for:

- welfare groups
- church teams
- funeral committees
- school fundraisers
- community projects

The system provides a mobile-first interface for capturing M-Pesa and cash payments, managing contribution campaigns, generating WhatsApp updates, exporting statements, and administering group-based access.

This implementation is a full-stack web application with:

- a TypeScript + Express backend
- a React + Vite frontend
- a PostgreSQL database
- Docker and Docker Compose for runtime and development

## 2. Core Business Goals

CrOMS is built to solve these operational needs:

- record contributions quickly from mobile devices
- reduce manual errors when posting M-Pesa messages
- keep each organization or group independent from others
- allow treasurers to manage only their own group data
- let administrators create and manage isolated group workspaces
- produce clean contribution summaries for WhatsApp sharing
- export campaign contribution data in CSV, Excel, and PDF formats

## 3. Current Feature Set

### Authentication and account management

- login with JWT-based authentication
- forgot-password token generation
- password reset using reset token
- authenticated password change
- show/hide password support in password fields on the frontend

### Group administration

- create groups
- edit and delete groups
- assign users to groups
- assign group membership roles
- create users from the admin workspace
- restrict group creation and deletion to admins only

### Campaign operations

- create campaigns inside a group
- set campaign target amounts
- mark campaigns as active or closed
- configure default WhatsApp header text during campaign creation
- configure optional extra WhatsApp line during campaign creation
- later edit WhatsApp summary text from the payments page

### Contributions and payments

- paste raw M-Pesa messages for parsing
- log manual cash contributions
- queue ambiguous parsed contributions for confirmation
- preserve contributor identity and alternate sender names
- detect duplicate transaction codes
- support campaign payment methods for summary instructions

### Reporting and exports

- contributor CSV export
- campaign statement Excel export
- campaign statement PDF export
- daily totals summary
- transaction statement listing in the reports page
- password-confirmed transaction deletion for treasurers and admins

### Multi-tenant access model

- each group is isolated from other groups
- non-admin users can only access campaigns and reports for groups they belong to
- admin users can access all groups and all group data

## 4. Architecture

### Frontend

Location: `web/`

Tech stack:

- React 18
- Vite
- React Router
- React Query
- Recharts

Responsibilities:

- authentication flows
- mobile-first navigation and layout
- campaign and group management UI
- payment logging UI
- summary editing and copy flow
- report viewing and exports
- transaction deletion confirmation UI

### Backend

Location: `backend/`

Tech stack:

- Node.js
- Express
- TypeScript
- `pg` for PostgreSQL access
- `jsonwebtoken` for JWT auth
- `bcryptjs` for password hashing
- `exceljs` for Excel export
- `pdfkit` for PDF generation

Responsibilities:

- authentication and authorization
- database schema bootstrap
- admin seed account creation
- route handling for groups, campaigns, contributions, summaries, and reports
- data isolation checks for group-aware access
- statement export generation

### Database

Tech stack:

- PostgreSQL 16

Main entities:

- `users`
- `groups`
- `group_members`
- `campaigns`
- `contributors`
- `transactions`
- `payment_methods`
- `confirmation_queue`

## 5. Project Structure

Top-level workspace:

- `backend/` API and database bootstrap logic
- `web/` React frontend
- `docs/` blueprint and handbook material
- `favicon_io/` branding assets served under `/assets`
- `Dockerfile` multi-stage build for app images
- `docker-compose.yml` local runtime and dev services
- `README.md` short runbook
- `documentation.md` this document

## 6. Runtime Model

### Production-style runtime

The main production-style service is `croms` in `docker-compose.yml`.

It runs:

- backend API
- static frontend assets
- favicon assets under `/assets`

Default public URL:

- `http://localhost:4000`

### Development runtime

Development profile services:

- `croms-dev`
- `web-dev`
- `db`

Default development URLs:

- frontend dev server: `http://localhost:5173`
- backend dev API: `http://localhost:4001`

## 7. Startup and Initialization

On backend startup:

1. database schema is initialized automatically
2. missing columns are added using `ALTER TABLE IF NOT EXISTS` style statements in the schema bootstrap
3. the seeded admin user is created if it does not already exist

The backend startup flow is wired through:

- `backend/src/server.ts`
- `backend/src/db/init.ts`
- `backend/src/db/schema.ts`

Default seeded admin credentials:

- email: `admin@croms.local`
- password: `Admin@12345`

These should be changed in production using environment variables.

## 8. Environment Variables

Key backend environment variables:

- `NODE_ENV`
- `PORT`
- `JWT_SECRET`
- `DATABASE_URL`
- `ADMIN_SEED_EMAIL`
- `ADMIN_SEED_PASSWORD`

Production requirements:

- use a strong `JWT_SECRET`
- use a non-default admin seed password
- use a persistent PostgreSQL volume or managed database

## 9. Roles and Permissions

### Admin

Admins can:

- create users
- list all users
- create groups
- update groups
- delete groups
- assign users to groups
- access all groups, campaigns, reports, summaries, and transactions

### Treasurer

Treasurers can:

- access only groups they belong to
- create campaigns inside groups they can access
- log M-Pesa and cash transactions for accessible campaigns
- view reports for accessible campaigns
- delete transactions from reports after entering their current password
- manage payment methods for accessible campaigns
- approve or reject queued confirmations for accessible campaigns

Treasurers cannot:

- create users globally
- create or delete groups globally
- access campaigns from other groups

### Viewer

Viewers are intended for read-oriented access.

They cannot:

- create campaigns
- post transactions
- manage groups
- delete transactions

Their effective visibility is still limited to groups they belong to.

## 10. Tenant Isolation Model

CrOMS now behaves as a group-isolated SaaS-style system.

### Isolation rules

- a group is the top-level tenant boundary
- campaigns belong to groups
- contributors, payment methods, confirmations, summaries, transactions, and reports belong to campaigns
- non-admin users can only access data for campaigns under groups they are members of
- admins can access all groups and all campaigns

### Enforcement approach

Backend access checks are centralized in:

- `backend/src/lib/access.ts`

That helper is used across routes including:

- groups
- campaigns
- contributors
- payment methods
- summary
- reports
- confirmations
- transactions

This means tenant isolation is enforced at the API layer, not just the frontend layer.

## 11. Frontend Workflows

### Login

- sign in using email and password
- use `Forget password` to switch the sign-in card into password recovery mode
- generate a reset token and then set a new password

### Payments page

The payments page is the main operations workspace.

It includes:

- M-Pesa payment logging tab
- cash payment logging tab
- WhatsApp summary editor and preview
- pending contribution confirmation flow

### Campaigns page

The campaigns page allows users with access to:

- create campaigns
- define target amount
- set initial WhatsApp header text
- set initial WhatsApp additional line
- manage campaign payment channels

### Reports page

The reports page allows users with access to:

- export contributor CSV
- export Excel statement
- export PDF statement
- view daily contribution performance
- view transaction statement rows
- delete a transaction after password confirmation

### Admin page

The admin page now uses two tabs:

- `Create Group`
- `Create User`

The user assignment form is grouped under the user tab instead of being a separate major section.

## 12. Form UX Rules

The frontend uses helper text instead of filling text fields with misleading hardcoded content.

Implemented behavior:

- raw M-Pesa message input starts empty
- text inputs use helper text rather than example values where appropriate
- password fields can show or hide the current value

This is especially important for:

- login and password reset flows
- campaign WhatsApp defaults
- payment logging
- admin account creation
- transaction deletion confirmation

## 13. WhatsApp Summary Logic

The WhatsApp summary is generated by the backend.

It includes:

- campaign header text
- optional additional info line
- payment methods
- contributor list ordered by contribution total
- total amount
- optional target
- optional deficit
- thank-you closing line

Priority for the summary header:

1. explicit text entered in the summary editor
2. default campaign WhatsApp header saved during campaign creation
3. generated fallback based on campaign name

Priority for the additional line:

1. explicit text entered in the summary editor
2. default campaign additional line

## 14. Transaction Deletion Logic

Transaction deletion is intentionally protected.

Rules:

- only admins and treasurers can delete transactions
- the user must provide the current login password
- the transaction row is removed from the database
- contributor totals are reduced
- campaign total raised is reduced
- access is still restricted by group membership

This protects the system against accidental report cleanup and unauthorized deletions.

## 15. API Summary

### Health

- `GET /api/health`

### Auth

- `POST /api/auth/login`
- `POST /api/auth/register` admin only
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/change-password`
- `GET /api/auth/me`
- `GET /api/auth/users` admin only

### Groups

- `GET /api/groups`
- `POST /api/groups` admin only
- `PATCH /api/groups/:groupId` admin only
- `DELETE /api/groups/:groupId` admin only
- `POST /api/groups/:groupId/members` admin only
- `GET /api/groups/:groupId/members` admin only
- `DELETE /api/groups/:groupId/members/:userId` admin only

### Campaigns

- `GET /api/campaigns`
- `POST /api/campaigns`
- `PATCH /api/campaigns/:id/target`
- `PATCH /api/campaigns/:id/status`
- `POST /api/campaigns/:id/payment-methods`
- `GET /api/campaigns/:id/summary`

### Contributors

- `GET /api/contributors/:campaignId`
- `POST /api/contributors/:id/add-sender`

### Payments and transactions

- `POST /api/parse`
- `POST /api/transactions/manual`
- `GET /api/transactions/:campaignId`
- `DELETE /api/transactions/:transactionId`

### Payment methods

- `GET /api/payment-methods/campaign/:campaignId`
- `POST /api/payment-methods`
- `PATCH /api/payment-methods/:id`
- `DELETE /api/payment-methods/:id`

### Confirmations

- `GET /api/confirmations`
- `POST /api/confirmations/:id/approve`
- `POST /api/confirmations/:id/reject`

### Summary and reports

- `GET /api/summary/:campaignId/whatsapp`
- `GET /api/reports/:campaignId/contributors.csv`
- `GET /api/reports/:campaignId/statement.xlsx`
- `GET /api/reports/:campaignId/statement.pdf`

## 16. Build and Run Commands

### Full stack production-style run

```powershell
docker compose up --build -d croms
```

### Development profile

```powershell
docker compose --profile dev up --build croms-dev web-dev
```

### Stop services

```powershell
docker compose down
```

### Frontend build

```powershell
cd web
npm run build
```

### Backend build

```powershell
cd backend
npm run build
```

## 17. Production Readiness Checklist

Before deploying for production use:

1. replace the default `JWT_SECRET`
2. replace the default seeded admin password
3. verify PostgreSQL persistence and backup strategy
4. rebuild and restart the full Docker stack
5. validate tenant isolation with separate test groups
6. validate treasurer transaction deletion with password confirmation
7. validate campaign WhatsApp defaults and summary editing
8. confirm admin-only group creation and user management behavior
9. configure HTTPS and reverse proxy if exposing publicly
10. review logging, monitoring, and secret storage practices

## 18. Known Implementation Notes

- The backend schema is applied programmatically on startup rather than through a separate migration framework.
- The application serves built frontend assets from the backend runtime service.
- Favicon and app logo assets are served from `favicon_io/` through the `/assets` route.
- Group branding fields exist, but the current UI is focused on operational clarity rather than fully dynamic white-label themes.

## 19. Recommended Acceptance Tests

Suggested final smoke tests:

1. create two different groups as admin
2. create one treasurer for each group
3. assign each treasurer to only one group
4. log in as each treasurer and confirm they cannot see the other group’s campaigns or reports
5. create a campaign with default WhatsApp header text
6. post an M-Pesa contribution and confirm the summary uses the campaign default
7. override the summary text in the payments page and confirm the preview updates
8. delete a transaction from reports using the correct password and confirm totals update
9. attempt deletion with an incorrect password and confirm rejection
10. confirm admin can still see and manage all groups

## 20. Conclusion

This CrOMS implementation now provides:

- a mobile-first contribution operations experience
- group-isolated data access suitable for multi-tenant use
- campaign-level WhatsApp defaults
- exportable reporting
- secure transaction deletion for authorized finance users
- Docker-first deployment and development

It is close to production use, with the main final requirement being a full end-to-end runtime smoke test after deployment or rebuild.