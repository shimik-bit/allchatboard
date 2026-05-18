-- ============================================================================
-- Forms - Public-facing surveys built on top of tables/fields/records
-- ============================================================================
-- A form ties to a table and exposes a curated subset of that table's fields
-- as a public, brandable survey. Submissions become rows in `records`
-- (with source='public_form'), so they inherit every other TaskFlow capability:
-- views, filters, exports, AI extraction, Sheets sync, automations, etc.
--
-- This means there is NO separate form_submissions table — the table the
-- form is built FROM is also where its submissions land.
-- ============================================================================

create or replace function public.tf_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create table if not exists public.forms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  table_id uuid not null references public.tables(id) on delete cascade,

  -- Public URL: /f/<slug>. Unique per workspace.
  slug text not null,
  title text not null,
  description text,

  -- draft → editable, no public URL yet
  -- published → live, accepts submissions
  -- archived → URL still resolves but shows "form closed"
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),

  -- Per-field configuration. Shape:
  --   {
  --     "<field_id>": {
  --       "visible": true,
  --       "position": 1,
  --       "section_id": "<uuid>",          -- optional grouping
  --       "label_override": "...",          -- override field.name
  --       "help_text": "...",
  --       "placeholder": "...",
  --       "required_override": true,        -- override field.is_required
  --       "conditional_rules": {            -- (PR #4) show only if conditions met
  --         "show_if": [
  --           { "field_id": "...", "op": "equals", "value": "yes" }
  --         ]
  --       }
  --     }
  --   }
  field_settings jsonb not null default '{}'::jsonb,

  -- Optional sections (for grouping fields visually):
  --   [ { "id": "<uuid>", "title": "...", "description": "...", "position": 0 } ]
  sections jsonb not null default '[]'::jsonb,

  -- Branding
  theme text not null default 'cream' check (theme in ('cream', 'purple', 'dark', 'minimal')),
  brand_color text,
  logo_url text,
  hero_title text,
  hero_subtitle text,
  cta_label text default 'התחל',
  thank_you_title text default 'תודה!',
  thank_you_message text,
  success_redirect_url text,

  -- Behaviour
  notification_emails text[] not null default '{}',
  show_progress_bar boolean not null default true,
  allow_multiple_submissions boolean not null default true,
  require_phone boolean not null default false,
  require_email boolean not null default false,

  -- Lifecycle
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  archived_at timestamptz,

  -- Stats cache (updated on submission)
  total_submissions int not null default 0,
  total_completed int not null default 0,
  last_submission_at timestamptz,

  unique (workspace_id, slug)
);

create index if not exists idx_forms_workspace on public.forms(workspace_id);
create index if not exists idx_forms_table on public.forms(table_id);
create index if not exists idx_forms_status on public.forms(workspace_id, status);
create index if not exists idx_forms_slug on public.forms(slug) where status = 'published';

drop trigger if exists trg_forms_updated_at on public.forms;
create trigger trg_forms_updated_at
  before update on public.forms
  for each row execute function public.tf_set_updated_at();

alter table public.forms enable row level security;

create policy "members see their workspace forms"
  on public.forms for select
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and accepted_at is not null
    )
  );

create policy "members manage their workspace forms"
  on public.forms for all
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and accepted_at is not null
    )
  );

-- Plan limits for the Forms feature
alter table public.plan_limits
  add column if not exists max_forms int default 0,
  add column if not exists feature_forms boolean default false;

update public.plan_limits set max_forms = 0,   feature_forms = false where plan = 'trial';
update public.plan_limits set max_forms = 1,   feature_forms = true  where plan = 'starter';
update public.plan_limits set max_forms = 10,  feature_forms = true  where plan = 'business';
update public.plan_limits set max_forms = 999, feature_forms = true  where plan = 'enterprise';
