# Triangle Toddler Planner

Server-rendered Next.js app for surfacing local toddler-friendly activities.

## Scripts

- `npm run dev` – start the development server.
- `npm run seed` – seed Supabase with evergreen activities.
- `npm run events:import` – pull upcoming events from Triangle on the Cheap and upsert them into the Supabase `events` table.

Set `SUPABASE_URL` and either `SUPABASE_SERVICE_ROLE` or `SUPABASE_ANON_KEY` in `.env` before running any scripts. For the event importer you can optionally override:

- `EVENTS_CATEGORY_ID` (default `3`) – Triangle on the Cheap category id to query.
- `EVENTS_USER_AGENT` – custom UA string (include a contact email for polite scraping).

The importer fetches only the current weekend and the following weekend, keeping Supabase lean while refreshing time-bound events.

## Events Table

Create an `events` table in Supabase with at least the following fields:

```sql
create table public.events (
  id uuid default gen_random_uuid() primary key,
  source text not null,
  source_id text not null unique,
  title text not null,
  url text,
  start_at timestamptz not null,
  end_at timestamptz,
  start_local timestamptz,
  end_local timestamptz,
  time_text text,
  cost_text text,
  location_text text,
  is_free boolean default false,
  raw_meta text,
  updated_at timestamptz default now()
);
create index events_start_at_idx on public.events (start_at);
```

The importer stores both UTC (`start_at`/`end_at`) and local (`start_local`/`end_local`) timestamps so the UI can format times accurately.

## Events in the UI

- The **Now**, **Later**, and **Weekend** tabs now show a dedicated “Happening Soon/Upcoming Events/Weekend Events” section.
- Events are sourced from the `events` table and rendered with location, time, and cost badges.
- Evergreen recommendations remain unchanged and appear in their original sections.

## Data Sources

- Weather data: National Weather Service (fallback to Open-Meteo).
- Activities: Supabase `activities`, `activity_logs`, `category_prefs` tables.
- Events: Triangle on the Cheap kids calendar (scraped via AJAX endpoint).
