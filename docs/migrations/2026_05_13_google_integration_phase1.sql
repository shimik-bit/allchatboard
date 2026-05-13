-- ============================================================================
-- Google Integration - Phase 1 (PR #1): OAuth + DB Foundation
-- ============================================================================
-- Run this in Supabase Studio (SQL Editor) on mrdnioqfgtyiyonoaafg
--
-- Creates 3 tables:
--   1. google_oauth_connections     - per-user OAuth tokens (encrypted)
--   2. google_sheet_sync_configs    - per-workspace sync configuration
--   3. google_sheet_sync_queue      - events waiting to be pushed to Sheets
--
-- All tables follow our existing naming convention: snake_case, plural,
-- workspace_id FK for multi-tenancy + RLS isolation.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. OAuth connections (one row per user who connected their Google account)
-- ----------------------------------------------------------------------------
create table if not exists public.google_oauth_connections (
  id uuid primary key default gen_random_uuid(),

  -- Who owns this connection
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,

  -- The Google account that was connected
  google_email text not null,
  google_user_id text,        -- Google's stable user id (sub claim)
  google_picture_url text,    -- For display in the UI

  -- Encrypted tokens (AES-256-GCM via TOKEN_ENCRYPTION_KEY env var)
  -- Format: base64(iv) + ':' + base64(ciphertext+authTag)
  access_token_encrypted text not null,
  refresh_token_encrypted text,         -- May be null on re-auth (Google reuses)
  token_expires_at timestamptz not null,
  granted_scopes text[] not null default '{}',

  -- Lifecycle
  connected_at timestamptz not null default now(),
  last_refreshed_at timestamptz,
  last_used_at timestamptz,
  disconnected_at timestamptz,          -- Soft-delete on user disconnect

  -- One Google account per workspace per user. If they reconnect with a
  -- different Google account, we keep one row and overwrite.
  unique (workspace_id, user_id)
);

create index if not exists idx_goc_workspace on public.google_oauth_connections(workspace_id);
create index if not exists idx_goc_user on public.google_oauth_connections(user_id);
create index if not exists idx_goc_active on public.google_oauth_connections(workspace_id) where disconnected_at is null;

-- RLS: a user can only see their own connections in workspaces they belong to
alter table public.google_oauth_connections enable row level security;

create policy "users see their own google connections"
  on public.google_oauth_connections for select
  using (
    user_id = auth.uid()
    and workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and accepted_at is not null
    )
  );

create policy "users manage their own google connections"
  on public.google_oauth_connections for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ----------------------------------------------------------------------------
-- 2. Sync configurations (which events go to which Sheet)
-- ----------------------------------------------------------------------------
-- One row per (workspace × event_type). Each event_type is a separate sync
-- destination so the customer can choose, e.g.:
--   - new_members  → "Sheet A"
--   - bot_actions  → "Sheet B"
--   - daily_digest → "Sheet C" (or skip entirely)
-- ----------------------------------------------------------------------------
create table if not exists public.google_sheet_sync_configs (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  connection_id uuid not null references public.google_oauth_connections(id) on delete cascade,

  -- What kind of events get pushed to this sheet
  -- Keep as text rather than enum so PR #2/#3 can add types without migration
  event_type text not null check (event_type in (
    'gg_new_member',         -- New person joined a GroupGuard-protected group
    'gg_member_left',        -- Person left or was removed
    'gg_bot_action',          -- Bot took an action (remove, warn, etc.)
    'gg_spam_detected',       -- Spam flagged
    'attribution_lead'        -- Reserved for future Attribution feature
  )),

  -- Where to write
  spreadsheet_id text not null,         -- Google's spreadsheet identifier
  spreadsheet_name text,                -- Cached display name
  sheet_tab_name text not null default 'Sheet1',
  spreadsheet_url text,                 -- Cached for the UI link

  -- Behaviour
  is_enabled boolean not null default true,
  write_headers boolean not null default true,  -- Auto-write headers on first row

  -- Lifecycle
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_synced_at timestamptz,
  last_error text,                       -- Last failure message for the UI
  last_error_at timestamptz,
  consecutive_errors int not null default 0,

  unique (workspace_id, event_type)
);

create index if not exists idx_gssc_workspace on public.google_sheet_sync_configs(workspace_id);
create index if not exists idx_gssc_enabled on public.google_sheet_sync_configs(workspace_id, event_type) where is_enabled = true;

alter table public.google_sheet_sync_configs enable row level security;

create policy "members see their workspace sheet configs"
  on public.google_sheet_sync_configs for select
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and accepted_at is not null
    )
  );

create policy "members manage their workspace sheet configs"
  on public.google_sheet_sync_configs for all
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and accepted_at is not null
    )
  );


-- ----------------------------------------------------------------------------
-- 3. Sync queue (events waiting to be batched and pushed)
-- ----------------------------------------------------------------------------
-- Pattern: producers (webhook handlers, cron jobs) insert rows here. A worker
-- runs every ~30s and drains the queue per-config, batching ~50 rows per
-- Sheets API call. On success → delete the rows. On failure → increment
-- attempts; after 5 failures → mark as dead-letter for ops review.
-- ----------------------------------------------------------------------------
create table if not exists public.google_sheet_sync_queue (
  id bigserial primary key,

  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  config_id uuid not null references public.google_sheet_sync_configs(id) on delete cascade,
  event_type text not null,

  -- The payload to be appended. PR #3 will define per-event-type schemas
  -- (column ordering, header names) in code, not here, so the queue stays
  -- flexible.
  payload jsonb not null,

  -- Worker bookkeeping
  enqueued_at timestamptz not null default now(),
  attempts int not null default 0,
  last_attempt_at timestamptz,
  last_error text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'failed', 'dead'))
);

create index if not exists idx_gssq_pending on public.google_sheet_sync_queue(config_id, enqueued_at)
  where status in ('pending', 'failed');
create index if not exists idx_gssq_workspace on public.google_sheet_sync_queue(workspace_id);

-- No RLS on the queue: only the worker (service role) reads/writes here.
-- Users never query this table directly.
alter table public.google_sheet_sync_queue enable row level security;
-- Empty policy = no one can SELECT/INSERT/UPDATE/DELETE via the anon/auth keys.
-- The worker uses createAdminClient() which bypasses RLS.


-- ----------------------------------------------------------------------------
-- Convenience: updated_at trigger for sync_configs
-- ----------------------------------------------------------------------------
create or replace function public.tf_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_gssc_updated_at on public.google_sheet_sync_configs;
create trigger trg_gssc_updated_at
  before update on public.google_sheet_sync_configs
  for each row execute function public.tf_set_updated_at();
