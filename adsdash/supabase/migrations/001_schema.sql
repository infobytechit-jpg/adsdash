-- ============================================================
-- ADSDASH DATABASE SCHEMA
-- Run this in Supabase > SQL Editor > New Query > Run
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES TABLE (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  role text not null default 'client' check (role in ('admin', 'client')),
  avatar_color text default '#00C8E0',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- CLIENTS TABLE
-- ============================================================
create table public.clients (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade unique,
  name text not null,
  email text not null,
  avatar_color text default '#00C8E0',
  is_active boolean default true,
  -- Visible metrics toggle (admin configures per client)
  show_spend boolean default true,
  show_conversions boolean default true,
  show_roas boolean default true,
  show_leads boolean default true,
  show_clicks boolean default false,
  show_impressions boolean default false,
  show_cpc boolean default false,
  show_ctr boolean default false,
  -- Monthly report settings
  send_monthly_report boolean default true,
  report_day_of_month integer default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- AD ACCOUNTS TABLE (credentials stored encrypted)
-- ============================================================
create table public.ad_accounts (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references public.clients(id) on delete cascade,
  platform text not null check (platform in ('google', 'meta')),
  account_name text not null,
  account_id text not null,  -- Google: customer_id, Meta: act_XXXX
  -- OAuth tokens (encrypted at rest by Supabase)
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  is_active boolean default true,
  last_synced_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- METRICS CACHE TABLE (stores pulled data)
-- ============================================================
create table public.metrics_cache (
  id uuid default uuid_generate_v4() primary key,
  ad_account_id uuid references public.ad_accounts(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  date date not null,
  platform text not null,
  -- Core metrics
  spend numeric(12,2) default 0,
  impressions bigint default 0,
  clicks bigint default 0,
  conversions numeric(10,2) default 0,
  conversion_value numeric(12,2) default 0,
  leads integer default 0,
  -- Calculated
  cpc numeric(8,4),
  ctr numeric(8,6),
  roas numeric(8,4),
  -- Raw JSON for extra data
  raw_data jsonb,
  created_at timestamptz default now(),
  unique(ad_account_id, date)
);

-- ============================================================
-- CAMPAIGNS TABLE
-- ============================================================
create table public.campaigns (
  id uuid default uuid_generate_v4() primary key,
  ad_account_id uuid references public.ad_accounts(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  platform_campaign_id text not null,
  campaign_name text not null,
  status text default 'active',
  created_at timestamptz default now()
);

-- ============================================================
-- CAMPAIGN METRICS TABLE
-- ============================================================
create table public.campaign_metrics (
  id uuid default uuid_generate_v4() primary key,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  date date not null,
  spend numeric(12,2) default 0,
  impressions bigint default 0,
  clicks bigint default 0,
  conversions numeric(10,2) default 0,
  conversion_value numeric(12,2) default 0,
  leads integer default 0,
  cpc numeric(8,4),
  ctr numeric(8,6),
  roas numeric(8,4),
  unique(campaign_id, date)
);

-- ============================================================
-- REPORTS TABLE
-- ============================================================
create table public.reports (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references public.clients(id) on delete cascade,
  report_type text default 'monthly' check (report_type in ('monthly', 'weekly', 'custom')),
  period_start date not null,
  period_end date not null,
  status text default 'pending' check (status in ('pending', 'generated', 'sent', 'failed')),
  sent_at timestamptz,
  file_url text,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) — THE KEY TO CLIENT ISOLATION
-- ============================================================

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.ad_accounts enable row level security;
alter table public.metrics_cache enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_metrics enable row level security;
alter table public.reports enable row level security;

-- Helper function: is current user an admin?
create or replace function public.is_admin()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Helper function: get client_id for current user
create or replace function public.my_client_id()
returns uuid language sql security definer as $$
  select id from public.clients where user_id = auth.uid() limit 1;
$$;

-- PROFILES policies
create policy "Users can view own profile" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy "Users can update own profile" on public.profiles
  for update using (id = auth.uid());

create policy "Admins can insert profiles" on public.profiles
  for insert with check (public.is_admin() or id = auth.uid());

-- CLIENTS policies
create policy "Admins see all clients" on public.clients
  for all using (public.is_admin());

create policy "Clients see only themselves" on public.clients
  for select using (user_id = auth.uid());

-- AD ACCOUNTS policies
create policy "Admins manage all ad accounts" on public.ad_accounts
  for all using (public.is_admin());

create policy "Clients see own ad accounts" on public.ad_accounts
  for select using (client_id = public.my_client_id());

-- METRICS policies
create policy "Admins see all metrics" on public.metrics_cache
  for all using (public.is_admin());

create policy "Clients see own metrics" on public.metrics_cache
  for select using (client_id = public.my_client_id());

-- CAMPAIGNS policies
create policy "Admins manage all campaigns" on public.campaigns
  for all using (public.is_admin());

create policy "Clients see own campaigns" on public.campaigns
  for select using (client_id = public.my_client_id());

-- CAMPAIGN METRICS policies
create policy "Admins manage all campaign metrics" on public.campaign_metrics
  for all using (public.is_admin());

create policy "Clients see own campaign metrics" on public.campaign_metrics
  for select using (client_id = public.my_client_id());

-- REPORTS policies
create policy "Admins manage all reports" on public.reports
  for all using (public.is_admin());

create policy "Clients see own reports" on public.reports
  for select using (client_id = public.my_client_id());

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'role', 'client')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- INSERT YOUR ADMIN USER
-- (Run AFTER you create your account via the app login page)
-- Replace 'your-email@domain.com' with your actual email
-- ============================================================
-- update public.profiles set role = 'admin' where email = 'your-email@domain.com';
