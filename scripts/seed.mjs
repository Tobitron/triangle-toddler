import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE (preferred) or SUPABASE_ANON_KEY');
  process.exit(1);
}
const supa = createClient(url, key, { auth: { persistSession: false } });

function loadJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

const base = loadJson('data/activities.json');
const extra = fs.existsSync('data/activities_extra.json') ? loadJson('data/activities_extra.json') : [];
const items = [...base, ...extra];

async function detectTableStyle() {
  // Try snake_case first
  let t = await supa.from('activities').select('id').limit(1);
  if (!t.error) return 'snake';
  // Then PascalCase
  t = await supa.from('Activity').select('id').limit(1);
  if (!t.error) return 'pascal';
  return 'missing';
}

const style = await detectTableStyle();
if (style === 'missing') {
  console.error('\nNo activities table found. Create tables in Supabase with this SQL, then rerun:');
  console.error(`\n-- Run in Supabase SQL editor (public schema)\nCREATE TABLE IF NOT EXISTS activities (\n  id serial PRIMARY KEY,\n  name text NOT NULL,\n  type text NOT NULL,\n  description text,\n  lat double precision NOT NULL,\n  lng double precision NOT NULL,\n  min_age_months int,\n  max_age_months int,\n  duration_min int,\n  open_hours_json jsonb,\n  weather_flags text[] DEFAULT '{}',\n  cost_tier int,\n  tags text[] DEFAULT '{}',\n  created_at timestamptz DEFAULT now(),\n  updated_at timestamptz DEFAULT now()\n);\nCREATE TABLE IF NOT EXISTS activity_logs (\n  id serial PRIMARY KEY,\n  activity_id int REFERENCES activities(id) ON DELETE CASCADE,\n  started_at timestamptz NOT NULL,\n  duration_min int,\n  rating int,\n  notes text,\n  who text,\n  created_at timestamptz DEFAULT now()\n);\nCREATE TABLE IF NOT EXISTS category_prefs (\n  id serial PRIMARY KEY,\n  category text UNIQUE NOT NULL,\n  weight double precision NOT NULL DEFAULT 0.5,\n  created_at timestamptz DEFAULT now(),\n  updated_at timestamptz DEFAULT now()\n);`);
  process.exit(1);
}

const tableNames = style === 'snake'
  ? { acts: 'activities', logs: 'activity_logs', prefs: 'category_prefs' }
  : { acts: 'Activity', logs: 'ActivityLog', prefs: 'CategoryPref' };

for (const item of items) {
  const hasCoords = Number.isFinite(item.lat) && Number.isFinite(item.lng);
  if (!hasCoords) { continue; }
  const payload = {
    name: item.name,
    type: item.type,
    description: item.description ?? null,
    lat: item.lat, lng: item.lng,
    min_age_months: item.minAgeMonths ?? null,
    max_age_months: item.maxAgeMonths ?? null,
    duration_min: item.durationMin ?? null,
    open_hours_json: item.openHoursJson ?? null,
    weather_flags: item.weatherFlags ?? [],
    cost_tier: item.costTier ?? null,
    tags: item.tags ?? [],
  };
  // Upsert by name using two-step to support schemas without unique constraints
  const { data: existing, error: existsErr } = await supa.from(tableNames.acts).select('id').eq('name', item.name).limit(1).maybeSingle();
  if (existing?.id) {
    const { error } = await supa.from(tableNames.acts).update(payload).eq('id', existing.id);
    if (error) console.error('[seed:update:error]', error.message);
  } else {
    const { error } = await supa.from(tableNames.acts).insert(payload);
    if (error) console.error('[seed:insert:error]', error.message);
  }
}

// Default category prefs if missing
const defaults = [
  { category: 'park', weight: 0.7 },
  { category: 'library', weight: 0.8 },
  { category: 'museum', weight: 0.6 },
  { category: 'splash', weight: 0.7 },
  { category: 'walk', weight: 0.7 },
  { category: 'indoor', weight: 0.6 },
];
for (const p of defaults) {
  const { data: ex } = await supa.from(tableNames.prefs).select('id').eq('category', p.category).limit(1).maybeSingle();
  if (!ex?.id) {
    const { error } = await supa.from(tableNames.prefs).insert(p);
    if (error) console.error('[seed:prefs:error]', error.message);
  }
}

console.log('Seed complete');
