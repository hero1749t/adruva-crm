# Adruva CRM

Adruva CRM is a React + TypeScript + Supabase based CRM for handling leads, clients, tasks, billing, onboarding, and internal team workflows.

## Core Features

- Lead pipeline with status tracking and lead-to-client conversion
- Client management with onboarding checklist and communication history
- Task management with recurring templates and automation hooks
- Custom fields for leads and clients
- Payments, invoices, reports, notifications, and team roles
- Supabase Edge Functions for reminders, automation, and backend jobs

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui + Radix UI
- TanStack Query
- React Router
- Supabase

## Local Setup

Requirements:

- Node.js 18+
- npm

Run locally:

```sh
npm install
npm run dev
```

App runs at `http://localhost:8080` or the Vite port configured in your local setup.

## Environment Variables

Create a local `.env` with:

```env
VITE_SUPABASE_PROJECT_ID=your_project_id
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
VITE_SUPABASE_URL=https://your-project-id.supabase.co
DATABASE_URL=postgresql://postgres:your_password@db.your-project-id.supabase.co:5432/postgres
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Do not commit real credentials.

## Useful Commands

```sh
npm run dev
npm run build
npm run preview
npm run test
npm run test:ui
```

## Deployment

Production is deployed on Vercel.

- Production URL: `https://adruva-crm.vercel.app`
- GitHub repo: `https://github.com/hero1749t/adruva-crm-clean`

Vercel is connected to the GitHub repository, so pushes to the deployment branch can trigger auto-deploys.

## Project Structure

```text
src/
  components/
  contexts/
  hooks/
  integrations/
  lib/
  pages/
  test/

supabase/
  functions/
  migrations/

tests/
  playwright/
```

## Notes

- Keep secrets in environment variables only.
- Database schema changes should go through Supabase migrations.
- UI and live smoke coverage are available in the test suite.
