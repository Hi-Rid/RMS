import { format, startOfWeek as dfStartOfWeek } from "date-fns";
import { tz } from "@date-fns/tz";

export const APP_TZ = "Asia/Jakarta";
const inApp = tz(APP_TZ);

export function startOfWeek(date: Date = new Date()): Date {
    return dfStartOfWeek(date, { in: inApp, weekStartsOn: 1 });
}

export function endOfWeek(date: Date = new Date()): Date {
    return new Date(startOfWeek(date).getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
}

export function formatDate(
    date: Date | string | number,
    opts: { withTime?: boolean } = {}
): string {
    return format(date, opts.withTime ? "dd MMM yyyy, HH:mm" : "dd MMM yyyy", {
        in: inApp,
    });
}