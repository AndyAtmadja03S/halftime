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

-- Votes
alter table posts add column if not exists upvotes int not null default 0;
alter table posts add column if not exists downvotes int not null default 0;
alter table posts add column if not exists score int not null default 0;

create table if not exists post_votes (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_votes_user_idx on post_votes (user_id);
create index if not exists posts_score_created_idx on posts (score desc, created_at desc);

-- Feed view: joins username and computes Reddit-style hot_score.
create or replace view posts_feed as
select
  p.id,
  p.user_id,
  p.device_id,
  p.audio_path,
  p.duration_ms,
  p.emoji,
  p.category,
  p.description,
  p.latitude,
  p.longitude,
  p.created_at,
  p.post_date,
  p.upvotes,
  p.downvotes,
  p.score,
  u.username,
  (
    sign(p.score)::float8 * log(greatest(abs(p.score), 1))
    + extract(epoch from p.created_at) / 45000.0
  ) as hot_score
from posts p
left join users u on u.id = p.user_id;

-- Atomic vote cast: upserts/deletes the vote row and adjusts cached counters
-- in one statement so concurrent votes don't drift.
create or replace function cast_vote(p_post_id uuid, p_user_id uuid, p_value int)
returns table (upvotes int, downvotes int, score int, my_vote int)
language plpgsql
as $$
declare
  v_prev int;
  v_delta_up int := 0;
  v_delta_down int := 0;
begin
  select value into v_prev
  from post_votes
  where post_id = p_post_id and user_id = p_user_id;
  v_prev := coalesce(v_prev, 0);

  if p_value not in (-1, 0, 1) then
    raise exception 'invalid_vote_value';
  end if;

  if p_value = 0 then
    delete from post_votes
    where post_id = p_post_id and user_id = p_user_id;
  else
    insert into post_votes (post_id, user_id, value)
    values (p_post_id, p_user_id, p_value)
    on conflict (post_id, user_id) do update
      set value = excluded.value, updated_at = now();
  end if;

  v_delta_up :=
    (case when p_value = 1 then 1 else 0 end)
    - (case when v_prev = 1 then 1 else 0 end);
  v_delta_down :=
    (case when p_value = -1 then 1 else 0 end)
    - (case when v_prev = -1 then 1 else 0 end);

  update posts
  set upvotes = posts.upvotes + v_delta_up,
      downvotes = posts.downvotes + v_delta_down,
      score = (posts.upvotes + v_delta_up) - (posts.downvotes + v_delta_down)
  where id = p_post_id;

  return query
  select p.upvotes, p.downvotes, p.score, p_value as my_vote
  from posts p
  where p.id = p_post_id;
end;
$$;

-- Comments
alter table posts add column if not exists comment_count int not null default 0;

create table if not exists post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_created_idx
  on post_comments (post_id, created_at asc);
create index if not exists post_comments_user_idx on post_comments (user_id);

create or replace function bump_comment_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update posts set comment_count = comment_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists post_comments_count_trigger on post_comments;
create trigger post_comments_count_trigger
after insert or delete on post_comments
for each row execute function bump_comment_count();

-- Push notification subscriptions
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  -- minutes behind UTC (getTimezoneOffset(): Sydney AEST = -600, NYC EST = 300)
  tz_offset int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user_idx on push_subscriptions (user_id);

-- Dedup log: one row per subscription per day per notification slot
-- Slots: 0=9am, 1=1pm, 2=5pm, 3=8pm (local time)
create table if not exists push_notification_logs (
  subscription_id uuid not null references push_subscriptions(id) on delete cascade,
  notif_date date not null,
  notif_slot int not null check (notif_slot between 0 and 3),
  sent_at timestamptz not null default now(),
  primary key (subscription_id, notif_date, notif_slot)
);
-- Similar-sound discovery: embed the AI-generated description with
-- OpenAI text-embedding-3-small (1536 dims) and rank posts by cosine distance.
create extension if not exists vector;
alter table posts add column if not exists embedding vector(1536);
create index if not exists posts_embedding_idx
  on posts using hnsw (embedding vector_cosine_ops);

-- Returns the top `match_count` posts whose embedding is closest (cosine) to
-- `query_embedding`. Pass `exclude_user` to drop the seed user's own posts.
create or replace function match_posts(
  query_embedding vector(1536),
  match_count int default 30,
  exclude_user uuid default null
) returns table(id uuid, similarity float)
language sql stable as $$
  select p.id, 1 - (p.embedding <=> query_embedding) as similarity
  from posts p
  where p.embedding is not null
    and (exclude_user is null or p.user_id is null or p.user_id <> exclude_user)
  order by p.embedding <=> query_embedding
  limit match_count;
$$;
