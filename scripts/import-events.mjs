import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { load } from 'cheerio';
import { DateTime } from 'luxon';
import crypto from 'node:crypto';

const SOURCE = 'triangle_on_the_cheap';
const CATEGORY_ID = process.env.EVENTS_CATEGORY_ID ?? '3';
const TIMEZONE = 'America/New_York';
const BASE_URL = 'https://triangleonthecheap.com';
const AJAX_URL = `${BASE_URL}/wordpress/wp-admin/admin-ajax.php`;
const USER_AGENT = process.env.EVENTS_USER_AGENT ?? 'ToddlerPlanner/0.1 (+https://example.com/contact)';

const RAW_FAKE_NOW = process.env.FAKE_NOW ?? process.env.NEXT_PUBLIC_FAKE_NOW ?? null;
const NOW_OVERRIDE = RAW_FAKE_NOW ? DateTime.fromISO(RAW_FAKE_NOW, { setZone: true }) : null;
if (RAW_FAKE_NOW && (!NOW_OVERRIDE || !NOW_OVERRIDE.isValid)) {
  console.warn(`[events] Invalid FAKE_NOW value: ${RAW_FAKE_NOW}`);
}

function getNowDateTime(zone = TIMEZONE) {
  const base = NOW_OVERRIDE && NOW_OVERRIDE.isValid ? NOW_OVERRIDE : DateTime.now();
  return base.setZone(zone);
}

function requireEnv(name, value) {
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function hashFor(value) {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 10);
}

function makeSourceId(date, title, url) {
  const slug = slugify(title);
  const hash = hashFor(`${date}|${title}|${url ?? ''}`);
  return `${SOURCE}:${date}:${slug || hash}`;
}

function parseTimeRange(dateStr, timeText) {
  const day = DateTime.fromISO(dateStr, { zone: TIMEZONE });
  if (!timeText) {
    return {
      start: day.set({ hour: 9, minute: 0 }),
      end: day.set({ hour: 11, minute: 0 }),
    };
  }
  const normalized = timeText.toLowerCase();
  if (normalized.includes('all day')) {
    return {
      start: day.startOf('day'),
      end: day.endOf('day'),
    };
  }
  const clean = timeText.replace(/[\u2013\u2014]/g, '-');
  const rangeRegex = /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\s*(?:to|-|–)\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i;
  const rangeMatch = rangeRegex.exec(clean);
  if (rangeMatch) {
    const [, h1, m1, p1Raw, h2, m2, p2Raw] = rangeMatch;
    const p1 = p1Raw?.replace(/\./g, '') ?? 'am';
    const p2 = p2Raw?.replace(/\./g, '') ?? p1;
    const startHour = to24Hour(Number(h1), p1);
    const startMinute = Number(m1 ?? '0');
    const endHour = to24Hour(Number(h2), p2);
    const endMinute = Number(m2 ?? '0');
    return {
      start: day.set({ hour: startHour, minute: startMinute }),
      end: resolveEnd(day, { hour: endHour, minute: endMinute }, { hour: startHour, minute: startMinute }),
    };
  }
  const singleRegex = /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i;
  const singleMatch = singleRegex.exec(clean);
  if (singleMatch) {
    const [, hh, mm, periodRaw] = singleMatch;
    const period = periodRaw?.replace(/\./g, '') ?? 'am';
    const hour = to24Hour(Number(hh), period);
    const minute = Number(mm ?? '0');
    const start = day.set({ hour, minute });
    return {
      start,
      end: start.plus({ hours: 2 }),
    };
  }
  return {
    start: day.set({ hour: 9, minute: 0 }),
    end: day.set({ hour: 11, minute: 0 }),
  };
}

function to24Hour(hour, period) {
  const lower = period.toLowerCase();
  let h = hour % 12;
  if (lower.startsWith('p')) {
    h += 12;
  }
  return h;
}

function resolveEnd(day, endParts, startParts) {
  let end = day.set(endParts);
  let start = day.set(startParts);
  if (end <= start) {
    end = end.plus({ hours: 12 });
    if (end <= start) {
      end = end.plus({ hours: 12 });
    }
  }
  return end;
}

