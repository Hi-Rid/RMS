/**
 * RMS Text Normalization Rules (PRD §10.7)
 */

/**
 * Normalizes tags:
 * - trim, lowercase
 * - strips leading '#'
 * - converts whitespace (one or more) to '-'
 * - removes any characters other than Unicode letters, numbers, '-', '_', '.'
 * - truncates to 40 characters
 * - returns empty string if invalid
 */
export function normalizeTag(tag: string): string {
  if (!tag) return "";
  let t = tag.trim().toLowerCase();
  t = t.replace(/^#+/, "");
  t = t.replace(/\s+/g, "-");
  t = t.replace(/[^\p{L}\p{N}\-_.]/gu, "");
  if (t.length > 40) {
    t = t.slice(0, 40);
  }
  return t;
}

/**
 * Normalizes user handles:
 * - trim, lowercase
 * - strips leading '@'
 * - removes all spaces
 * - max 100 chars
 */
export function normalizeHandle(handle: string): string {
  if (!handle) return "";
  let h = handle.trim().toLowerCase();
  h = h.replace(/^@+/, "");
  h = h.replace(/\s+/g, "");
  if (h.length > 100) {
    h = h.slice(0, 100);
  }
  return h;
}

/**
 * Generates URL-friendly slugs:
 * - lowercase, trim
 * - replaces non-alphanumeric unicode characters with '-'
 * - collapses multiple consecutive '-' into a single '-'
 * - strips leading/trailing '-'
 */
export function slugify(text: string): string {
  if (!text) return "";
  let s = text.trim().toLowerCase();
  s = s.replace(/[^\p{L}\p{N}]+/gu, "-");
  s = s.replace(/^-+|-+$/g, "");
  return s;
}
