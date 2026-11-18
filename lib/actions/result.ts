import type { ErrorCode } from "@/lib/errors";

export type ActionResult<T = void> =
    | { ok: true; data: T }
    | {
        ok: false;
        error: {
            code: ErrorCode;
            message: string;
            fieldErrors?: Record<string, string>;
        };
    };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });

export const fail = (
    code: ErrorCode,
    message: string,
    fieldErrors?: Record<string, string>
): ActionResult<never> => ({ ok: false, error: { code, message, fieldErrors } });