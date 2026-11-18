-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."checkpoint_kind" AS ENUM('h24', 'd7', 'd30');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('production', 'posted', 'evaluating');--> statement-breakpoint
CREATE TYPE "public"."element_kind" AS ENUM('idea', 'hook', 'audio', 'visual', 'topic');--> statement-breakpoint
CREATE TYPE "public"."ref_status" AS ENUM('inbox', 'selected', 'production', 'posted', 'evaluating', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."snapshot_status" AS ENUM('pending', 'done', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."snippet_kind" AS ENUM('caption', 'hashtag_set');--> statement-breakpoint
CREATE TABLE "schema_migrations" (
	"name" text PRIMARY KEY NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "schema_migrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "platforms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"domains" text[] DEFAULT '{""}' NOT NULL,
	"is_source" boolean DEFAULT true NOT NULL,
	"is_target" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platforms_slug_key" UNIQUE("slug"),
	CONSTRAINT "platforms_name_check" CHECK ((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 60))
);
--> statement-breakpoint
ALTER TABLE "platforms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "source_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform_id" uuid NOT NULL,
	"handle" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_accounts_platform_id_handle_key" UNIQUE("platform_id","handle"),
	CONSTRAINT "source_accounts_handle_check" CHECK ((handle = lower(btrim(handle))) AND (handle !~ '^@'::text) AND ((length(handle) >= 1) AND (length(handle) <= 100)))
);
--> statement-breakpoint
ALTER TABLE "source_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "formats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"has_checkpoints" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "formats_slug_key" UNIQUE("slug"),
	CONSTRAINT "formats_name_check" CHECK ((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 60))
);
--> statement-breakpoint
ALTER TABLE "formats" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "contents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"status" "content_status" DEFAULT 'production' NOT NULL,
	"format_id" uuid,
	"series_id" uuid,
	"audio_id" uuid,
	"hook_text" text,
	"hook_type_id" uuid,
	"changes_note" text,
	"notes" text,
	"work_url" text,
	"tags" text[] DEFAULT '{""}' NOT NULL,
	"planned_for" date,
	"final_rating" smallint,
	"final_rating_note" text,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"search_text" text DEFAULT '' NOT NULL,
	"embedding" vector(768),
	"embedding_model" text,
	"embedding_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contents_final_rating_check" CHECK ((final_rating >= 1) AND (final_rating <= 5)),
	CONSTRAINT "contents_tags_check" CHECK (cardinality(tags) <= 30),
	CONSTRAINT "contents_title_check" CHECK ((length(btrim(title)) >= 1) AND (length(btrim(title)) <= 200)),
	CONSTRAINT "contents_work_url_check" CHECK ((work_url IS NULL) OR (work_url ~* '^https?://'::text))
);
--> statement-breakpoint
ALTER TABLE "contents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "series_slug_key" UNIQUE("slug"),
	CONSTRAINT "series_name_check" CHECK ((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 60))
);
--> statement-breakpoint
ALTER TABLE "series" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"artist" text DEFAULT '' NOT NULL,
	"is_original" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audios_artist_check" CHECK (length(artist) <= 200),
	CONSTRAINT "audios_title_check" CHECK ((length(btrim(title)) >= 1) AND (length(btrim(title)) <= 200))
);
--> statement-breakpoint
ALTER TABLE "audios" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hook_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hook_types_slug_key" UNIQUE("slug"),
	CONSTRAINT "hook_types_name_check" CHECK ((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 60))
);
--> statement-breakpoint
ALTER TABLE "hook_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "refs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"url_original" text NOT NULL,
	"platform_id" uuid NOT NULL,
	"external_id" text,
	"format_id" uuid,
	"source_account_id" uuid,
	"audio_id" uuid,
	"status" "ref_status" DEFAULT 'inbox' NOT NULL,
	"content_id" uuid,
	"content_position" smallint,
	"summary" text,
	"hook_text" text,
	"hook_type_id" uuid,
	"visual_notes" text,
	"notes" text,
	"tags" text[] DEFAULT '{""}' NOT NULL,
	"saved_likes" integer,
	"saved_saves" integer,
	"skipped_reason" text,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"search_text" text DEFAULT '' NOT NULL,
	"embedding" vector(768),
	"embedding_model" text,
	"embedding_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refs_content_position_uq" UNIQUE("content_id","content_position"),
	CONSTRAINT "refs_content_position_check" CHECK (content_position > 0),
	CONSTRAINT "refs_position_chk" CHECK ((content_id IS NULL) = (content_position IS NULL)),
	CONSTRAINT "refs_saved_likes_check" CHECK (saved_likes >= 0),
	CONSTRAINT "refs_saved_saves_check" CHECK (saved_saves >= 0),
	CONSTRAINT "refs_status_content_chk" CHECK (((content_id IS NULL) AND (status = ANY (ARRAY['inbox'::ref_status, 'selected'::ref_status, 'skipped'::ref_status]))) OR ((content_id IS NOT NULL) AND (status = ANY (ARRAY['production'::ref_status, 'posted'::ref_status, 'evaluating'::ref_status])))),
	CONSTRAINT "refs_tags_check" CHECK (cardinality(tags) <= 30)
);
--> statement-breakpoint
ALTER TABLE "refs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pillars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pillars_slug_key" UNIQUE("slug"),
	CONSTRAINT "pillars_name_check" CHECK ((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 60))
);
--> statement-breakpoint
ALTER TABLE "pillars" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ref_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"width" integer,
	"height" integer,
	"bytes" integer,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ref_images_storage_path_key" UNIQUE("storage_path")
);
--> statement-breakpoint
ALTER TABLE "ref_images" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "content_checklist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"label" text NOT NULL,
	"is_done" boolean DEFAULT false NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_checklist_label_check" CHECK ((length(btrim(label)) >= 1) AND (length(btrim(label)) <= 120))
);
--> statement-breakpoint
ALTER TABLE "content_checklist" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"platform_id" uuid NOT NULL,
	"url" text,
	"caption" text,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posts_content_id_platform_id_key" UNIQUE("content_id","platform_id"),
	CONSTRAINT "posts_url_check" CHECK ((url IS NULL) OR (url ~* '^https?://'::text))
);
--> statement-breakpoint
ALTER TABLE "posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"checkpoint" "checkpoint_kind" NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"status" "snapshot_status" DEFAULT 'pending' NOT NULL,
	"views" integer,
	"likes" integer,
	"comments" integer,
	"saves" integer,
	"shares" integer,
	"follower_delta" integer,
	"reach" integer,
	"avg_watch_seconds" numeric(7, 1),
	"retention_pct" numeric(5, 2),
	"profile_visits" integer,
	"rating" smallint,
	"notes" text,
	"filled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "snapshots_post_id_checkpoint_key" UNIQUE("post_id","checkpoint"),
	CONSTRAINT "snapshots_avg_watch_seconds_check" CHECK (avg_watch_seconds >= (0)::numeric),
	CONSTRAINT "snapshots_check" CHECK ((status <> 'done'::snapshot_status) OR (filled_at IS NOT NULL)),
	CONSTRAINT "snapshots_comments_check" CHECK (comments >= 0),
	CONSTRAINT "snapshots_likes_check" CHECK (likes >= 0),
	CONSTRAINT "snapshots_profile_visits_check" CHECK (profile_visits >= 0),
	CONSTRAINT "snapshots_rating_check" CHECK ((rating >= 1) AND (rating <= 5)),
	CONSTRAINT "snapshots_reach_check" CHECK (reach >= 0),
	CONSTRAINT "snapshots_retention_pct_check" CHECK ((retention_pct >= (0)::numeric) AND (retention_pct <= (100)::numeric)),
	CONSTRAINT "snapshots_saves_check" CHECK (saves >= 0),
	CONSTRAINT "snapshots_shares_check" CHECK (shares >= 0),
	CONSTRAINT "snapshots_views_check" CHECK (views >= 0)
);
--> statement-breakpoint
ALTER TABLE "snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "snippets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "snippet_kind" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"pillar_id" uuid,
	"platform_id" uuid,
	"use_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "snippets_body_check" CHECK (length(btrim(body)) > 0),
	CONSTRAINT "snippets_title_check" CHECK ((length(btrim(title)) >= 1) AND (length(btrim(title)) <= 120))
);
--> statement-breakpoint
ALTER TABLE "snippets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "status_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "status_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "status_events_entity_check" CHECK (entity = ANY (ARRAY['ref'::text, 'content'::text]))
);
--> statement-breakpoint
ALTER TABLE "status_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "system_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "system_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"kind" text NOT NULL,
	"level" text DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "system_logs_kind_check" CHECK (kind = ANY (ARRAY['ingest'::text, 'cron'::text, 'email'::text, 'ai'::text, 'webhook'::text, 'import'::text, 'auth'::text])),
	CONSTRAINT "system_logs_level_check" CHECK (level = ANY (ARRAY['info'::text, 'warn'::text, 'error'::text]))
);
--> statement-breakpoint
ALTER TABLE "system_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_usage_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"feature" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"status" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"latency_ms" integer,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_usage_status_check" CHECK (status = ANY (ARRAY['ok'::text, 'error'::text, 'rate_limited'::text, 'blocked_cap'::text]))
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"weekly_post_target" smallint DEFAULT 3 NOT NULL,
	"insight_min_sample" smallint DEFAULT 3 NOT NULL,
	"default_checklist" text[] DEFAULT '{"RAY['Script / outline'::text","'Shoot or draw'::text","'Edit'::text","'Cover'::text","'Caption and hashtags'::text","'Audio checked'::tex"}' NOT NULL,
	"ingest_token_hash" text,
	"ingest_token_hint" text,
	"ingest_token_rotated_at" timestamp with time zone,
	"ai_enabled" boolean DEFAULT false NOT NULL,
	"ai_provider" text DEFAULT 'google' NOT NULL,
	"ai_text_model" text,
	"ai_vision_model" text,
	"ai_embed_model" text,
	"ai_daily_cap" integer DEFAULT 100 NOT NULL,
	"ai_output_language" text DEFAULT 'id' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_settings_ai_daily_cap_check" CHECK (ai_daily_cap >= 0),
	CONSTRAINT "app_settings_ai_output_language_check" CHECK (ai_output_language = ANY (ARRAY['id'::text, 'en'::text])),
	CONSTRAINT "app_settings_ai_provider_check" CHECK (ai_provider = ANY (ARRAY['google'::text, 'groq'::text, 'openrouter'::text])),
	CONSTRAINT "app_settings_id_check" CHECK (id = 1),
	CONSTRAINT "app_settings_insight_min_sample_check" CHECK (insight_min_sample >= 1),
	CONSTRAINT "app_settings_weekly_post_target_check" CHECK ((weekly_post_target >= 0) AND (weekly_post_target <= 50))
);
--> statement-breakpoint
ALTER TABLE "app_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ref_pillars" (
	"ref_id" uuid NOT NULL,
	"pillar_id" uuid NOT NULL,
	CONSTRAINT "ref_pillars_pkey" PRIMARY KEY("ref_id","pillar_id")
);
--> statement-breakpoint
ALTER TABLE "ref_pillars" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ref_elements" (
	"ref_id" uuid NOT NULL,
	"element" "element_kind" NOT NULL,
	CONSTRAINT "ref_elements_pkey" PRIMARY KEY("ref_id","element")
);
--> statement-breakpoint
ALTER TABLE "ref_elements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "content_pillars" (
	"content_id" uuid NOT NULL,
	"pillar_id" uuid NOT NULL,
	CONSTRAINT "content_pillars_pkey" PRIMARY KEY("content_id","pillar_id")
);
--> statement-breakpoint
ALTER TABLE "content_pillars" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "source_accounts" ADD CONSTRAINT "source_accounts_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_audio_id_fkey" FOREIGN KEY ("audio_id") REFERENCES "public"."audios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_format_id_fkey" FOREIGN KEY ("format_id") REFERENCES "public"."formats"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_hook_type_id_fkey" FOREIGN KEY ("hook_type_id") REFERENCES "public"."hook_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refs" ADD CONSTRAINT "refs_audio_id_fkey" FOREIGN KEY ("audio_id") REFERENCES "public"."audios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refs" ADD CONSTRAINT "refs_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refs" ADD CONSTRAINT "refs_format_id_fkey" FOREIGN KEY ("format_id") REFERENCES "public"."formats"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refs" ADD CONSTRAINT "refs_hook_type_id_fkey" FOREIGN KEY ("hook_type_id") REFERENCES "public"."hook_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refs" ADD CONSTRAINT "refs_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refs" ADD CONSTRAINT "refs_source_account_id_fkey" FOREIGN KEY ("source_account_id") REFERENCES "public"."source_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ref_images" ADD CONSTRAINT "ref_images_ref_id_fkey" FOREIGN KEY ("ref_id") REFERENCES "public"."refs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_checklist" ADD CONSTRAINT "content_checklist_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snippets" ADD CONSTRAINT "snippets_pillar_id_fkey" FOREIGN KEY ("pillar_id") REFERENCES "public"."pillars"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snippets" ADD CONSTRAINT "snippets_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ref_pillars" ADD CONSTRAINT "ref_pillars_pillar_id_fkey" FOREIGN KEY ("pillar_id") REFERENCES "public"."pillars"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ref_pillars" ADD CONSTRAINT "ref_pillars_ref_id_fkey" FOREIGN KEY ("ref_id") REFERENCES "public"."refs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ref_elements" ADD CONSTRAINT "ref_elements_ref_id_fkey" FOREIGN KEY ("ref_id") REFERENCES "public"."refs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_pillars" ADD CONSTRAINT "content_pillars_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_pillars" ADD CONSTRAINT "content_pillars_pillar_id_fkey" FOREIGN KEY ("pillar_id") REFERENCES "public"."pillars"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "platforms_name_uq" ON "platforms" USING btree (lower(btrim(name)) text_ops);--> statement-breakpoint
CREATE INDEX "source_accounts_handle_trgm" ON "source_accounts" USING gin ("handle" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "formats_name_uq" ON "formats" USING btree (lower(btrim(name)) text_ops);--> statement-breakpoint
CREATE INDEX "contents_audio_idx" ON "contents" USING btree ("audio_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "contents_created_idx" ON "contents" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "contents_embedding_idx" ON "contents" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "contents_planned_idx" ON "contents" USING btree ("planned_for" date_ops) WHERE (planned_for IS NOT NULL);--> statement-breakpoint
CREATE INDEX "contents_search_trgm" ON "contents" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "contents_series_idx" ON "contents" USING btree ("series_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "contents_status_idx" ON "contents" USING btree ("status" enum_ops) WHERE (archived_at IS NULL);--> statement-breakpoint
CREATE INDEX "contents_tags_gin" ON "contents" USING gin ("tags" array_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "series_name_uq" ON "series" USING btree (lower(btrim(name)) text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "audios_title_artist_uq" ON "audios" USING btree (lower(btrim(title)) text_ops,lower(btrim(artist)) text_ops);--> statement-breakpoint
CREATE INDEX "audios_title_trgm" ON "audios" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "hook_types_name_uq" ON "hook_types" USING btree (lower(btrim(name)) text_ops);--> statement-breakpoint
CREATE INDEX "refs_audio_idx" ON "refs" USING btree ("audio_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "refs_content_idx" ON "refs" USING btree ("content_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "refs_embedding_idx" ON "refs" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "refs_format_idx" ON "refs" USING btree ("format_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "refs_platform_external_uq" ON "refs" USING btree ("platform_id" text_ops,"external_id" uuid_ops) WHERE (external_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "refs_saved_at_idx" ON "refs" USING btree ("saved_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "refs_search_trgm" ON "refs" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "refs_source_idx" ON "refs" USING btree ("source_account_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "refs_status_idx" ON "refs" USING btree ("status" enum_ops) WHERE (archived_at IS NULL);--> statement-breakpoint
CREATE INDEX "refs_tags_gin" ON "refs" USING gin ("tags" array_ops);--> statement-breakpoint
CREATE INDEX "refs_unused_idx" ON "refs" USING btree ("saved_at" timestamptz_ops) WHERE ((content_id IS NULL) AND (archived_at IS NULL) AND (status <> 'skipped'::ref_status));--> statement-breakpoint
CREATE UNIQUE INDEX "refs_url_uq" ON "refs" USING btree ("url" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "pillars_name_uq" ON "pillars" USING btree (lower(btrim(name)) text_ops);--> statement-breakpoint
CREATE INDEX "ref_images_ref_idx" ON "ref_images" USING btree ("ref_id" int2_ops,"position" int2_ops);--> statement-breakpoint
CREATE INDEX "content_checklist_idx" ON "content_checklist" USING btree ("content_id" int2_ops,"position" int2_ops);--> statement-breakpoint
CREATE INDEX "posts_content_idx" ON "posts" USING btree ("content_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "posts_posted_idx" ON "posts" USING btree ("posted_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "snapshots_due_idx" ON "snapshots" USING btree ("due_at" timestamptz_ops) WHERE (status = 'pending'::snapshot_status);--> statement-breakpoint
CREATE INDEX "snapshots_post_idx" ON "snapshots" USING btree ("post_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "status_events_entity_idx" ON "status_events" USING btree ("entity" text_ops,"entity_id" uuid_ops,"created_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "system_logs_created_idx" ON "system_logs" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "ai_usage_created_idx" ON "ai_usage" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "ref_pillars_pillar_idx" ON "ref_pillars" USING btree ("pillar_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "content_pillars_pillar_idx" ON "content_pillars" USING btree ("pillar_id" uuid_ops);--> statement-breakpoint
CREATE VIEW "public"."tag_counts" WITH (security_invoker = true) AS (SELECT tag, count(*)::integer AS uses FROM ( SELECT unnest(refs.tags) AS tag FROM refs WHERE refs.archived_at IS NULL UNION ALL SELECT unnest(contents.tags) AS unnest FROM contents WHERE contents.archived_at IS NULL) t GROUP BY tag);--> statement-breakpoint
CREATE VIEW "public"."audio_usage" WITH (security_invoker = true) AS (SELECT id AS audio_id, (( SELECT count(*) AS count FROM refs r WHERE r.audio_id = a.id AND r.archived_at IS NULL))::integer AS ref_count, (( SELECT count(*) AS count FROM contents c WHERE c.audio_id = a.id AND c.archived_at IS NULL))::integer AS content_count, ( SELECT max(COALESCE(( SELECT max(p.posted_at) AS max FROM posts p WHERE p.content_id = c.id), c.created_at)) AS max FROM contents c WHERE c.audio_id = a.id AND c.archived_at IS NULL) AS last_used_at FROM audios a);--> statement-breakpoint
CREATE VIEW "public"."content_scores" WITH (security_invoker = true) AS (SELECT id AS content_id, COALESCE(final_rating::numeric, ( SELECT avg(s.rating) AS avg FROM snapshots s JOIN posts p ON p.id = s.post_id WHERE p.content_id = c.id AND s.status = 'done'::snapshot_status AND s.rating IS NOT NULL)) AS score FROM contents c WHERE archived_at IS NULL);--> statement-breakpoint
CREATE VIEW "public"."content_metrics" WITH (security_invoker = true) AS (SELECT p.content_id, sum(ls.views) AS views, sum(ls.likes) AS likes, sum(ls.comments) AS comments, sum(ls.saves) AS saves, sum(ls.shares) AS shares, sum(ls.follower_delta) AS follower_delta FROM posts p JOIN LATERAL ( SELECT s.id, s.post_id, s.checkpoint, s.due_at, s.status, s.views, s.likes, s.comments, s.saves, s.shares, s.follower_delta, s.reach, s.avg_watch_seconds, s.retention_pct, s.profile_visits, s.rating, s.notes, s.filled_at, s.created_at, s.updated_at FROM snapshots s WHERE s.post_id = p.id AND s.status = 'done'::snapshot_status ORDER BY s.due_at DESC, s.checkpoint DESC LIMIT 1) ls ON true GROUP BY p.content_id);--> statement-breakpoint
CREATE VIEW "public"."source_stats" WITH (security_invoker = true) AS (SELECT sa.id AS source_account_id, count(r.id) FILTER (WHERE r.archived_at IS NULL)::integer AS ref_count, count(r.id) FILTER (WHERE r.archived_at IS NULL AND (r.status = ANY (ARRAY['selected'::ref_status, 'production'::ref_status, 'posted'::ref_status, 'evaluating'::ref_status])))::integer AS selected_count, count(r.id) FILTER (WHERE r.archived_at IS NULL AND r.content_id IS NOT NULL)::integer AS produced_count, ( SELECT avg(cs.score) AS avg FROM content_scores cs WHERE (cs.content_id IN ( SELECT r2.content_id FROM refs r2 WHERE r2.source_account_id = sa.id AND r2.content_id IS NOT NULL))) AS avg_score FROM source_accounts sa LEFT JOIN refs r ON r.source_account_id = sa.id GROUP BY sa.id);
*/