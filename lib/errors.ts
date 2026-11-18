export type ErrorCode =
    | "unauthorized"
    | "validation"
    | "not_found"
    | "conflict"
    | "duplicate"
    | "blocked"
    | "invalid_url"
    | "rate_limited"
    | "ai_disabled"
    | "ai_cap_reached"
    | "ai_failed"
    | "internal";

export class AppError extends Error {
    constructor(
        public code: ErrorCode,
        message: string,
        public fieldErrors?: Record<string, string>
    ) {
        super(message);
        this.name = "AppError";
    }
}