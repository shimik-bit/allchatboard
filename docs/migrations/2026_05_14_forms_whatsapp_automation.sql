-- Adds WhatsApp automation configuration to forms.
-- Applied to production via Supabase MCP — committed for reference.

alter table public.forms
  add column if not exists whatsapp_automation jsonb default null;

comment on column public.forms.whatsapp_automation is
  'Optional WhatsApp send-on-submit config. See lib/forms/types.ts WhatsappAutomation type.';
