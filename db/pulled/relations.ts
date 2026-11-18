import { relations } from "drizzle-orm/relations";
import { platforms, sourceAccounts, audios, contents, formats, hookTypes, series, refs, refImages, contentChecklist, posts, snapshots, pillars, snippets, refPillars, refElements, contentPillars } from "./schema";

export const sourceAccountsRelations = relations(sourceAccounts, ({one, many}) => ({
	platform: one(platforms, {
		fields: [sourceAccounts.platformId],
		references: [platforms.id]
	}),
	refs: many(refs),
}));

export const platformsRelations = relations(platforms, ({many}) => ({
	sourceAccounts: many(sourceAccounts),
	refs: many(refs),
	posts: many(posts),
	snippets: many(snippets),
}));

export const contentsRelations = relations(contents, ({one, many}) => ({
	audio: one(audios, {
		fields: [contents.audioId],
		references: [audios.id]
	}),
	format: one(formats, {
		fields: [contents.formatId],
		references: [formats.id]
	}),
	hookType: one(hookTypes, {
		fields: [contents.hookTypeId],
		references: [hookTypes.id]
	}),
	series: one(series, {
		fields: [contents.seriesId],
		references: [series.id]
	}),
	refs: many(refs),
	contentChecklists: many(contentChecklist),
	posts: many(posts),
	contentPillars: many(contentPillars),
}));

export const audiosRelations = relations(audios, ({many}) => ({
	contents: many(contents),
	refs: many(refs),
}));

export const formatsRelations = relations(formats, ({many}) => ({
	contents: many(contents),
	refs: many(refs),
}));

export const hookTypesRelations = relations(hookTypes, ({many}) => ({
	contents: many(contents),
	refs: many(refs),
}));

export const seriesRelations = relations(series, ({many}) => ({
	contents: many(contents),
}));

export const refsRelations = relations(refs, ({one, many}) => ({
	audio: one(audios, {
		fields: [refs.audioId],
		references: [audios.id]
	}),
	content: one(contents, {
		fields: [refs.contentId],
		references: [contents.id]
	}),
	format: one(formats, {
		fields: [refs.formatId],
		references: [formats.id]
	}),
	hookType: one(hookTypes, {
		fields: [refs.hookTypeId],
		references: [hookTypes.id]
	}),
	platform: one(platforms, {
		fields: [refs.platformId],
		references: [platforms.id]
	}),
	sourceAccount: one(sourceAccounts, {
		fields: [refs.sourceAccountId],
		references: [sourceAccounts.id]
	}),
	refImages: many(refImages),
	refPillars: many(refPillars),
	refElements: many(refElements),
}));

export const refImagesRelations = relations(refImages, ({one}) => ({
	ref: one(refs, {
		fields: [refImages.refId],
		references: [refs.id]
	}),
}));

export const contentChecklistRelations = relations(contentChecklist, ({one}) => ({
	content: one(contents, {
		fields: [contentChecklist.contentId],
		references: [contents.id]
	}),
}));

export const postsRelations = relations(posts, ({one, many}) => ({
	content: one(contents, {
		fields: [posts.contentId],
		references: [contents.id]
	}),
	platform: one(platforms, {
		fields: [posts.platformId],
		references: [platforms.id]
	}),
	snapshots: many(snapshots),
}));

export const snapshotsRelations = relations(snapshots, ({one}) => ({
	post: one(posts, {
		fields: [snapshots.postId],
		references: [posts.id]
	}),
}));

export const snippetsRelations = relations(snippets, ({one}) => ({
	pillar: one(pillars, {
		fields: [snippets.pillarId],
		references: [pillars.id]
	}),
	platform: one(platforms, {
		fields: [snippets.platformId],
		references: [platforms.id]
	}),
}));

export const pillarsRelations = relations(pillars, ({many}) => ({
	snippets: many(snippets),
	refPillars: many(refPillars),
	contentPillars: many(contentPillars),
}));

export const refPillarsRelations = relations(refPillars, ({one}) => ({
	pillar: one(pillars, {
		fields: [refPillars.pillarId],
		references: [pillars.id]
	}),
	ref: one(refs, {
		fields: [refPillars.refId],
		references: [refs.id]
	}),
}));

export const refElementsRelations = relations(refElements, ({one}) => ({
	ref: one(refs, {
		fields: [refElements.refId],
		references: [refs.id]
	}),
}));

export const contentPillarsRelations = relations(contentPillars, ({one}) => ({
	content: one(contents, {
		fields: [contentPillars.contentId],
		references: [contents.id]
	}),
	pillar: one(pillars, {
		fields: [contentPillars.pillarId],
		references: [pillars.id]
	}),
}));