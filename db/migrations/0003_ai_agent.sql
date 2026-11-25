-- 0003_ai_agent.sql
-- Adds Autonomous AI Content Agent configuration, Creator Persona fields, and persisted cover_url on refs.

alter table public.app_settings
  add column if not exists ai_auto_enrich boolean not null default true,
  add column if not exists ai_ingest_mode text not null default 'inbox',
  add column if not exists creator_niche text,
  add column if not exists creator_audience text,
  add column if not exists creator_voice text;

alter table public.app_settings
  drop constraint if exists app_settings_ai_ingest_mode_check;

alter table public.app_settings
  add constraint app_settings_ai_ingest_mode_check
  check (ai_ingest_mode in ('inbox', 'selected', 'auto_draft'));

alter table public.refs
  add column if not exists cover_url text;
