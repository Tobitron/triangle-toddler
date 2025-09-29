import { supaServer } from '@/lib/supabase';
import { CHAPEL_HILL } from '@/constants/location';
import { DateTime } from 'luxon';
import { getNowDateTime } from '@/lib/clock';

const SOURCE = 'triangle_on_the_cheap';
const TIMEZONE = CHAPEL_HILL.tz ?? 'America/New_York';

export type EventItem = {
  id: string;
  title: string;
  url: string | null;
  startAt: string | null;
  endAt: string | null;
  timeText: string | null;
  costText: string | null;
  locationText: string | null;
  isFree: boolean;
  source: string | null;
};

type WindowOpts = {
  start: DateTime;
  end: DateTime;
  limit?: number;
};

function mapEventRow(row: any): EventItem {
  const startLocal = row.start_local ?? row.startLocal ?? row.start_at ?? row.startAt ?? null;
  const endLocal = row.end_local ?? row.endLocal ?? row.end_at ?? row.endAt ?? null;
  return {
    id: String(row.id ?? row.source_id ?? `${row.source}-${row.title}`),
    title: row.title ?? 'Event',
    url: row.url ?? null,
    startAt: startLocal,
    endAt: endLocal,
    timeText: row.time_text ?? row.timeText ?? null,
    costText: row.cost_text ?? row.costText ?? null,
    locationText: row.location_text ?? row.locationText ?? row.location ?? null,
    isFree: Boolean(row.is_free ?? row.isFree ?? false),
    source: row.source ?? null,
  };
}

async function fetchEventsWithin({ start, end, limit = 50 }: WindowOpts): Promise<EventItem[]> {
  const { data, error } = await supaServer
    .from('events')
    .select(
      'id, source, source_id, title, url, start_at, end_at, start_local, end_local, time_text, cost_text, location_text, is_free',
    )
    .eq('source', SOURCE)
    .gte('end_at', start.toUTC().toISO())
    .lte('start_at', end.toUTC().toISO())
    .order('start_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[events] fetch error', error.message ?? error);
    return [];
  }

  return (data ?? []).map(mapEventRow);
}

export async function getEventsForNow(limit = 50): Promise<EventItem[]> {
  const now = getNowDateTime(TIMEZONE);
  const windowStart = now.minus({ hours: 1 });
  const windowEnd = now.plus({ hours: 8 });
  return fetchEventsWithin({ start: windowStart, end: windowEnd, limit });
}

export async function getEventsForLater(limit = 50): Promise<EventItem[]> {
  const now = getNowDateTime(TIMEZONE).startOf('day');
  const tomorrow = now.plus({ days: 1 });
  const end = tomorrow.plus({ days: 6 }).endOf('day');
  return fetchEventsWithin({ start: tomorrow, end, limit });
}

export async function getEventsForWeekend(limit = 50): Promise<EventItem[]> {
  const today = getNowDateTime(TIMEZONE).startOf('day');
  const weekday = today.weekday; // 1 (Mon) .. 7 (Sun)
  let saturday = today;
  if (weekday < 6) {
    saturday = today.plus({ days: 6 - weekday });
  } else if (weekday === 7) {
    saturday = today.plus({ days: 6 });
  }
  const sundayEnd = saturday.plus({ days: 1 }).endOf('day');
  return fetchEventsWithin({ start: saturday.startOf('day'), end: sundayEnd, limit });
}

export function formatEventDate(event: EventItem): { day: string; time: string } {
  if (!event.startAt) {
    return { day: '', time: event.timeText ?? '' };
  }
  const start = DateTime.fromISO(event.startAt, { zone: TIMEZONE });
  const day = start.toFormat('ccc, MMM d');
  const time = event.timeText ?? start.toFormat('h:mm a');
  return { day, time };
}
