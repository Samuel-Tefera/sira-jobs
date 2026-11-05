import type { DeadlineCalendar, DeadlineParts } from "./schema";

const ETHIOPIAN_EPOCH_OFFSET = 1723856;

export function toGregorianDeadline(
  parts: DeadlineParts | null,
  calendar: DeadlineCalendar
): string | null {
  if (!parts || parts.year === null || parts.month === null || parts.day === null) {
    return null;
  }

  try {
    if (calendar === "gregorian") {
      return formatGregorian(parts.year, parts.month, parts.day);
    }

    if (calendar === "ethiopian") {
      const gregorian = jdnToGregorian(ethiopianToJdn(parts.year, parts.month, parts.day));
      return formatGregorian(gregorian.year, gregorian.month, gregorian.day);
    }
  } catch {
    return null;
  }

  return null;
}

function ethiopianToJdn(year: number, month: number, day: number): number {
  return (
    ETHIOPIAN_EPOCH_OFFSET +
    365 +
    365 * (year - 1) +
    Math.floor(year / 4) +
    30 * month +
    day -
    31
  );
}

function jdnToGregorian(jdn: number): {
  year: number;
  month: number;
  day: number;
} {
  const a = jdn + 68569;
  const b = Math.floor((4 * a) / 146097);
  const c = a - Math.floor((146097 * b + 3) / 4);
  const d = Math.floor((4000 * (c + 1)) / 1461001);
  const e = c - Math.floor((1461 * d) / 4) + 31;
  const f = Math.floor((80 * e) / 2447);
  const day = e - Math.floor((2447 * f) / 80);
  const g = Math.floor(f / 11);
  const month = f + 2 - 12 * g;
  const year = 100 * (b - 49) + d + g;

  return { year, month, day };
}

function formatGregorian(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  const yyyy = String(date.getUTCFullYear()).padStart(4, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}