async function fetchDay(dateStr) {
  const dateObj = DateTime.fromISO(dateStr, { zone: TIMEZONE });
  const klass = `event-day-${dateStr.replace(/-/g, '')}-cat-${CATEGORY_ID}`;
  const params = new URLSearchParams({
    action: 'load_single_day',
    class: klass,
    date: dateStr,
    span: '+30 days',
    format: 'list',
    month: '',
    year: dateObj.toFormat('yyyy'),
    free: '',
    limit: '999',
    show: '',
    location: '',
    category: CATEGORY_ID,
    tag: '',
  });

  const res = await fetch(AJAX_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent': USER_AGENT,
      Referer: `${BASE_URL}/free-cheap-events-kids/`,
    },
    body: params,
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch events for ${dateStr}: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

function parseEvents(html, dateStr) {
  const $ = load(html);
  const events = [];
  $('.lotc-v2.row.event').each((_, el) => {
    const link = $(el).find('h3 a');
    const title = link.text().trim();
    if (!title) return;
    const url = link.attr('href') ?? null;
    const meta = $(el).find('p.meta').text().replace(/\s+/g, ' ').trim();
    const segments = meta.split('|').map((segment) => segment.trim()).filter(Boolean);
    const timeText = segments[0] ?? null;
    const costText = segments[1] ?? null;
    const locationText = segments[2] ?? null;
    const { start, end } = parseTimeRange(dateStr, timeText);
    events.push({
      title,
      url,
      date: dateStr,
      timeText,
      costText,
      locationText,
      start,
      end,
      isFree: Boolean(costText && /free/i.test(costText)),
      meta,
    });
  });
  return events;
}

async function main() {
  const url = requireEnv('SUPABASE_URL', process.env.SUPABASE_URL);
  const key = requireEnv(
    'SUPABASE_SERVICE_ROLE or SUPABASE_ANON_KEY',
    process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY,
  );

  const supa = createClient(url, key, { auth: { persistSession: false } });

  const today = getNowDateTime(TIMEZONE).startOf('day');
  const dates = buildFetchDates(today);

  const allEvents = [];
  for (const date of dates) {
    try {
      const html = await fetchDay(date);
      const events = parseEvents(html, date);
      if (events.length) {
        console.log(`Fetched ${events.length} events for ${date}`);
        allEvents.push(...events);
      }
    } catch (err) {
      console.warn(`Failed to process ${date}:`, err.message ?? err);
    }
    await wait(250);
  }

  if (!allEvents.length) {
    console.log('No events fetched. Exiting.');
    return;
  }

  const now = getNowDateTime(TIMEZONE);
  const payloadRaw = allEvents.map((event) => ({
    source: SOURCE,
    source_id: makeSourceId(event.date, event.title, event.url ?? ''),
    title: event.title,
    url: event.url,
    start_at: event.start.toUTC().toISO(),
    end_at: event.end.toUTC().toISO(),
    start_local: event.start.toISO(),
    end_local: event.end.toISO(),
    time_text: event.timeText,
    cost_text: event.costText,
    location_text: event.locationText,
    is_free: event.isFree,
    raw_meta: event.meta,
    updated_at: now.toUTC().toISO(),
  }));

  const deduped = new Map();
  let dedupedCount = 0;
  for (const item of payloadRaw) {
    const existing = deduped.get(item.source_id);
    if (!existing) {
      deduped.set(item.source_id, item);
      continue;
    }
    dedupedCount += 1;
    const existingStart = DateTime.fromISO(existing.start_at ?? existing.start_local ?? now.toISO());
    const candidateStart = DateTime.fromISO(item.start_at ?? item.start_local ?? now.toISO());
    if (candidateStart < existingStart) {
      deduped.set(item.source_id, item);
    }
  }
  const payload = Array.from(deduped.values());
  if (dedupedCount) {
    console.log(`Deduped ${dedupedCount} duplicate events`);
  }

  const cutoff = today.minus({ days: 1 }).toUTC().toISO();
  const { error: deleteError } = await supa
    .from('events')
    .delete()
    .eq('source', SOURCE)
    .lt('start_at', cutoff);
  if (deleteError && deleteError.code !== 'PGRST116') {
    console.warn('Failed to delete old events:', deleteError.message ?? deleteError);
  }

  const { error } = await supa
    .from('events')
    .upsert(payload, { onConflict: 'source_id' })
    .select('source_id');

  if (error) {
    console.error('Upsert failed:', error.message ?? error);
    process.exit(1);
  }

  console.log(`Imported ${payload.length} events from Triangle on the Cheap.`);
}

function buildFetchDates(base) {
  const dates = new Set();
  const addDay = (dt) => dates.add(dt.toISODate());

  if (base.weekday === 7) {
    addDay(base);
    const nextSaturday = base.plus({ days: 6 });
    addDay(nextSaturday);
    addDay(nextSaturday.plus({ days: 1 }));
    const followingSaturday = nextSaturday.plus({ days: 7 });
    addDay(followingSaturday);
    addDay(followingSaturday.plus({ days: 1 }));
  } else {
    const currentSaturday = base.plus({ days: (6 - base.weekday + 7) % 7 });
    addDay(currentSaturday);
    addDay(currentSaturday.plus({ days: 1 }));
    const nextSaturday = currentSaturday.plus({ days: 7 });
    addDay(nextSaturday);
    addDay(nextSaturday.plus({ days: 1 }));
  }

  return Array.from(dates).sort();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
