-- 1) Create Tables
create table if not exists issues (
  id uuid primary key default gen_random_uuid(),
  latitude double precision not null,
  longitude double precision not null,
  ward_number int not null,
  ward_name text,
  issue_type text,
  description text,
  severity text check (severity in ('Minor','Moderate','Severe','Critical')),
  status text default 'open' check (status in ('open','resolved')),
  image_url text not null,
  device_id text not null,
  created_at timestamptz default now()
);

create table if not exists verifications (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid references issues(id) on delete cascade,
  image_url text not null,
  device_id text not null,
  created_at timestamptz default now()
);

create table if not exists representatives (
  ward_number int primary key,
  councillor text,
  party text,
  councillor_phone text
);

create table if not exists upvotes (
  issue_id uuid references issues(id) on delete cascade,
  device_ip text not null,
  created_at timestamptz default now(),
  primary key (issue_id, device_ip)
);

-- 2) Enable Realtime
alter publication supabase_realtime add table issues;
alter publication supabase_realtime add table upvotes;

-- 3) Enable RLS
alter table issues enable row level security;
alter table verifications enable row level security;
alter table representatives enable row level security;
alter table upvotes enable row level security;

-- 4) Public Read Policies
create policy "public read issues" on issues for select using (true);
create policy "public read verifications" on verifications for select using (true);
create policy "public read representatives" on representatives for select using (true);
create policy "public read upvotes" on upvotes for select using (true);

-- 5) Anonymous Insert Policies (No UPDATE/DELETE)
create policy "insert issues" on issues for insert to anon with check (true);
create policy "insert verifications" on verifications for insert to anon with check (true);
create policy "insert upvotes" on upvotes for insert to anon with check (true);

-- Allow anonymous users to update status
create policy "update issues" on issues for update to anon using (true);

-- 6) Storage Buckets (Manual via Dashboard recommended)
-- Ensure 'issues' and 'verifications' public buckets are created via Dashboard!
-- And set public read and public insert policies for them.
