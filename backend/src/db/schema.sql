-- Halftime / Lost & Found Frequencies - schema
--
-- Setup steps (run once in the Supabase SQL editor):
--   1. Create a new Supabase project (free tier is fine).
--   2. Storage: create a PRIVATE bucket named "sounds".
--   3. Run this file in the SQL editor.
--   4. Project Settings -> API: copy `Project URL` and the `service_role` key
--      into backend/.env as SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.

create extension if not exists "pgcrypto";

-- Phase 1 posts (device_id kept for legacy rows)
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  audio_path text not null,
  duration_ms int not null,
  emoji text not null,
  category text not null,
  description text not null,
  transcript text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  post_date date generated always as ((created_at at time zone 'UTC')::date) stored
);

alter table posts add column if not exists latitude double precision;
alter table posts add column if not exists longitude double precision;
alter table posts drop constraint if exists posts_device_id_post_date_key;

-- Accounts (username + password)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  token text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table posts add column if not exists user_id uuid references users(id);
create index if not exists posts_user_created_idx on posts (user_id, created_at desc);

create table if not exists friendships (
  user_id uuid not null references users(id),
  friend_id uuid not null references users(id),
  status text not null check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create index if not exists posts_created_at_idx on posts (created_at desc);
create index if not exists posts_device_created_idx on posts (device_id, created_at desc);
create index if not exists sessions_user_idx on sessions (user_id);
create index if not exists sessions_expires_idx on sessions (expires_at);

-- Shareable friend codes: 8 chars from Crockford base32 (0-9, A-Z minus I, L, O, U).
-- Stored uppercase, no hyphen. Client displays as XXXX-XXXX.
alter table users add column if not exists friend_code text;
create unique index if not exists users_friend_code_unique
  on users (friend_code) where friend_code is not null;

create index if not exists friendships_pair_status_idx
  on friendships (user_id, friend_id, status);
create index if not exists friendships_friend_user_status_idx
  on friendships (friend_id, user_id, status);
