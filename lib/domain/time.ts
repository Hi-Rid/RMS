/**
 * RMS Time and Timezone Utilities (PRD §10.10)
 * Canonical Timezone: Asia/Jakarta (WIB = UTC+7)
 */

const WIB_OFFSET_HOURS = 7;
const WIB_OFFSET_MS = WIB_OFFSET_HOURS * 60 * 60 * 1000;

/**
 * Returns the start of the week (Monday 00:00:00 WIB) for a given date in UTC.
 * E.g., for Saturday 2026-11-14 -> returns Monday 2026-11-09 00:00 WIB (2026-11-08T17:00:00.000Z).
 */
export function startOfWeek(dateInput?: Date | string): Date {
  const d = dateInput
    ? typeof dateInput === "string"
      ? new Date(dateInput)
      : new Date(dateInput.getTime())
    : new Date();

  if (isNaN(d.getTime())) {
    throw new Error("Invalid date input");
  }

  // Shift to WIB local time
  const wibTime = new Date(d.getTime() + WIB_OFFSET_MS);

  // Day of week: 0 = Sun, 1 = Mon, ..., 6 = Sat
  const day = wibTime.getUTCDay();
  // In Monday-starting week: Mon=0, Tue=1, ..., Sun=6
  const diffToMonday = (day + 6) % 7;

  // Set to Monday 00:00:00.000 in WIB terms
  wibTime.setUTCDate(wibTime.getUTCDate() - diffToMonday);
  wibTime.setUTCHours(0, 0, 0, 0);

  // Shift back to UTC
  return new Date(wibTime.getTime() - WIB_OFFSET_MS);
}
