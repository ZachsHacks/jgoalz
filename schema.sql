-- Jgoalz Database Schema
-- Run this in Supabase SQL Editor

-- Players (flat, no family hierarchy)
create table players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  segment text not null check (segment in ('women', 'teens', 'girls')),
  emergency_contact text,
  notes text,
  created_at timestamptz default now()
);

-- Games (recurring weekly templates)
create table games (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sport text not null default 'soccer' check (sport in ('soccer', 'basketball')),
  segment text not null check (segment in ('women', 'teens', 'girls')),
  day_of_week integer not null check (day_of_week between 0 and 6),
  time text not null,
  location text not null,
  capacity integer not null default 12,
  price_per_player numeric(10,2) not null,
  transport_fee numeric(10,2),
  active boolean not null default true,
  created_at timestamptz default now()
);

-- Permanent roster for each game
create table game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade not null,
  player_id uuid references players(id) on delete cascade not null,
  status text not null default 'active' check (status in ('active', 'paused', 'dropped')),
  joined_at timestamptz default now(),
  unique(game_id, player_id)
);

-- Sessions (auto-generated weekly instances)
create table sessions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade not null,
  date date not null,
  status text not null default 'upcoming' check (status in ('upcoming', 'in_progress', 'completed', 'cancelled')),
  spots_remaining integer not null default 0,
  created_at timestamptz default now()
);

-- Session players (actual roster for a specific session)
create table session_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade not null,
  player_id uuid references players(id) on delete cascade not null,
  source text not null default 'permanent' check (source in ('permanent', 'drop_in')),
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled_early', 'cancelled_late', 'no_show')),
  needs_transport boolean not null default false,
  cancel_token uuid default gen_random_uuid(),
  cancelled_at timestamptz,
  created_at timestamptz default now(),
  unique(session_id, player_id)
);

-- Prepaid credits per player per game
create table player_credits (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players(id) on delete cascade not null,
  game_id uuid references games(id) on delete cascade not null,
  credits_purchased integer not null default 0,
  credits_used integer not null default 0,
  last_reminded_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(player_id, game_id)
);

-- Payments (per player per session)
create table payments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade not null,
  player_id uuid references players(id) on delete cascade not null,
  amount numeric(10,2) not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'reminded')),
  reminded_at timestamptz,
  paid_at timestamptz,
  month text,
  notes text,
  created_at timestamptz default now(),
  unique(session_id, player_id)
);

-- Drivers
create table drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  vehicle_type text not null default 'minivan',
  capacity integer not null default 6,
  default_segment text check (default_segment is null or default_segment in ('women', 'teens', 'girls')),
  created_at timestamptz default now()
);

-- Driver assignments
create table driver_assignments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade not null,
  driver_id uuid references drivers(id) on delete cascade not null,
  player_id uuid references players(id) on delete cascade not null,
  sort_order integer not null default 0,
  created_at timestamptz default now(),
  unique(session_id, player_id)
);

-- Expenses
create table expenses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete set null,
  description text not null,
  amount numeric(10,2) not null,
  month text not null,
  created_at timestamptz default now()
);

-- SMS log (track sent messages)
create table sms_log (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,
  type text not null check (type in ('spot_open', 'credit_low', 'payment_reminder', 'cancellation_confirm', 'driver_roster')),
  sent_at timestamptz default now()
);

-- RLS: Admin-only app with permissive anon policies
alter table players enable row level security;
alter table games enable row level security;
alter table game_players enable row level security;
alter table sessions enable row level security;
alter table session_players enable row level security;
alter table player_credits enable row level security;
alter table payments enable row level security;
alter table drivers enable row level security;
alter table driver_assignments enable row level security;
alter table expenses enable row level security;
alter table sms_log enable row level security;

create policy "Full access" on players for all using (true) with check (true);
create policy "Full access" on games for all using (true) with check (true);
create policy "Full access" on game_players for all using (true) with check (true);
create policy "Full access" on sessions for all using (true) with check (true);
create policy "Full access" on session_players for all using (true) with check (true);
create policy "Full access" on player_credits for all using (true) with check (true);
create policy "Full access" on payments for all using (true) with check (true);
create policy "Full access" on drivers for all using (true) with check (true);
create policy "Full access" on driver_assignments for all using (true) with check (true);
create policy "Full access" on expenses for all using (true) with check (true);
create policy "Full access" on sms_log for all using (true) with check (true);

-- Phase 2 migration: see schema-v2.sql
