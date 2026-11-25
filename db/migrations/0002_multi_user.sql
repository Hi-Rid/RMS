-- Multi-user data isolation migration (0002)
-- Adds user_id ownership across all creator, master, settings, and log tables,
-- backfills existing rows to the earliest registered Supabase auth user,
-- and scopes all uniqueness constraints & indexes per user_id.

-- 1. Add nullable user_id columns first
alter table public.pillars         add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.series          add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.hook_types      add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.platforms       add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.formats         add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.source_accounts add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.audios          add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.contents        add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.refs            add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.posts           add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.snapshots       add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.snippets        add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.app_settings    add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.system_logs     add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.ai_usage        add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.status_events   add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- 2. Backfill existing rows to the initial user if present; otherwise purge unowned seed rows
do $$
declare
  owner_uid uuid;
begin
  select id into owner_uid from auth.users order by created_at asc limit 1;

  if owner_uid is not null then
    update public.pillars         set user_id = owner_uid where user_id is null;
    update public.series          set user_id = owner_uid where user_id is null;
    update public.hook_types      set user_id = owner_uid where user_id is null;
    update public.platforms       set user_id = owner_uid where user_id is null;
    update public.formats         set user_id = owner_uid where user_id is null;
    update public.source_accounts set user_id = owner_uid where user_id is null;
    update public.audios          set user_id = owner_uid where user_id is null;
    update public.contents        set user_id = owner_uid where user_id is null;
    update public.refs            set user_id = owner_uid where user_id is null;
    update public.posts           set user_id = owner_uid where user_id is null;
    update public.snapshots       set user_id = owner_uid where user_id is null;
    update public.snippets        set user_id = owner_uid where user_id is null;
    update public.app_settings    set user_id = owner_uid where user_id is null;
    update public.system_logs     set user_id = owner_uid where user_id is null;
    update public.ai_usage        set user_id = owner_uid where user_id is null;
    update public.status_events   set user_id = owner_uid where user_id is null;
  else
    delete from public.snapshots;
    delete from public.posts;
    delete from public.refs;
    delete from public.contents;
    delete from public.snippets;
    delete from public.source_accounts;
    delete from public.audios;
    delete from public.pillars;
    delete from public.series;
    delete from public.hook_types;
    delete from public.platforms;
    delete from public.formats;
    delete from public.app_settings;
    delete from public.system_logs;
    delete from public.ai_usage;
    delete from public.status_events;
  end if;
end $$;

-- 3. Convert app_settings from singleton id=1 to per-user UUID rows
alter table public.app_settings drop constraint if exists app_settings_pkey;
alter table public.app_settings drop constraint if exists app_settings_id_check;
alter table public.app_settings drop column if exists id;
alter table public.app_settings add column id uuid not null default gen_random_uuid() primary key;
alter table public.app_settings alter column user_id set not null;
alter table public.app_settings add constraint app_settings_user_id_uq unique (user_id);
create unique index if not exists app_settings_ingest_token_hash_uq
  on public.app_settings (ingest_token_hash)
  where ingest_token_hash is not null;

-- 4. Enforce NOT NULL on all owned tables
alter table public.pillars         alter column user_id set not null;
alter table public.series          alter column user_id set not null;
alter table public.hook_types      alter column user_id set not null;
alter table public.platforms       alter column user_id set not null;
alter table public.formats         alter column user_id set not null;
alter table public.source_accounts alter column user_id set not null;
alter table public.audios          alter column user_id set not null;
alter table public.contents        alter column user_id set not null;
alter table public.refs            alter column user_id set not null;
alter table public.posts           alter column user_id set not null;
alter table public.snapshots       alter column user_id set not null;
alter table public.snippets        alter column user_id set not null;
alter table public.ai_usage        alter column user_id set not null;

-- 5. Replace global uniqueness constraints with per-user uniqueness constraints
alter table public.pillars drop constraint if exists pillars_slug_key;
drop index if exists public.pillars_name_uq;
alter table public.pillars add constraint pillars_user_slug_uq unique (user_id, slug);
create unique index pillars_user_name_uq on public.pillars (user_id, lower(btrim(name)));
create index if not exists pillars_user_idx on public.pillars (user_id);

alter table public.series drop constraint if exists series_slug_key;
drop index if exists public.series_name_uq;
alter table public.series add constraint series_user_slug_uq unique (user_id, slug);
create unique index series_user_name_uq on public.series (user_id, lower(btrim(name)));
create index if not exists series_user_idx on public.series (user_id);

alter table public.hook_types drop constraint if exists hook_types_slug_key;
drop index if exists public.hook_types_name_uq;
alter table public.hook_types add constraint hook_types_user_slug_uq unique (user_id, slug);
create unique index hook_types_user_name_uq on public.hook_types (user_id, lower(btrim(name)));
create index if not exists hook_types_user_idx on public.hook_types (user_id);

