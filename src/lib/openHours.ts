import { CHAPEL_HILL } from "@/constants/location";

export type HoursSpec = {
  mon?: [string, string][];
  tue?: [string, string][];
  wed?: [string, string][];
  thu?: [string, string][];
  fri?: [string, string][];
  sat?: [string, string][];
  sun?: [string, string][];
};

const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function getLocalNowParts() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CHAPEL_HILL.tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdayStr = get("weekday");
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = weekdayMap[weekdayStr] ?? new Date().getDay();
  const hour = parseInt(get("hour") || "0", 10);
  const minute = parseInt(get("minute") || "0", 10);
  return { weekday, hour, minute };
}

function to12h(hhmm: string) {
  const [H, M] = hhmm.split(":").map((n) => parseInt(n, 10));
  const ampm = H >= 12 ? "PM" : "AM";
  const h12 = ((H + 11) % 12) + 1;
  const mm = String(M).padStart(2, "0");
  return `${h12}:${mm} ${ampm}`;
}

export function getTodayHoursText(spec?: HoursSpec): string | null {
  if (!spec) return null;
  const { weekday } = getLocalNowParts();
  const key = dayKeys[weekday];
  const ranges = (spec as any)[key] as [string, string][] | undefined;
  if (!ranges || ranges.length === 0) return "Closed today";
  return ranges.map(([open, close]) => `${to12h(open)} – ${to12h(close)}`).join(", ");
}

export function isOpenNow(spec?: HoursSpec): boolean {
  if (!spec) return true; // if unknown, don't block
  const { weekday, hour, minute } = getLocalNowParts();
  const nowM = hour * 60 + minute;
  const key = dayKeys[weekday];
  const ranges = (spec as any)[key] as [string, string][] | undefined;
  if (!ranges || ranges.length === 0) return false;
  for (const [open, close] of ranges) {
    const [oH, oM] = open.split(":").map(Number);
    const [cH, cM] = close.split(":").map(Number);
    const startM = oH * 60 + oM;
    const endM = cH * 60 + cM;
    if (nowM >= startM && nowM <= endM) return true;
  }
  return false;
}

export function closesWithinHours(spec: HoursSpec | undefined, hours: number): boolean {
  if (!spec) return false;
  const { weekday, hour, minute } = getLocalNowParts();
  const nowM = hour * 60 + minute;
  const key = dayKeys[weekday];
  const ranges = (spec as any)[key] as [string, string][] | undefined;
  if (!ranges || ranges.length === 0) return false;
  const thresholdM = hours * 60;
  for (const [, close] of ranges) {
    const [cH, cM] = close.split(":").map(Number);
    const endM = cH * 60 + cM;
    const diff = endM - nowM;
    if (diff >= 0 && diff <= thresholdM) return true;
  }
  return false;
}

export function getHoursForWeekday(spec: HoursSpec | undefined, weekday: number): string | null {
  if (!spec) return null;
  const key = dayKeys[weekday] as unknown as keyof HoursSpec;
  const ranges = (spec as any)[key] as [string, string][] | undefined;
  if (!ranges || ranges.length === 0) return "Closed";
  return ranges.map(([open, close]) => `${to12h(open)} – ${to12h(close)}`).join(", ");
}

export function weekdayShortName(idx: number): string {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return names[idx] ?? "";
}
