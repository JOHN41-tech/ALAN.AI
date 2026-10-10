export const DEFAULT_TIME_ZONE = "Asia/Kolkata";

export function collegeTimeZone() {
  return process.env.NEXT_PUBLIC_COLLEGE_TIME_ZONE || DEFAULT_TIME_ZONE;
}

export function dateKeyInZone(date = new Date(), timeZone = collegeTimeZone()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function zonedLocalToUtc(local: string, timeZone: string) {
  const [datePart, timePart = "00:00:00"] = local.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour = 0, minute = 0, second = 0] = timePart.split(":").map(Number);
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let candidate = desiredAsUtc;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(candidate));
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const represented = Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day), Number(value.hour), Number(value.minute), Number(value.second));
    const correction = represented - desiredAsUtc;
    if (correction === 0) break;
    candidate = desiredAsUtc - correction;
  }
  return new Date(candidate);
}

export function localDateTimeToIso(local: string, timeZone = collegeTimeZone()) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(local)) throw new RangeError("Use a valid local date and time.");
  const value = zonedLocalToUtc(local, timeZone);
  if (Number.isNaN(value.getTime())) throw new RangeError("Use a valid local date and time.");
  return value.toISOString();
}

export function startOfDayInZone(day: string, timeZone = collegeTimeZone()) {
  return zonedLocalToUtc(`${day}T00:00:00`, timeZone);
}

export function addCalendarDays(day: string, days: number) {
  const [year, month, date] = day.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, date + days));
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, "0")}-${String(result.getUTCDate()).padStart(2, "0")}`;
}

export function formatInCollegeTime(iso: string, options: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" }, timeZone = collegeTimeZone()) {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone }).format(new Date(iso));
}

export function isoToLocalDateTimeInput(iso: string, timeZone = collegeTimeZone()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}
