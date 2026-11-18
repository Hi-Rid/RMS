```sql
-- Folio schema v2 (PostgreSQL 15+, Supabase). Jalankan utuh sebagai migrasi 0001.
-- Catatan: tabel referensi bernama `refs` karena `references` adalah kata cadangan SQL.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists vector with schema extensions;

-- ========== Enum ==========
create type ref_status      as enum ('inbox','selected','production','posted','evaluating','skipped');
create type content_status  as enum ('production','posted','evaluating');
create type checkpoint_kind as enum ('h24','d7','d30');
create type snapshot_status as enum ('pending','done','skipped');
create type element_kind    as enum ('idea','hook','audio','visual','topic');
create type snippet_kind    as enum ('caption','hashtag_set');

-- ========== Fungsi umum ==========
create or replace function set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

create or replace function touch_status_changed() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then new.status_changed_at = now(); end if;
  return new;
end $$;

-- ========== Data master (CRUD di Settings) ==========
create table pillars (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 60),
  slug text not null unique,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index pillars_name_uq on pillars (lower(btrim(name)));

create table series (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 60),
  slug text not null unique,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index series_name_uq on series (lower(btrim(name)));

create table hook_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 60),
  slug text not null unique,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index hook_types_name_uq on hook_types (lower(btrim(name)));

create table platforms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 60),
  slug text not null unique,
  domains text[] not null default '{}',          -- untuk deteksi dari URL, huruf kecil tanpa www
  is_source boolean not null default true,
  is_target boolean not null default true,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index platforms_name_uq on platforms (lower(btrim(name)));

create table formats (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 60),
  slug text not null unique,
  has_checkpoints boolean not null default true, -- false: tanpa snapshot (mis. Story)
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index formats_name_uq on formats (lower(btrim(name)));

-- ========== Sumber dan audio ==========
create table source_accounts (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references platforms(id) on delete restrict,
  handle text not null check (handle = lower(btrim(handle)) and handle !~ '^@' and length(handle) between 1 and 100),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform_id, handle)
);

create table audios (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 200),
  artist text not null default '' check (length(artist) <= 200),  -- kosong bila tidak diketahui
  is_original boolean not null default false,                      -- original sound / voiceover
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index audios_title_artist_uq on audios (lower(btrim(title)), lower(btrim(artist)));
create index audios_title_trgm on audios using gin (title gin_trgm_ops);

-- ========== Konten ==========
create table contents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 200),
  status content_status not null default 'production',   -- diturunkan dari Post dan Snapshot (lihat §10)
  format_id uuid references formats(id) on delete restrict,
  series_id uuid references series(id) on delete restrict,
  audio_id uuid references audios(id) on delete restrict,
  hook_text text,
  hook_type_id uuid references hook_types(id) on delete restrict,
  changes_note text,                                      -- apa yang diubah dari referensi
  notes text,
  work_url text check (work_url is null or work_url ~* '^https?://'),
  tags text[] not null default '{}' check (cardinality(tags) <= 30),
  planned_for date,
  final_rating smallint check (final_rating between 1 and 5),
  final_rating_note text,
  status_changed_at timestamptz not null default now(),
  archived_at timestamptz,
  search_text text not null default '',
  embedding vector(768),
  embedding_model text,
  embedding_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ========== Referensi ==========
create table refs (
  id uuid primary key default gen_random_uuid(),
  url text not null,                                      -- URL kanonik (dinormalisasi)
  url_original text not null,                             -- teks URL seperti dikirim
  platform_id uuid not null references platforms(id) on delete restrict,
  external_id text,                                       -- kode/ID postingan di platform
  format_id uuid references formats(id) on delete restrict,
  source_account_id uuid references source_accounts(id) on delete restrict,
  audio_id uuid references audios(id) on delete restrict,
  status ref_status not null default 'inbox',
  content_id uuid references contents(id) on delete restrict,
  content_position smallint check (content_position > 0), -- nomor 01, 02, ... dalam konten
  summary text,
  hook_text text,
  hook_type_id uuid references hook_types(id) on delete restrict,
  visual_notes text,
  notes text,
  tags text[] not null default '{}' check (cardinality(tags) <= 30),
  saved_likes integer check (saved_likes >= 0),
  saved_saves integer check (saved_saves >= 0),
  skipped_reason text,
  saved_at timestamptz not null default now(),
  status_changed_at timestamptz not null default now(),
  archived_at timestamptz,
  search_text text not null default '',
  embedding vector(768),
  embedding_model text,
  embedding_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint refs_status_content_chk check (
    (content_id is null and status in ('inbox','selected','skipped'))
    or (content_id is not null and status in ('production','posted','evaluating'))
  ),
  constraint refs_position_chk check ((content_id is null) = (content_position is null)),
  constraint refs_content_position_uq unique (content_id, content_position) deferrable initially deferred
);
create unique index refs_url_uq on refs (url);
create unique index refs_platform_external_uq on refs (platform_id, external_id) where external_id is not null;

create table ref_pillars (
  ref_id uuid not null references refs(id) on delete cascade,
  pillar_id uuid not null references pillars(id) on delete restrict,
  primary key (ref_id, pillar_id)
);

create table ref_elements (
  ref_id uuid not null references refs(id) on delete cascade,
  element element_kind not null,
  primary key (ref_id, element)
);

create table ref_images (
  id uuid primary key default gen_random_uuid(),
  ref_id uuid not null references refs(id) on delete cascade,
  storage_path text not null unique,
  width int,
  height int,
  bytes int,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

create table content_pillars (
  content_id uuid not null references contents(id) on delete cascade,
  pillar_id uuid not null references pillars(id) on delete restrict,
  primary key (content_id, pillar_id)
);

create table content_checklist (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references contents(id) on delete cascade,
  label text not null check (length(btrim(label)) between 1 and 120),
  is_done boolean not null default false,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

-- ========== Post dan Snapshot ==========
create table posts (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references contents(id) on delete cascade,
  platform_id uuid not null references platforms(id) on delete restrict,
  url text check (url is null or url ~* '^https?://'),
  caption text,
  posted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_id, platform_id)
);

create table snapshots (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  checkpoint checkpoint_kind not null,
  due_at timestamptz not null,                            -- posted_at + 24 jam / 7 hari / 30 hari
  status snapshot_status not null default 'pending',
  views integer check (views >= 0),
  likes integer check (likes >= 0),
  comments integer check (comments >= 0),
  saves integer check (saves >= 0),
  shares integer check (shares >= 0),
  follower_delta integer,
  reach integer check (reach >= 0),
  avg_watch_seconds numeric(7,1) check (avg_watch_seconds >= 0),
  retention_pct numeric(5,2) check (retention_pct between 0 and 100),
  profile_visits integer check (profile_visits >= 0),
  rating smallint check (rating between 1 and 5),
  notes text,
  filled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, checkpoint),
  check (status <> 'done' or filled_at is not null)
);

-- ========== Library caption, pengaturan, log ==========
create table snippets (
  id uuid primary key default gen_random_uuid(),
  kind snippet_kind not null,
  title text not null check (length(btrim(title)) between 1 and 120),
  body text not null check (length(btrim(body)) > 0),
  pillar_id uuid references pillars(id) on delete set null,
  platform_id uuid references platforms(id) on delete set null,
  use_count integer not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table app_settings (
  id smallint primary key default 1 check (id = 1),       -- satu baris saja
  weekly_post_target smallint not null default 3 check (weekly_post_target between 0 and 50),
  insight_min_sample smallint not null default 3 check (insight_min_sample >= 1),
  default_checklist text[] not null default array['Script / outline','Shoot or draw','Edit','Cover','Caption and hashtags','Audio checked'],
  ingest_token_hash text,                                  -- sha256 hex; token asli tampil sekali
  ingest_token_hint text,                                  -- 4 karakter terakhir
  ingest_token_rotated_at timestamptz,
  ai_enabled boolean not null default false,
  ai_provider text not null default 'google' check (ai_provider in ('google','groq','openrouter')),
  ai_text_model text,                                      -- null: pakai default dari env
  ai_vision_model text,
  ai_embed_model text,
  ai_daily_cap integer not null default 100 check (ai_daily_cap >= 0),
  ai_output_language text not null default 'id' check (ai_output_language in ('id','en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into app_settings (id) values (1) on conflict do nothing;

create table status_events (
  id bigint generated always as identity primary key,
  entity text not null check (entity in ('ref','content')),
  entity_id uuid not null,
  from_status text,
  to_status text not null,
  created_at timestamptz not null default now()
);
create index status_events_entity_idx on status_events (entity, entity_id, created_at);

create table system_logs (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('ingest','cron','email','ai','webhook','import','auth')),
  level text not null default 'info' check (level in ('info','warn','error')),
  message text not null,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index system_logs_created_idx on system_logs (created_at desc);

create table ai_usage (
  id bigint generated always as identity primary key,
  feature text not null,
  provider text not null,
  model text not null,
  status text not null check (status in ('ok','error','rate_limited','blocked_cap')),
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  error text,
  created_at timestamptz not null default now()
);
create index ai_usage_created_idx on ai_usage (created_at desc);

-- ========== Indeks ==========
create index refs_status_idx       on refs (status) where archived_at is null;
create index refs_saved_at_idx     on refs (saved_at desc);
create index refs_unused_idx       on refs (saved_at desc) where content_id is null and archived_at is null and status <> 'skipped';
create index refs_tags_gin         on refs using gin (tags);
create index refs_search_trgm      on refs using gin (search_text gin_trgm_ops);
create index refs_source_idx       on refs (source_account_id);
create index refs_audio_idx        on refs (audio_id);
create index refs_content_idx      on refs (content_id);
create index refs_format_idx       on refs (format_id);
create index refs_embedding_idx    on refs using hnsw (embedding vector_cosine_ops);
create index ref_pillars_pillar_idx on ref_pillars (pillar_id);
create index ref_images_ref_idx    on ref_images (ref_id, position);
create index contents_status_idx   on contents (status) where archived_at is null;
create index contents_created_idx  on contents (created_at desc);
create index contents_planned_idx  on contents (planned_for) where planned_for is not null;
create index contents_tags_gin     on contents using gin (tags);
create index contents_search_trgm  on contents using gin (search_text gin_trgm_ops);
create index contents_audio_idx    on contents (audio_id);
create index contents_series_idx   on contents (series_id);
create index contents_embedding_idx on contents using hnsw (embedding vector_cosine_ops);
create index content_pillars_pillar_idx on content_pillars (pillar_id);
create index content_checklist_idx on content_checklist (content_id, position);
create index posts_content_idx     on posts (content_id);
create index posts_posted_idx      on posts (posted_at desc);
create index snapshots_due_idx     on snapshots (due_at) where status = 'pending';
create index snapshots_post_idx    on snapshots (post_id);
create index source_accounts_handle_trgm on source_accounts using gin (handle gin_trgm_ops);

-- ========== Teks pencarian (pg_trgm, ILIKE '%kata%') ==========
create or replace function build_ref_search_text(r public.refs) returns text
language sql stable set search_path = '' as $$
  select lower(concat_ws(' ',
    r.summary, r.hook_text, r.visual_notes, r.notes, array_to_string(r.tags, ' '),
    (select concat_ws(' ', a.title, a.artist) from public.audios a where a.id = r.audio_id),
    (select s.handle from public.source_accounts s where s.id = r.source_account_id),
    r.url));
$$;

create or replace function build_content_search_text(c public.contents) returns text
language sql stable set search_path = '' as $$
  select lower(concat_ws(' ',
    c.title, c.hook_text, c.changes_note, c.notes, array_to_string(c.tags, ' '),
    (select concat_ws(' ', a.title, a.artist) from public.audios a where a.id = c.audio_id),
    (select s.name from public.series s where s.id = c.series_id)));
$$;

create or replace function refs_before_write() returns trigger
language plpgsql set search_path = '' as $$
begin new.search_text := public.build_ref_search_text(new); return new; end $$;

create or replace function contents_before_write() returns trigger
language plpgsql set search_path = '' as $$
begin new.search_text := public.build_content_search_text(new); return new; end $$;

-- Rename audio/sumber/series memicu penghitungan ulang search_text.
create or replace function refresh_dependents() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'audios' then
    update public.refs set updated_at = now() where audio_id = new.id;
    update public.contents set updated_at = now() where audio_id = new.id;
  elsif tg_table_name = 'source_accounts' then
    update public.refs set updated_at = now() where source_account_id = new.id;
  elsif tg_table_name = 'series' then
    update public.contents set updated_at = now() where series_id = new.id;
  end if;
  return null;
end $$;

create or replace function log_status_event() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.status = new.status then return null; end if;
  insert into public.status_events (entity, entity_id, from_status, to_status)
  values (tg_argv[0], new.id, case when tg_op = 'UPDATE' then old.status::text end, new.status::text);
  return null;
end $$;

create trigger refs_search_trg     before insert or update on refs     for each row execute function refs_before_write();
create trigger contents_search_trg before insert or update on contents for each row execute function contents_before_write();
create trigger audios_refresh_trg  after update of title, artist on audios          for each row execute function refresh_dependents();
create trigger sources_refresh_trg after update of handle on source_accounts        for each row execute function refresh_dependents();
create trigger series_refresh_trg  after update of name on series                   for each row execute function refresh_dependents();
create trigger refs_status_ts      before update on refs     for each row execute function touch_status_changed();
create trigger contents_status_ts  before update on contents for each row execute function touch_status_changed();
create trigger refs_status_log     after insert or update of status on refs     for each row execute function log_status_event('ref');
create trigger contents_status_log after insert or update of status on contents for each row execute function log_status_event('content');

-- updated_at otomatis untuk semua tabel yang punya kolomnya
do $$ declare t text; begin
  for t in select c.table_name from information_schema.columns c
           join pg_tables p on p.tablename = c.table_name and p.schemaname = 'public'
           where c.table_schema = 'public' and c.column_name = 'updated_at' loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_set_updated_at', t);
  end loop;
end $$;

-- ========== View untuk Insight dan statistik ==========
create view tag_counts with (security_invoker = true) as
select tag, count(*)::int as uses from (
  select unnest(tags) as tag from refs where archived_at is null
  union all
  select unnest(tags) from contents where archived_at is null
) t group by tag;

create view audio_usage with (security_invoker = true) as
select a.id as audio_id,
  (select count(*) from refs r where r.audio_id = a.id and r.archived_at is null)::int as ref_count,
  (select count(*) from contents c where c.audio_id = a.id and c.archived_at is null)::int as content_count,
  (select max(coalesce((select max(p.posted_at) from posts p where p.content_id = c.id), c.created_at))
     from contents c where c.audio_id = a.id and c.archived_at is null) as last_used_at
from audios a;

-- Skor konten: rating akhir bila ada, selain itu rata-rata rating snapshot selesai.
create view content_scores with (security_invoker = true) as
select c.id as content_id,
  coalesce(c.final_rating::numeric,
    (select avg(s.rating) from snapshots s join posts p on p.id = s.post_id
      where p.content_id = c.id and s.status = 'done' and s.rating is not null)) as score
from contents c where c.archived_at is null;

-- Metrik konten: jumlah snapshot terbaru yang selesai per Post.
create view content_metrics with (security_invoker = true) as
select p.content_id,
  sum(ls.views)::bigint as views, sum(ls.likes)::bigint as likes, sum(ls.comments)::bigint as comments,
  sum(ls.saves)::bigint as saves, sum(ls.shares)::bigint as shares, sum(ls.follower_delta)::bigint as follower_delta
from posts p
join lateral (
  select s.* from snapshots s where s.post_id = p.id and s.status = 'done' order by s.due_at desc, s.checkpoint desc limit 1
) ls on true
group by p.content_id;

create view source_stats with (security_invoker = true) as
select sa.id as source_account_id,
  count(r.id) filter (where r.archived_at is null)::int as ref_count,
  count(r.id) filter (where r.archived_at is null and r.status in ('selected','production','posted','evaluating'))::int as selected_count,
  count(r.id) filter (where r.archived_at is null and r.content_id is not null)::int as produced_count,
  (select avg(cs.score) from content_scores cs where cs.content_id in
     (select r2.content_id from refs r2 where r2.source_account_id = sa.id and r2.content_id is not null)) as avg_score
from source_accounts sa left join refs r on r.source_account_id = sa.id
group by sa.id;

-- ========== Keamanan: RLS aktif tanpa kebijakan (akses lewat server saja) ==========
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon, authenticated;
    revoke all on all sequences in schema public from anon, authenticated;
    revoke execute on all functions in schema public from anon, authenticated;
    alter default privileges in schema public revoke all on tables from anon, authenticated;
    alter default privileges in schema public revoke all on sequences from anon, authenticated;
  end if;
end $$;

-- ========== Seed data master (semua bisa diubah di Settings) ==========
insert into pillars (name, slug, sort_order) values
  ('Fashion / OOTD', 'fashion-ootd', 1),
  ('Art, sketching, journal', 'art-sketching-journal', 2),
  ('DIY, craft, custom, rework', 'diy-craft-rework', 3),
  ('Lifestyle, selfcare, glow up', 'lifestyle-selfcare', 4),
  ('Beauty and skincare', 'beauty-skincare', 5),
  ('Room and desk setup', 'room-desk-setup', 6),
  ('Food and cafe', 'food-cafe', 7),
  ('Travel and places', 'travel-places', 8)
on conflict do nothing;

insert into series (name, slug, sort_order) values
  ('Bag contents / flat-lay', 'bag-flat-lay', 1),
  ('Fit check / OOTD', 'fit-check', 2),
  ('POV shoes / feet', 'pov-shoes', 3),
  ('Sketch / illustration / art journal', 'sketch-journal', 4),
  ('Craft / DIY', 'craft-diy', 5)
on conflict do nothing;

insert into hook_types (name, slug, sort_order) values
  ('POV', 'pov', 1),
  ('Before / after', 'before-after', 2),
  ('Question', 'question', 3),
  ('Bold statement', 'bold-statement', 4),
  ('List (listicle)', 'listicle', 5),
  ('Reveal / transformation', 'reveal', 6),
  ('Relatable moment', 'relatable', 7),
  ('Tutorial / how-to', 'tutorial', 8),
  ('Storytime', 'storytime', 9),
  ('Stop doing this (mistake)', 'mistake', 10),
  ('Challenge / time limit', 'challenge', 11),
  ('Curiosity gap (wait for it)', 'curiosity-gap', 12),
  ('Day in my life / routine', 'routine', 13)
on conflict do nothing;

insert into platforms (name, slug, domains, is_source, is_target, sort_order) values
  ('Instagram', 'instagram', '{instagram.com,instagr.am}', true, true, 1),
  ('TikTok', 'tiktok', '{tiktok.com,vm.tiktok.com,vt.tiktok.com}', true, true, 2),
  ('YouTube', 'youtube', '{youtube.com,youtu.be}', true, true, 3),
  ('Facebook', 'facebook', '{facebook.com,fb.com,fb.watch}', true, true, 4),
  ('Threads', 'threads', '{threads.net,threads.com}', true, true, 5),
  ('Other', 'other', '{}', true, true, 6)
on conflict do nothing;

insert into formats (name, slug, has_checkpoints, sort_order) values
  ('Reel', 'reel', true, 1),
  ('Carousel', 'carousel', true, 2),
  ('Story', 'story', false, 3)
on conflict do nothing;