alter table public.platforms drop constraint if exists platforms_slug_key;
drop index if exists public.platforms_name_uq;
alter table public.platforms add constraint platforms_user_slug_uq unique (user_id, slug);
create unique index platforms_user_name_uq on public.platforms (user_id, lower(btrim(name)));
create index if not exists platforms_user_idx on public.platforms (user_id);

alter table public.formats drop constraint if exists formats_slug_key;
drop index if exists public.formats_name_uq;
alter table public.formats add constraint formats_user_slug_uq unique (user_id, slug);
create unique index formats_user_name_uq on public.formats (user_id, lower(btrim(name)));
create index if not exists formats_user_idx on public.formats (user_id);

alter table public.source_accounts drop constraint if exists source_accounts_platform_id_handle_key;
alter table public.source_accounts add constraint source_accounts_user_platform_handle_uq unique (user_id, platform_id, handle);
create index if not exists source_accounts_user_idx on public.source_accounts (user_id);

drop index if exists public.audios_title_artist_uq;
create unique index audios_user_title_artist_uq on public.audios (user_id, lower(btrim(title)), lower(btrim(artist)));
create index if not exists audios_user_idx on public.audios (user_id);

drop index if exists public.refs_url_uq;
drop index if exists public.refs_platform_external_uq;
create unique index refs_user_url_uq on public.refs (user_id, url);
create unique index refs_user_platform_external_uq
  on public.refs (user_id, platform_id, external_id)
  where external_id is not null;
create index if not exists refs_user_saved_at_idx on public.refs (user_id, saved_at desc);

create index if not exists contents_user_created_idx on public.contents (user_id, created_at desc);
create index if not exists posts_user_posted_idx on public.posts (user_id, posted_at desc);
create index if not exists snapshots_user_due_idx on public.snapshots (user_id, due_at) where status = 'pending';
create index if not exists snippets_user_idx on public.snippets (user_id);
create index if not exists system_logs_user_created_idx on public.system_logs (user_id, created_at desc);
create index if not exists ai_usage_user_created_idx on public.ai_usage (user_id, created_at desc);

-- 6. Update status_events trigger to propagate user_id
create or replace function public.log_status_event() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.status = new.status then return null; end if;
  insert into public.status_events (user_id, entity, entity_id, from_status, to_status)
  values (new.user_id, tg_argv[0], new.id, case when tg_op = 'UPDATE' then old.status::text end, new.status::text);
  return null;
end $$;

-- 7. Rebuild analytical views cleanly with user_id dimension
drop view if exists public.source_stats;
drop view if exists public.content_metrics;
drop view if exists public.content_scores;
drop view if exists public.audio_usage;
drop view if exists public.tag_counts;

create view public.tag_counts with (security_invoker = true) as
select user_id, tag, count(*)::int as uses from (
  select user_id, unnest(tags) as tag from public.refs where archived_at is null
  union all
  select user_id, unnest(tags) from public.contents where archived_at is null
) t group by user_id, tag;

create view public.audio_usage with (security_invoker = true) as
select a.id as audio_id, a.user_id,
  (select count(*) from public.refs r where r.audio_id = a.id and r.archived_at is null)::int as ref_count,
  (select count(*) from public.contents c where c.audio_id = a.id and c.archived_at is null)::int as content_count,
  (select max(coalesce((select max(p.posted_at) from public.posts p where p.content_id = c.id), c.created_at))
     from public.contents c where c.audio_id = a.id and c.archived_at is null) as last_used_at
from public.audios a;

create view public.content_scores with (security_invoker = true) as
select c.id as content_id, c.user_id,
  coalesce(c.final_rating::numeric,
    (select avg(s.rating) from public.snapshots s join public.posts p on p.id = s.post_id
      where p.content_id = c.id and s.status = 'done' and s.rating is not null)) as score
from public.contents c where c.archived_at is null;

create view public.content_metrics with (security_invoker = true) as
select p.content_id, p.user_id,
  sum(ls.views)::bigint as views, sum(ls.likes)::bigint as likes, sum(ls.comments)::bigint as comments,
  sum(ls.saves)::bigint as saves, sum(ls.shares)::bigint as shares, sum(ls.follower_delta)::bigint as follower_delta
from public.posts p
join lateral (
  select s.* from public.snapshots s where s.post_id = p.id and s.status = 'done' order by s.due_at desc, s.checkpoint desc limit 1
) ls on true
group by p.content_id, p.user_id;

create view public.source_stats with (security_invoker = true) as
select sa.id as source_account_id, sa.user_id,
  count(r.id) filter (where r.archived_at is null)::int as ref_count,
  count(r.id) filter (where r.archived_at is null and r.status in ('selected','production','posted','evaluating'))::int as selected_count,
  count(r.id) filter (where r.archived_at is null and r.content_id is not null)::int as produced_count,
  (select avg(cs.score) from public.content_scores cs where cs.content_id in
     (select r2.content_id from public.refs r2 where r2.source_account_id = sa.id and r2.content_id is not null)) as avg_score
from public.source_accounts sa left join public.refs r on r.source_account_id = sa.id
group by sa.id, sa.user_id;
