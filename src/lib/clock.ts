import { DateTime } from 'luxon';

const RAW_OVERRIDE = process.env.FAKE_NOW ?? process.env.NEXT_PUBLIC_FAKE_NOW ?? null;

let overrideDateTime: DateTime | null = null;
if (RAW_OVERRIDE) {
  const parsed = DateTime.fromISO(RAW_OVERRIDE, { setZone: true });
  if (parsed.isValid) {
    overrideDateTime = parsed;
  } else {
    console.warn(`[clock] Invalid FAKE_NOW value: ${RAW_OVERRIDE}`);
  }
}

export function hasNowOverride(): boolean {
  return overrideDateTime !== null;
}

export function getNow(): Date {
  return overrideDateTime ? overrideDateTime.toJSDate() : new Date();
}

export function getNowMs(): number {
  return overrideDateTime ? overrideDateTime.toMillis() : Date.now();
}

export function getNowDateTime(zone?: string): DateTime {
  const base = overrideDateTime ?? DateTime.now();
  return zone ? base.setZone(zone) : base;
}

export function getNowIso(): string {
  const dt = getNowDateTime();
  return dt.toISO() ?? dt.toJSDate().toISOString();
}
