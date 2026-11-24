/**
 * RMS Post Checkpoints & Due Dates (PRD §10.5)
 */

export const CHECKPOINTS = ["h24", "d7", "d30"] as const;
export type CheckpointKind = (typeof CHECKPOINTS)[number];

export const CHECKPOINT_LABELS: Record<CheckpointKind, string> = {
  h24: "24h Checkpoint",
  d7: "7d Checkpoint",
  d30: "30d Checkpoint",
};

/**
 * Calculates due date for a given checkpoint kind:
 * - h24: 24 hours after post
 * - d7: 7 days after post
 * - d30: 30 days after post
 */
export function dueAt(postedAt: Date | string, kind: CheckpointKind): Date {
  const base = typeof postedAt === "string" ? new Date(postedAt) : new Date(postedAt.getTime());
  if (isNaN(base.getTime())) {
    throw new Error("Invalid postedAt date");
  }

  const result = new Date(base.getTime());
  switch (kind) {
    case "h24":
      result.setTime(result.getTime() + 24 * 60 * 60 * 1000);
      break;
    case "d7":
      result.setTime(result.getTime() + 7 * 24 * 60 * 60 * 1000);
      break;
    case "d30":
      result.setTime(result.getTime() + 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      throw new Error(`Unknown checkpoint kind: ${kind}`);
  }

  return result;
}
