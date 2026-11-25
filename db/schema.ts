import { pgTable, text, timestamp, uniqueIndex, unique, check, uuid, boolean, integer, index, foreignKey, date, smallint, vector, numeric, bigint, jsonb, primaryKey, pgView, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const checkpointKind = pgEnum("checkpoint_kind", ['h24', 'd7', 'd30'])
export const contentStatus = pgEnum("content_status", ['production', 'posted', 'evaluating'])
export const elementKind = pgEnum("element_kind", ['idea', 'hook', 'audio', 'visual', 'topic'])
export const refStatus = pgEnum("ref_status", ['inbox', 'selected', 'production', 'posted', 'evaluating', 'skipped'])
export const snapshotStatus = pgEnum("snapshot_status", ['pending', 'done', 'skipped'])
export const snippetKind = pgEnum("snippet_kind", ['caption', 'hashtag_set'])


export const schemaMigrations = pgTable("schema_migrations", {
	name: text().primaryKey().notNull(),
	appliedAt: timestamp("applied_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const platforms = pgTable("platforms", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	domains: text().array().default([""]).notNull(),
	isSource: boolean("is_source").default(true).notNull(),
	isTarget: boolean("is_target").default(true).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("platforms_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("platforms_user_name_uq").using("btree", table.userId, sql`lower(btrim(name))`),
	unique("platforms_user_slug_uq").on(table.userId, table.slug),
	check("platforms_name_check", sql`(length(btrim(name)) >= 1) AND (length(btrim(name)) <= 60)`),
]);

export const sourceAccounts = pgTable("source_accounts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	platformId: uuid("platform_id").notNull(),
	handle: text().notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("source_accounts_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	index("source_accounts_handle_trgm").using("gin", table.handle.asc().nullsLast().op("gin_trgm_ops")),
	foreignKey({
			columns: [table.platformId],
			foreignColumns: [platforms.id],
			name: "source_accounts_platform_id_fkey"
		}).onDelete("restrict"),
	unique("source_accounts_user_platform_handle_uq").on(table.userId, table.platformId, table.handle),
	check("source_accounts_handle_check", sql`(handle = lower(btrim(handle))) AND (handle !~ '^@'::text) AND ((length(handle) >= 1) AND (length(handle) <= 100))`),
]);

export const formats = pgTable("formats", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	hasCheckpoints: boolean("has_checkpoints").default(true).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("formats_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("formats_user_name_uq").using("btree", table.userId, sql`lower(btrim(name))`),
	unique("formats_user_slug_uq").on(table.userId, table.slug),
	check("formats_name_check", sql`(length(btrim(name)) >= 1) AND (length(btrim(name)) <= 60)`),
]);

export const contents = pgTable("contents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	title: text().notNull(),
	status: contentStatus().default('production').notNull(),
	formatId: uuid("format_id"),
	seriesId: uuid("series_id"),
	audioId: uuid("audio_id"),
	hookText: text("hook_text"),
	hookTypeId: uuid("hook_type_id"),
	changesNote: text("changes_note"),
	notes: text(),
	workUrl: text("work_url"),
	tags: text().array().default([""]).notNull(),
	plannedFor: date("planned_for"),
	finalRating: smallint("final_rating"),
	finalRatingNote: text("final_rating_note"),
	statusChangedAt: timestamp("status_changed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	archivedAt: timestamp("archived_at", { withTimezone: true, mode: 'string' }),
	searchText: text("search_text").default("").notNull(),
	embedding: vector({ dimensions: 768 }),
	embeddingModel: text("embedding_model"),
	embeddingHash: text("embedding_hash"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("contents_user_created_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("contents_audio_idx").using("btree", table.audioId.asc().nullsLast().op("uuid_ops")),
	index("contents_created_idx").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("contents_embedding_idx").using("hnsw", table.embedding.asc().nullsLast().op("vector_cosine_ops")),
	index("contents_planned_idx").using("btree", table.plannedFor.asc().nullsLast().op("date_ops")).where(sql`(planned_for IS NOT NULL)`),
	index("contents_search_trgm").using("gin", table.searchText.asc().nullsLast().op("gin_trgm_ops")),
	index("contents_series_idx").using("btree", table.seriesId.asc().nullsLast().op("uuid_ops")),
	index("contents_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")).where(sql`(archived_at IS NULL)`),
	index("contents_tags_gin").using("gin", table.tags.asc().nullsLast().op("array_ops")),
	foreignKey({
			columns: [table.audioId],
			foreignColumns: [audios.id],
			name: "contents_audio_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.formatId],
			foreignColumns: [formats.id],
			name: "contents_format_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.hookTypeId],
			foreignColumns: [hookTypes.id],
			name: "contents_hook_type_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.seriesId],
			foreignColumns: [series.id],
			name: "contents_series_id_fkey"
		}).onDelete("restrict"),
	check("contents_final_rating_check", sql`(final_rating >= 1) AND (final_rating <= 5)`),
	check("contents_tags_check", sql`cardinality(tags) <= 30`),
	check("contents_title_check", sql`(length(btrim(title)) >= 1) AND (length(btrim(title)) <= 200)`),
	check("contents_work_url_check", sql`(work_url IS NULL) OR (work_url ~* '^https?://'::text)`),
]);

export const series = pgTable("series", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("series_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("series_user_name_uq").using("btree", table.userId, sql`lower(btrim(name))`),
	unique("series_user_slug_uq").on(table.userId, table.slug),
	check("series_name_check", sql`(length(btrim(name)) >= 1) AND (length(btrim(name)) <= 60)`),
]);

export const audios = pgTable("audios", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	title: text().notNull(),
	artist: text().default("").notNull(),
	isOriginal: boolean("is_original").default(false).notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("audios_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("audios_user_title_artist_uq").using("btree", table.userId, sql`lower(btrim(title))`, sql`lower(btrim(artist))`),
	index("audios_title_trgm").using("gin", table.title.asc().nullsLast().op("gin_trgm_ops")),
	check("audios_artist_check", sql`length(artist) <= 200`),
	check("audios_title_check", sql`(length(btrim(title)) >= 1) AND (length(btrim(title)) <= 200)`),
]);

export const hookTypes = pgTable("hook_types", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("hook_types_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("hook_types_user_name_uq").using("btree", table.userId, sql`lower(btrim(name))`),
	unique("hook_types_user_slug_uq").on(table.userId, table.slug),
	check("hook_types_name_check", sql`(length(btrim(name)) >= 1) AND (length(btrim(name)) <= 60)`),
]);

export const refs = pgTable("refs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	url: text().notNull(),
	urlOriginal: text("url_original").notNull(),
	platformId: uuid("platform_id").notNull(),
	externalId: text("external_id"),
	formatId: uuid("format_id"),
	sourceAccountId: uuid("source_account_id"),
	audioId: uuid("audio_id"),
	status: refStatus().default('inbox').notNull(),
	contentId: uuid("content_id"),
	contentPosition: smallint("content_position"),
	summary: text(),
	hookText: text("hook_text"),
	hookTypeId: uuid("hook_type_id"),
	visualNotes: text("visual_notes"),
	notes: text(),
	tags: text().array().default([""]).notNull(),
	savedLikes: integer("saved_likes"),
	savedSaves: integer("saved_saves"),
	skippedReason: text("skipped_reason"),
	coverUrl: text("cover_url"),
	savedAt: timestamp("saved_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	statusChangedAt: timestamp("status_changed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	archivedAt: timestamp("archived_at", { withTimezone: true, mode: 'string' }),
	searchText: text("search_text").default("").notNull(),
	embedding: vector({ dimensions: 768 }),
	embeddingModel: text("embedding_model"),
	embeddingHash: text("embedding_hash"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("refs_user_saved_at_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.savedAt.desc().nullsFirst().op("timestamptz_ops")),
	index("refs_audio_idx").using("btree", table.audioId.asc().nullsLast().op("uuid_ops")),
	index("refs_content_idx").using("btree", table.contentId.asc().nullsLast().op("uuid_ops")),
	index("refs_embedding_idx").using("hnsw", table.embedding.asc().nullsLast().op("vector_cosine_ops")),
	index("refs_format_idx").using("btree", table.formatId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("refs_user_platform_external_uq").using("btree", table.userId, table.platformId, table.externalId).where(sql`(external_id IS NOT NULL)`),
	index("refs_saved_at_idx").using("btree", table.savedAt.desc().nullsFirst().op("timestamptz_ops")),
	index("refs_search_trgm").using("gin", table.searchText.asc().nullsLast().op("gin_trgm_ops")),
	index("refs_source_idx").using("btree", table.sourceAccountId.asc().nullsLast().op("uuid_ops")),
	index("refs_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")).where(sql`(archived_at IS NULL)`),
	index("refs_tags_gin").using("gin", table.tags.asc().nullsLast().op("array_ops")),
	index("refs_unused_idx").using("btree", table.savedAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((content_id IS NULL) AND (archived_at IS NULL) AND (status <> 'skipped'::ref_status))`),
	uniqueIndex("refs_user_url_uq").using("btree", table.userId, table.url),
	foreignKey({
			columns: [table.audioId],
			foreignColumns: [audios.id],
			name: "refs_audio_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.contentId],
			foreignColumns: [contents.id],
			name: "refs_content_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.formatId],
			foreignColumns: [formats.id],
			name: "refs_format_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.hookTypeId],
			foreignColumns: [hookTypes.id],
			name: "refs_hook_type_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.platformId],
			foreignColumns: [platforms.id],
			name: "refs_platform_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.sourceAccountId],
			foreignColumns: [sourceAccounts.id],
			name: "refs_source_account_id_fkey"
		}).onDelete("restrict"),
	unique("refs_content_position_uq").on(table.contentId, table.contentPosition),
	check("refs_content_position_check", sql`content_position > 0`),
	check("refs_position_chk", sql`(content_id IS NULL) = (content_position IS NULL)`),
	check("refs_saved_likes_check", sql`saved_likes >= 0`),
	check("refs_saved_saves_check", sql`saved_saves >= 0`),
	check("refs_status_content_chk", sql`((content_id IS NULL) AND (status = ANY (ARRAY['inbox'::ref_status, 'selected'::ref_status, 'skipped'::ref_status]))) OR ((content_id IS NOT NULL) AND (status = ANY (ARRAY['production'::ref_status, 'posted'::ref_status, 'evaluating'::ref_status])))`),
	check("refs_tags_check", sql`cardinality(tags) <= 30`),
]);

export const pillars = pgTable("pillars", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("pillars_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("pillars_user_name_uq").using("btree", table.userId, sql`lower(btrim(name))`),
	unique("pillars_user_slug_uq").on(table.userId, table.slug),
	check("pillars_name_check", sql`(length(btrim(name)) >= 1) AND (length(btrim(name)) <= 60)`),
]);

export const refImages = pgTable("ref_images", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	refId: uuid("ref_id").notNull(),
	storagePath: text("storage_path").notNull(),
	width: integer(),
	height: integer(),
	bytes: integer(),
	position: smallint().default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ref_images_ref_idx").using("btree", table.refId.asc().nullsLast().op("int2_ops"), table.position.asc().nullsLast().op("int2_ops")),
	foreignKey({
			columns: [table.refId],
			foreignColumns: [refs.id],
			name: "ref_images_ref_id_fkey"
		}).onDelete("cascade"),
	unique("ref_images_storage_path_key").on(table.storagePath),
]);

export const contentChecklist = pgTable("content_checklist", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	contentId: uuid("content_id").notNull(),
	label: text().notNull(),
	isDone: boolean("is_done").default(false).notNull(),
	position: smallint().default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("content_checklist_idx").using("btree", table.contentId.asc().nullsLast().op("int2_ops"), table.position.asc().nullsLast().op("int2_ops")),
	foreignKey({
			columns: [table.contentId],
			foreignColumns: [contents.id],
			name: "content_checklist_content_id_fkey"
		}).onDelete("cascade"),
	check("content_checklist_label_check", sql`(length(btrim(label)) >= 1) AND (length(btrim(label)) <= 120)`),
]);

export const posts = pgTable("posts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	contentId: uuid("content_id").notNull(),
	platformId: uuid("platform_id").notNull(),
	url: text(),
	caption: text(),
	postedAt: timestamp("posted_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("posts_user_posted_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.postedAt.desc().nullsFirst().op("timestamptz_ops")),
	index("posts_content_idx").using("btree", table.contentId.asc().nullsLast().op("uuid_ops")),
	index("posts_posted_idx").using("btree", table.postedAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.contentId],
			foreignColumns: [contents.id],
			name: "posts_content_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.platformId],
			foreignColumns: [platforms.id],
			name: "posts_platform_id_fkey"
		}).onDelete("restrict"),
	unique("posts_content_id_platform_id_key").on(table.contentId, table.platformId),
	check("posts_url_check", sql`(url IS NULL) OR (url ~* '^https?://'::text)`),
]);

export const snapshots = pgTable("snapshots", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	postId: uuid("post_id").notNull(),
	checkpoint: checkpointKind().notNull(),
	dueAt: timestamp("due_at", { withTimezone: true, mode: 'string' }).notNull(),
	status: snapshotStatus().default('pending').notNull(),
	views: integer(),
	likes: integer(),
	comments: integer(),
	saves: integer(),
	shares: integer(),
	followerDelta: integer("follower_delta"),
	reach: integer(),
	avgWatchSeconds: numeric("avg_watch_seconds", { precision: 7, scale:  1 }),
	retentionPct: numeric("retention_pct", { precision: 5, scale:  2 }),
	profileVisits: integer("profile_visits"),
	rating: smallint(),
	notes: text(),
	filledAt: timestamp("filled_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("snapshots_user_due_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.dueAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(status = 'pending'::snapshot_status)`),
	index("snapshots_due_idx").using("btree", table.dueAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(status = 'pending'::snapshot_status)`),
	index("snapshots_post_idx").using("btree", table.postId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.postId],
			foreignColumns: [posts.id],
			name: "snapshots_post_id_fkey"
		}).onDelete("cascade"),
	unique("snapshots_post_id_checkpoint_key").on(table.postId, table.checkpoint),
	check("snapshots_avg_watch_seconds_check", sql`avg_watch_seconds >= (0)::numeric`),
	check("snapshots_check", sql`(status <> 'done'::snapshot_status) OR (filled_at IS NOT NULL)`),
	check("snapshots_comments_check", sql`comments >= 0`),
	check("snapshots_likes_check", sql`likes >= 0`),
	check("snapshots_profile_visits_check", sql`profile_visits >= 0`),
	check("snapshots_rating_check", sql`(rating >= 1) AND (rating <= 5)`),
	check("snapshots_reach_check", sql`reach >= 0`),
	check("snapshots_retention_pct_check", sql`(retention_pct >= (0)::numeric) AND (retention_pct <= (100)::numeric)`),
	check("snapshots_saves_check", sql`saves >= 0`),
	check("snapshots_shares_check", sql`shares >= 0`),
	check("snapshots_views_check", sql`views >= 0`),
]);

export const snippets = pgTable("snippets", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	kind: snippetKind().notNull(),
	title: text().notNull(),
	body: text().notNull(),
	pillarId: uuid("pillar_id"),
	platformId: uuid("platform_id"),
	useCount: integer("use_count").default(0).notNull(),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("snippets_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.pillarId],
			foreignColumns: [pillars.id],
			name: "snippets_pillar_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.platformId],
			foreignColumns: [platforms.id],
			name: "snippets_platform_id_fkey"
		}).onDelete("set null"),
	check("snippets_body_check", sql`length(btrim(body)) > 0`),
	check("snippets_title_check", sql`(length(btrim(title)) >= 1) AND (length(btrim(title)) <= 120)`),
]);

export const statusEvents = pgTable("status_events", {
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "status_events_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	userId: uuid("user_id"),
	entity: text().notNull(),
	entityId: uuid("entity_id").notNull(),
	fromStatus: text("from_status"),
	toStatus: text("to_status").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("status_events_entity_idx").using("btree", table.entity.asc().nullsLast().op("text_ops"), table.entityId.asc().nullsLast().op("uuid_ops"), table.createdAt.asc().nullsLast().op("uuid_ops")),
	check("status_events_entity_check", sql`entity = ANY (ARRAY['ref'::text, 'content'::text])`),
]);

export const systemLogs = pgTable("system_logs", {
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "system_logs_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	userId: uuid("user_id"),
	kind: text().notNull(),
	level: text().default('info').notNull(),
	message: text().notNull(),
	meta: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("system_logs_user_created_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("system_logs_created_idx").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	check("system_logs_kind_check", sql`kind = ANY (ARRAY['ingest'::text, 'cron'::text, 'email'::text, 'ai'::text, 'webhook'::text, 'import'::text, 'auth'::text])`),
	check("system_logs_level_check", sql`level = ANY (ARRAY['info'::text, 'warn'::text, 'error'::text])`),
]);

export const aiUsage = pgTable("ai_usage", {
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "ai_usage_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	userId: uuid("user_id").notNull(),
	feature: text().notNull(),
	provider: text().notNull(),
	model: text().notNull(),
	status: text().notNull(),
	inputTokens: integer("input_tokens"),
	outputTokens: integer("output_tokens"),
	latencyMs: integer("latency_ms"),
	error: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ai_usage_user_created_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("ai_usage_created_idx").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	check("ai_usage_status_check", sql`status = ANY (ARRAY['ok'::text, 'error'::text, 'rate_limited'::text, 'blocked_cap'::text])`),
]);

export const appSettings = pgTable("app_settings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	weeklyPostTarget: smallint("weekly_post_target").default(3).notNull(),
	insightMinSample: smallint("insight_min_sample").default(3).notNull(),
	defaultChecklist: text("default_checklist").array().default(["Script / outline", "Shoot or draw", "Edit", "Cover", "Caption and hashtags", "Audio checked"]).notNull(),
	ingestTokenHash: text("ingest_token_hash"),
	ingestTokenHint: text("ingest_token_hint"),
	ingestTokenRotatedAt: timestamp("ingest_token_rotated_at", { withTimezone: true, mode: 'string' }),
	aiEnabled: boolean("ai_enabled").default(false).notNull(),
	aiProvider: text("ai_provider").default('google').notNull(),
	aiTextModel: text("ai_text_model"),
	aiVisionModel: text("ai_vision_model"),
	aiEmbedModel: text("ai_embed_model"),
	aiDailyCap: integer("ai_daily_cap").default(100).notNull(),
	aiOutputLanguage: text("ai_output_language").default('id').notNull(),
	aiAutoEnrich: boolean("ai_auto_enrich").default(true).notNull(),
	aiIngestMode: text("ai_ingest_mode").default('inbox').notNull(),
	creatorNiche: text("creator_niche"),
	creatorAudience: text("creator_audience"),
	creatorVoice: text("creator_voice"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("app_settings_user_id_uq").on(table.userId),
	uniqueIndex("app_settings_ingest_token_hash_uq").using("btree", table.ingestTokenHash).where(sql`(ingest_token_hash IS NOT NULL)`),
	check("app_settings_ai_daily_cap_check", sql`ai_daily_cap >= 0`),
	check("app_settings_ai_ingest_mode_check", sql`ai_ingest_mode = ANY (ARRAY['inbox'::text, 'selected'::text, 'auto_draft'::text])`),
	check("app_settings_ai_output_language_check", sql`ai_output_language = ANY (ARRAY['id'::text, 'en'::text])`),
	check("app_settings_ai_provider_check", sql`ai_provider = ANY (ARRAY['google'::text, 'groq'::text, 'openrouter'::text])`),
	check("app_settings_insight_min_sample_check", sql`insight_min_sample >= 1`),
	check("app_settings_weekly_post_target_check", sql`(weekly_post_target >= 0) AND (weekly_post_target <= 50)`),
]);

export const refPillars = pgTable("ref_pillars", {
	refId: uuid("ref_id").notNull(),
	pillarId: uuid("pillar_id").notNull(),
}, (table) => [
	index("ref_pillars_pillar_idx").using("btree", table.pillarId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.pillarId],
			foreignColumns: [pillars.id],
			name: "ref_pillars_pillar_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.refId],
			foreignColumns: [refs.id],
			name: "ref_pillars_ref_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.refId, table.pillarId], name: "ref_pillars_pkey"}),
]);

export const refElements = pgTable("ref_elements", {
	refId: uuid("ref_id").notNull(),
	element: elementKind().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.refId],
			foreignColumns: [refs.id],
			name: "ref_elements_ref_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.refId, table.element], name: "ref_elements_pkey"}),
]);

export const contentPillars = pgTable("content_pillars", {
	contentId: uuid("content_id").notNull(),
	pillarId: uuid("pillar_id").notNull(),
}, (table) => [
	index("content_pillars_pillar_idx").using("btree", table.pillarId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.contentId],
			foreignColumns: [contents.id],
			name: "content_pillars_content_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.pillarId],
			foreignColumns: [pillars.id],
			name: "content_pillars_pillar_id_fkey"
		}).onDelete("restrict"),
	primaryKey({ columns: [table.contentId, table.pillarId], name: "content_pillars_pkey"}),
]);

export const tagCounts = pgView("tag_counts", {	userId: uuid("user_id"),
	tag: text(),
	uses: integer(),
}).with({"securityInvoker":true}).as(sql`SELECT user_id, tag, count(*)::integer AS uses FROM ( SELECT refs.user_id, unnest(refs.tags) AS tag FROM refs WHERE refs.archived_at IS NULL UNION ALL SELECT contents.user_id, unnest(contents.tags) AS unnest FROM contents WHERE contents.archived_at IS NULL) t GROUP BY user_id, tag`);

export const audioUsage = pgView("audio_usage", {	audioId: uuid("audio_id"),
	userId: uuid("user_id"),
	refCount: integer("ref_count"),
	contentCount: integer("content_count"),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
}).with({"securityInvoker":true}).as(sql`SELECT id AS audio_id, user_id, (( SELECT count(*) AS count FROM refs r WHERE r.audio_id = a.id AND r.archived_at IS NULL))::integer AS ref_count, (( SELECT count(*) AS count FROM contents c WHERE c.audio_id = a.id AND c.archived_at IS NULL))::integer AS content_count, ( SELECT max(COALESCE(( SELECT max(p.posted_at) AS max FROM posts p WHERE p.content_id = c.id), c.created_at)) AS max FROM contents c WHERE c.audio_id = a.id AND c.archived_at IS NULL) AS last_used_at FROM audios a`);

export const contentScores = pgView("content_scores", {	contentId: uuid("content_id"),
	userId: uuid("user_id"),
	score: numeric(),
}).with({"securityInvoker":true}).as(sql`SELECT id AS content_id, user_id, COALESCE(final_rating::numeric, ( SELECT avg(s.rating) AS avg FROM snapshots s JOIN posts p ON p.id = s.post_id WHERE p.content_id = c.id AND s.status = 'done'::snapshot_status AND s.rating IS NOT NULL)) AS score FROM contents c WHERE archived_at IS NULL`);

export const contentMetrics = pgView("content_metrics", {	contentId: uuid("content_id"),
	userId: uuid("user_id"),
	views: bigint({ mode: "number" }),
	likes: bigint({ mode: "number" }),
	comments: bigint({ mode: "number" }),
	saves: bigint({ mode: "number" }),
	shares: bigint({ mode: "number" }),
	followerDelta: bigint("follower_delta", { mode: "number" }),
}).with({"securityInvoker":true}).as(sql`SELECT p.content_id, p.user_id, sum(ls.views) AS views, sum(ls.likes) AS likes, sum(ls.comments) AS comments, sum(ls.saves) AS saves, sum(ls.shares) AS shares, sum(ls.follower_delta) AS follower_delta FROM posts p JOIN LATERAL ( SELECT s.id, s.post_id, s.checkpoint, s.due_at, s.status, s.views, s.likes, s.comments, s.saves, s.shares, s.follower_delta, s.reach, s.avg_watch_seconds, s.retention_pct, s.profile_visits, s.rating, s.notes, s.filled_at, s.created_at, s.updated_at FROM snapshots s WHERE s.post_id = p.id AND s.status = 'done'::snapshot_status ORDER BY s.due_at DESC, s.checkpoint DESC LIMIT 1) ls ON true GROUP BY p.content_id, p.user_id`);

export const sourceStats = pgView("source_stats", {	sourceAccountId: uuid("source_account_id"),
	userId: uuid("user_id"),
	refCount: integer("ref_count"),
	selectedCount: integer("selected_count"),
	producedCount: integer("produced_count"),
	avgScore: numeric("avg_score"),
}).with({"securityInvoker":true}).as(sql`SELECT sa.id AS source_account_id, sa.user_id, count(r.id) FILTER (WHERE r.archived_at IS NULL)::integer AS ref_count, count(r.id) FILTER (WHERE r.archived_at IS NULL AND (r.status = ANY (ARRAY['selected'::ref_status, 'production'::ref_status, 'posted'::ref_status, 'evaluating'::ref_status])))::integer AS selected_count, count(r.id) FILTER (WHERE r.archived_at IS NULL AND r.content_id IS NOT NULL)::integer AS produced_count, ( SELECT avg(cs.score) AS avg FROM content_scores cs WHERE (cs.content_id IN ( SELECT r2.content_id FROM refs r2 WHERE r2.source_account_id = sa.id AND r2.content_id IS NOT NULL))) AS avg_score FROM source_accounts sa LEFT JOIN refs r ON r.source_account_id = sa.id GROUP BY sa.id, sa.user_id`);
