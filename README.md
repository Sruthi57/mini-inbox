# Realty Inbox

A real-time contact inbox for real estate agencies. Visitors submit a public form; agents see leads appear live in their dashboard.

**Stack:** Vite · React 18 · TypeScript · Tailwind CSS · Supabase · Cloudflare Pages

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Prerequisites](#prerequisites)
3. [Supabase Setup](#supabase-setup)
4. [Local Development](#local-development)
5. [Adding More Agencies / Agents](#adding-more-agencies--agents)
6. [Cloudflare Deployment](#cloudflare-deployment)
7. [RLS and Multi-tenancy](#rls--multi-tenancy)
8. [What was left out and why](#what-was-left-out-and-why)
9. [Where AI has helped](#where-ai-has-helped)

---

## Project Structure

```
realty-inbox/
├── src/
│   ├── lib/supabase.ts              # Supabase client + shared TypeScript types
│   ├── contexts/AuthContext.tsx     # Auth state (session, signIn, signOut)
│   ├── components/ProtectedRoute.tsx
│   └── pages/
│       ├── ContactForm.tsx          # /c/:agencySlug  — public, no login
│       ├── Login.tsx                # /login
│       └── Inbox.tsx                # /inbox — agent dashboard, realtime
├── supabase/
│   └── schema.sql                   # Full Postgres schema, RLS, seed
├── .env.example                     # Environment variable template
└── vite.config.ts
```

---

## Prerequisites

| Tool | Minimum version | Check |
|------|----------------|-------|
| Node.js | 18 | `node -v` |
| npm | 9 | `npm -v` |
| Git | any | `git --version` |

For a self-hosted production server you also need a web server (Nginx or Caddy) to serve the static `dist/` folder.

---

## Supabase Setup

This is required regardless of where you deploy.

### 1. Create a project

1. Go to [supabase.com](https://supabase.com) → **New project** (free tier works).
2. Choose a region close to your users.
3. Wait for provisioning (~2 min).

### 2. Get your API credentials

*Settings → API* — copy:
- **Project URL** — looks like `https://abcdefgh.supabase.co`
- **anon public key** — the long `eyJ…` string under *Project API keys*

### 3. Run the database schema

1. Dashboard → **SQL Editor** → **New query**
2. Paste the entire contents of `supabase/schema.sql`
3. Click **Run**

This creates all tables (`agencies`, `profiles`, `contacts`), the `contact_status` enum, RLS policies for both anonymous and authenticated roles, a trigger that auto-links new users to an agency, enables Realtime on the `contacts` table, and seeds one demo agency (`acme-realty`, UUID `a1b2c3d4-0000-0000-0000-000000000001`).

### 4. Create your first agent user

**Step 1 — Create the auth user**

Dashboard → *Authentication → Users → Add user*
- Enter email and password
- Click **Create user**
- Copy the generated **User UID**

**Step 2 — Link the user to an agency**

Back in SQL Editor, run:

```sql
insert into public.profiles (id, agency_id)
values (
  '<paste-user-uid-here>',
  'a1b2c3d4-0000-0000-0000-000000000001'  -- acme-realty demo agency
);
```

The agent can now log in and see only `acme-realty` contacts.

---

## Local Development

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd mini-inbox

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
```

Edit `.env` and fill in your values:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

```bash
# 4. Start the dev server
npm run dev
```

The app is now running at **http://localhost:5173**

| URL | Purpose |
|-----|---------|
| `http://localhost:5173/c/acme-realty` | Public contact form |
| `http://localhost:5173/login` | Agent login |
| `http://localhost:5173/inbox` | Agent dashboard (redirects to login if not authenticated) |


## Adding More Agencies / Agents

### New agency

```sql
insert into public.agencies (slug, name)
values ('sunset-homes', 'Sunset Homes');
```

Public form is immediately live at `/c/sunset-homes`.

### New agent for that agency

1. Create the user in Supabase Auth dashboard.
2. Link them:
```sql
insert into public.profiles (id, agency_id)
values (
  '<new-user-uid>',
  (select id from public.agencies where slug = 'sunset-homes')
);
```
## Cloudflare Deployment

### Steps to deploy the project on Cloudflare
Cloudflare dashboard → Pages → Create a project → Connect to Git
Select your repo.
Build settings:

Framework preset: Vite
Build command: npm run build
Build output directory: dist

Environment variables (same tab):
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY

Click Save and Deploy.

## RLS & Multi-tenancy

All tenant isolation is enforced in the database.

| Role | Table | Operation | Condition |
|------|-------|-----------|-----------|
| `anon` | `agencies` | SELECT | always (needed to resolve slug) |
| `anon` | `contacts` | INSERT | always (FK ensures valid agency_id) |
| `authenticated` | `profiles` | SELECT | own row only |
| `authenticated` | `agencies` | SELECT | own agency only |
| `authenticated` | `contacts` | SELECT | `agency_id` matches agent's agency |
| `authenticated` | `contacts` | UPDATE | `agency_id` matches agent's agency |

Database rejects the misconfigured query

### What was left out and why

1. Agent registration - as it was mentioned that login credentials already exists. So creating a new agent was done using Superbase dashboard

2. Email Notification - When a new contact arrives, agent can see only if the dashboard is open. An edge fucntion to trigger a notification on INSERT would be helpful.

3. Pagination - For the demo all the contacts are loaded for that agency. But for production system with huge data would require a cursor based pagination.

4. Filter the data based on the status 'New', 'Contacted', 'Discarded'

These feaatures were left out as they were out of scope and would require more time.

### Where AI has helped

Project structure and setup was done in one go with minor adjustments. 

Generating the custom palette and animation keyframes in `tailwind.config.js` was faster than doing it manually.

RLS debugging - AI helped with checking the policies → grants → privilege and finally fix the grants issue.

## Where it got me into trouble or required correction

The `_redirects` file** the code was generated targeting Cloudflare Pages, but the actual deploy used Cloudflare Workers via `wrangler deploy`, which handles SPA routing differently. The `_redirects` file caused a deployment error (`code: 10021`) and had to be removed.
