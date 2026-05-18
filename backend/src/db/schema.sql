-- Halftime / Lost & Found Frequencies - Phase 1 schema
--
-- Setup steps (run once in the Supabase SQL editor):
--   1. Create a new Supabase project (free tier is fine).
--   2. Storage: create a PRIVATE bucket named "sounds".
--   3. Run this file in the SQL editor.
--   4. Project Settings -> API: copy `Project URL` and the `service_role` key
--      into backend/.env as SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.

create extension if not exists "pgcrypto";

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

-- For pre-existing installs (run safely):
alter table posts add column if not exists latitude double precision;
alter table posts add column if not exists longitude double precision;

-- Migration: allow multiple posts per device per day.
-- The unique constraint was previously named posts_device_id_post_date_key
-- on most Supabase installs; drop it if it still exists.
alter table posts drop constraint if exists posts_device_id_post_date_key;

create index if not exists posts_created_at_idx on posts (created_at desc);
create index if not exists posts_device_created_idx on posts (device_id, created_at desc);
