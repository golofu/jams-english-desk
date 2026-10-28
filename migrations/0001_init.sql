-- English Desk: users, login sessions, per-user app data, per-user Gemini key.
create table if not exists users (
  id text primary key,            -- 'g_' + Google sub
  email text not null,
  name text not null default '',
  picture text not null default '',
  created_at integer not null,
  last_login_at integer not null
);
create index if not exists users_email on users (email);

create table if not exists sessions (
  token_hash text primary key,    -- sha256 of the cookie value; the raw token is never stored
  user_id text not null references users (id) on delete cascade,
  created_at integer not null,
  expires_at integer not null
);
create index if not exists sessions_user on sessions (user_id);

-- One JSON document per key per user: profile, sessions, phrases, snapshots.
create table if not exists app_state (
  user_id text not null references users (id) on delete cascade,
  key text not null,
  value text not null,
  updated_at integer not null,    -- also the optimistic-write version
  primary key (user_id, key)
);

-- The user's own free Gemini key, AES-GCM sealed with KEY_SECRET.
create table if not exists user_keys (
  user_id text primary key references users (id) on delete cascade,
  sealed_key text not null,
  updated_at integer not null
);
