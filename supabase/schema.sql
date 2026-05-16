-- ============================================================
-- Realty Inbox — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ─── 1. AGENCIES ────────────────────────────────────────────
create table if not exists public.agencies (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  created_at timestamptz not null default now()
);

-- ─── 2. PROFILES ────────────────────────────────────────────
-- One row per authenticated agent, linking auth.users → agency
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  agency_id  uuid not null references public.agencies(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row when a new user signs up
-- (optional: you can also insert manually after creating users)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  -- Only auto-insert if agency_id is passed via raw_user_meta_data
  if new.raw_user_meta_data ? 'agency_id' then
    insert into public.profiles(id, agency_id)
    values (new.id, (new.raw_user_meta_data->>'agency_id')::uuid);
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── 3. CONTACTS ────────────────────────────────────────────
create type public.contact_status as enum ('new', 'contacted', 'discarded');

create table if not exists public.contacts (
  id         uuid primary key default gen_random_uuid(),
  agency_id  uuid not null references public.agencies(id) on delete cascade,
  name       text not null,
  email      text not null,
  message    text not null,
  status     public.contact_status not null default 'new',
  created_at timestamptz not null default now()
);

-- Index for fast per-agency queries
create index if not exists contacts_agency_id_idx on public.contacts(agency_id);
create index if not exists contacts_created_at_idx on public.contacts(created_at desc);

-- ─── 4. ENABLE RLS ──────────────────────────────────────────
alter table public.agencies  enable row level security;
alter table public.profiles  enable row level security;
alter table public.contacts  enable row level security;

-- ─── 5. RLS POLICIES ────────────────────────────────────────

-- agencies: agents can read only their own agency
create policy "Agent reads own agency"
  on public.agencies for select
  to authenticated
  using (
    id in (
      select agency_id from public.profiles where id = auth.uid()
    )
  );

-- agencies: public can read any agency (needed to resolve slug on the contact form)
create policy "Public reads agencies"
  on public.agencies for select
  to anon
  using (true);

-- profiles: each agent can only read their own profile
create policy "Agent reads own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- contacts: anonymous users can INSERT contacts for any agency
-- (the agency_id is validated by the FK; no further restriction needed here)
create policy "Anyone can submit a contact"
  on public.contacts for insert
  to anon
  with check (true);

-- contacts: authenticated agents can SELECT only contacts for their agency
create policy "Agent reads own agency contacts"
  on public.contacts for select
  to authenticated
  using (
    agency_id in (
      select agency_id from public.profiles where id = auth.uid()
    )
  );

-- contacts: authenticated agents can UPDATE status only for their agency
create policy "Agent updates own agency contacts"
  on public.contacts for update
  to authenticated
  using (
    agency_id in (
      select agency_id from public.profiles where id = auth.uid()
    )
  )
  with check (
    agency_id in (
      select agency_id from public.profiles where id = auth.uid()
    )
  );

-- ─── 6. REALTIME ────────────────────────────────────────────
-- Enable realtime for contacts (INSERT + UPDATE events)
alter publication supabase_realtime add table public.contacts;

-- ─── 7. SEED: DEMO AGENCY ───────────────────────────────────
-- Insert a demo agency so you have something to test with.
-- After running this, note the id and use it when creating your first agent user.
insert into public.agencies (id, slug, name)
values (
  'a1b2c3d4-0000-0000-0000-000000000001',
  'acme-realty',
  'Acme Realty'
)
on conflict (slug) do nothing;

-- ─── HOW TO CREATE AN AGENT USER ───────────────────────────
-- Option A — Supabase Dashboard:
--   Authentication → Users → "Invite user"
--   Then manually insert their profile:
--
--   insert into public.profiles (id, agency_id)
--   values ('<user-uuid>', 'a1b2c3d4-0000-0000-0000-000000000001');
--
-- Option B — Supabase Auth Admin API (server-side):
--   createUser({ email, password, user_metadata: { agency_id: '<uuid>' } })
--   The trigger above will auto-create the profile row.
