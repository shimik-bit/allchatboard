-- ============================================================================
-- Diagnostic Survey - Landing Page Submissions
-- ============================================================================
-- Run in Supabase Studio (SQL Editor) on mrdnioqfgtyiyonoaafg.
--
-- Stores submissions from the construction/infrastructure diagnostic survey
-- at /diagnostic. Public form, no auth required to submit.
--
-- All fields are stored as nullable JSONB/text to be forgiving — the form
-- has a "save draft and continue" UX where partial submissions still get
-- persisted server-side.
-- ============================================================================

create table if not exists public.diagnostic_submissions (
  id uuid primary key default gen_random_uuid(),

  -- Lifecycle
  created_at timestamptz not null default now(),
  submitted_at timestamptz,           -- Set when the user clicks the final submit
  is_complete boolean not null default false,

  -- Anti-spam / analytics
  ip_address inet,
  user_agent text,
  referer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,

  -- Section 0: Business details
  company_name text,
  company_id text,                    -- ח.פ.
  years_in_industry text,
  team_size text,
  annual_revenue text,
  active_projects text,
  activity_type text,                 -- residential / commercial / infrastructure / renovation
  contact_name text,
  contact_phone text,
  contact_email text,

  -- Section 1: Financial X-ray (free text answers)
  q_cashflow_tracking text,
  q_payment_terms text,
  q_payment_followup text,
  q_project_profitability text,
  q_credit_lines text,
  q_known_exposures text,
  q_insurance text,
  q_litigation_exposure text,
  q_prevention_system text,
  q_legal_coverage text,
  q_financial_health_score int check (q_financial_health_score is null or (q_financial_health_score between 1 and 10)),

  -- Section 2: Tech & operations
  q_software_used text,
  q_quote_time text,
  q_field_reporting text,
  q_document_storage text,
  q_manual_processes text,
  q_morning_dashboard text,
  q_people_dependency int check (q_people_dependency is null or (q_people_dependency between 1 and 10)),
  q_first_delegate text,

  -- Section 3: Summary / action
  q_top_three_priorities text,
  q_urgency int check (q_urgency is null or (q_urgency between 1 and 10)),
  q_budget text,
  q_when_to_start text,

  -- Free-form catch-all for fields we might add later without a new migration
  extra jsonb default '{}'::jsonb,

  -- Internal notes (set by an admin reviewing the submission)
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  notes text
);

create index if not exists idx_diag_created on public.diagnostic_submissions(created_at desc);
create index if not exists idx_diag_email   on public.diagnostic_submissions(contact_email) where contact_email is not null;
create index if not exists idx_diag_complete on public.diagnostic_submissions(is_complete, submitted_at desc) where is_complete = true;

-- RLS: writes are unauthenticated (insert/update by anyone), reads are
-- super-admin only. The API route validates everything and uses the
-- admin client; we still enable RLS so a leaked anon key can't dump the
-- table.
alter table public.diagnostic_submissions enable row level security;

-- Empty policy = nobody can SELECT through the anon or auth keys
-- (admin client bypasses RLS).
-- For inserts/updates we go through the API route which uses createAdminClient.
