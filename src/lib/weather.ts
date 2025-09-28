import { CHAPEL_HILL } from "@/constants/location";

export type WeatherSummary = {
  at: string; // ISO timestamp hour
  tempF: number;
  precipProb: number; // 0..100
  windMph: number;
  code: number;
  isRaining: boolean;
  isHot: boolean;
  isCold: boolean;
};

function pickHourISO(date: Date) {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d.toISOString().slice(0, 13) + ":00";
}

function weatherCodeIsWet(code: number) {
  // Open-Meteo weather codes for precipitation
  const wet = new Set([
    51, 53, 55, // drizzle
    61, 63, 65, // rain
    80, 81, 82, // rain showers
    95, 96, 99, // thunderstorms
    66, 67, 71, 73, 75, 77, 85, 86, // freezing rain/snow
  ]);
  return wet.has(code);
}

function localHourISO(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const y = get("year");
  const m = get("month");
  const d = get("day");
  const h = get("hour");
  return `${y}-${m}-${d}T${h}:00`;
}

export async function getWeatherSummary(when: "now" | "later"): Promise<WeatherSummary> {
  const now = new Date();
  const target = new Date(now);
  if (when === "later") target.setHours(now.getHours() + 3);

  const params = new URLSearchParams({
    latitude: String(CHAPEL_HILL.lat),
    longitude: String(CHAPEL_HILL.lng),
    hourly: "temperature_2m,precipitation_probability,weathercode,windspeed_10m",
    temperature_unit: "fahrenheit",
    windspeed_unit: "mph",
    timezone: CHAPEL_HILL.tz,
  });
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
      next: { revalidate: 60 * 60 }, // cache for 1h on server
    });
    const data = (await res.json()) as any;
    const hourly = data?.hourly;
    const times: string[] = hourly?.time ?? [];
    // Open-Meteo returns local times per timezone param; match on local hour string
    const localHour = localHourISO(target, CHAPEL_HILL.tz);
    let idx = times.indexOf(localHour);
    if (idx < 0) {
      // Fallback: try matching by hour prefix
      const hourPrefix = localHour.slice(0, 13);
      idx = times.findIndex((t) => t.startsWith(hourPrefix));
    }
    const useIdx = idx >= 0 ? idx : 0;
    const tempF = Number(hourly?.temperature_2m?.[useIdx] ?? 72);
    const precipProb = Number(hourly?.precipitation_probability?.[useIdx] ?? 0);
    const code = Number(hourly?.weathercode?.[useIdx] ?? 0);
    const windMph = Number(hourly?.windspeed_10m?.[useIdx] ?? 5);
    const isRaining = weatherCodeIsWet(code) || precipProb >= 50;
    return {
      at: times[useIdx] ?? pickHourISO(target),
      tempF,
      precipProb,
      windMph,
      code,
      isRaining,
      isHot: tempF >= 85,
      isCold: tempF <= 45,
    };
  } catch {
    return {
      at: pickHourISO(target),
      tempF: 72,
      precipProb: 5,
      windMph: 4,
      code: 0,
      isRaining: false,
      isHot: false,
      isCold: false,
    };
  }
}

export type WeekendDay = {
  date: string; // YYYY-MM-DD
  dayName: string; // Sat, Sun
  tempMaxF: number;
  tempMinF: number;
  precipProbMax: number; // 0..100
  code?: number; // optional when using NWS
  summary: string; // human summary
};

function codeLabel(code: number) {
  const map: Record<number, string> = {
    0: "Clear",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    66: "Freezing rain",
    67: "Heavy freezing rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Rain showers",
    81: "Heavy rain showers",
    82: "Violent rain showers",
    85: "Snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm w/ hail",
    99: "Severe thunderstorm",
  };
  return map[code] ?? "Weather";
}

function getThisWeekendLocalDates(now = new Date()) {
  // Return Date[] for this weekend in local TZ, only future-or-today days
  const tz = CHAPEL_HILL.tz;
  const localMidnight = new Date(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
      .format(now)
      .replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$1-$2") + "T00:00:00"
  );
  const dow = new Date(localMidnight).getDay(); // 0 Sun .. 6 Sat
  const out: Date[] = [];
  if (dow >= 1 && dow <= 5) {
    // Mon-Fri → upcoming Sat+Sun
    const sat = new Date(localMidnight); sat.setDate(sat.getDate() + (6 - dow));
    const sun = new Date(sat); sun.setDate(sun.getDate() + 1);
    out.push(sat, sun);
  } else if (dow === 6) {
    // Saturday → today + tomorrow
    const sat = new Date(localMidnight);
    const sun = new Date(localMidnight); sun.setDate(sun.getDate() + 1);
    out.push(sat, sun);
  } else if (dow === 0) {
    // Sunday → today only
    const sun = new Date(localMidnight);
    out.push(sun);
  }
  return out;
}

export async function getWeekendForecast(): Promise<{ days: WeekendDay[] }> {
  // Use NWS for daily highs/lows
  try {
    const ua = { "User-Agent": "ToddlerPlanner/0.1 (contact: example@example.com)" };
    const points = await fetch(
      `https://api.weather.gov/points/${CHAPEL_HILL.lat},${CHAPEL_HILL.lng}`,
      { headers: ua, next: { revalidate: 60 * 60 } }
    ).then((r) => r.json());
    const forecastUrl: string | undefined = points?.properties?.forecast;
    if (!forecastUrl) throw new Error("no forecast url");
    const forecast = await fetch(forecastUrl, { headers: ua, next: { revalidate: 60 * 60 } }).then((r) => r.json());
    const periods: any[] = forecast?.properties?.periods ?? [];

    const targetDates = getThisWeekendLocalDates();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const targets = new Set(targetDates.map(fmt));

    // Group per local date, collect temps and precip probs
    const byDate = new Map<string, { temps: number[]; pops: number[]; labels: string[] }>();
    const toLocalYMD = (iso: string) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: CHAPEL_HILL.tz, year: "numeric", month: "2-digit", day: "2-digit" })
        .format(new Date(iso))
        .replace(/\//g, "-");
    for (const p of periods) {
      const date = toLocalYMD(p.startTime as string);
      if (!targets.has(date)) continue;
      const entry = byDate.get(date) ?? { temps: [], pops: [], labels: [] };
      if (typeof p.temperature === "number" && p.temperatureUnit === "F") entry.temps.push(p.temperature);
      const pop = p.probabilityOfPrecipitation?.value;
      if (typeof pop === "number") entry.pops.push(pop);
      if (typeof p.shortForecast === "string") entry.labels.push(p.shortForecast);
      byDate.set(date, entry);
    }

    const days: WeekendDay[] = [];
    for (const d of targetDates) {
      const key = fmt(d);
      const agg = byDate.get(key) ?? { temps: [], pops: [], labels: [] };
      const tempMaxF = agg.temps.length ? Math.max(...agg.temps) : 0;
      const tempMinF = agg.temps.length ? Math.min(...agg.temps) : 0;
      const precipProbMax = agg.pops.length ? Math.max(...agg.pops) : 0;
      const label = agg.labels[0] ?? "";
      days.push({
        date: key,
        dayName: d.toLocaleDateString("en-US", { weekday: "short", timeZone: CHAPEL_HILL.tz }),
        tempMaxF,
        tempMinF,
        precipProbMax,
        summary: label,
      });
    }
    return { days };
  } catch {
    // Fallback to Open-Meteo if NWS fails
    try {
      const dates = getThisWeekendLocalDates();
      if (!dates.length) return { days: [] };
      const start = dates[0].toISOString().slice(0, 10);
      const end = dates[dates.length - 1].toISOString().slice(0, 10);
      const params = new URLSearchParams({
        latitude: String(CHAPEL_HILL.lat),
        longitude: String(CHAPEL_HILL.lng),
        daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode",
        temperature_unit: "fahrenheit",
        timezone: CHAPEL_HILL.tz,
        start_date: start,
        end_date: end,
      });
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, { next: { revalidate: 60 * 60 } });
      const data = (await res.json()) as any;
      const d = data?.daily ?? {};
      const out: WeekendDay[] = (d.time ?? []).map((date: string, idx: number) => {
        const dayName = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", timeZone: CHAPEL_HILL.tz });
        const code = Number(d.weathercode?.[idx] ?? 0);
        return {
          date,
          dayName,
          tempMaxF: Number(d.temperature_2m_max?.[idx] ?? 0),
          tempMinF: Number(d.temperature_2m_min?.[idx] ?? 0),
          precipProbMax: Number(d.precipitation_probability_max?.[idx] ?? 0),
          code,
          summary: codeLabel(code),
        };
      }).filter((x: WeekendDay) => ["Sat", "Sun"].includes(x.dayName));
      return { days: out };
    } catch {
      return { days: [] };
    }
  }
}

export type TodayHighLow = {
  date: string;
  dayName: string; // Today
  tempMaxF: number;
  tempMinF: number;
  precipProbMax: number;
  summary: string;
};

function localDateYYYYMMDD(tz: string, d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(d)
    .replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$1-$2");
  return parts; // YYYY-MM-DD
}

export async function getTodayHighLow(): Promise<TodayHighLow | null> {
  try {
    const ua = { "User-Agent": "ToddlerPlanner/0.1 (contact: example@example.com)" };
    const points = await fetch(
      `https://api.weather.gov/points/${CHAPEL_HILL.lat},${CHAPEL_HILL.lng}`,
      { headers: ua, next: { revalidate: 30 * 60 } }
    ).then((r) => r.json());
    const forecastUrl: string | undefined = points?.properties?.forecast;
    if (!forecastUrl) return null;
    const forecast = await fetch(forecastUrl, { headers: ua, next: { revalidate: 30 * 60 } }).then((r) => r.json());
    const periods: any[] = forecast?.properties?.periods ?? [];

    const today = localDateYYYYMMDD(CHAPEL_HILL.tz);
    const toLocalYMD = (iso: string) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: CHAPEL_HILL.tz, year: "numeric", month: "2-digit", day: "2-digit" })
        .format(new Date(iso))
        .replace(/\//g, "-");

    const forToday = periods.filter((p) => toLocalYMD(p.startTime as string) === today);
    if (!forToday.length) return null;

    const dayTemps = forToday
      .filter((p) => p.isDaytime && typeof p.temperature === "number" && p.temperatureUnit === "F")
      .map((p) => p.temperature as number);
    const nightTemps = forToday
      .filter((p) => !p.isDaytime && typeof p.temperature === "number" && p.temperatureUnit === "F")
      .map((p) => p.temperature as number);
    const allTemps = forToday
      .filter((p) => typeof p.temperature === "number" && p.temperatureUnit === "F")
      .map((p) => p.temperature as number);

    const tempMaxF = dayTemps.length ? Math.max(...dayTemps) : (allTemps.length ? Math.max(...allTemps) : 0);
    const tempMinF = nightTemps.length ? Math.min(...nightTemps) : (allTemps.length ? Math.min(...allTemps) : 0);

    const pops = forToday
      .map((p) => p.probabilityOfPrecipitation?.value)
      .filter((x) => typeof x === "number") as number[];
    const precipProbMax = pops.length ? Math.max(...pops) : 0;

    const dayLabel = forToday.find((p) => p.isDaytime)?.shortForecast as string | undefined;
    const summary = dayLabel ?? ((forToday[0]?.shortForecast as string) || "");
    return {
      date: today,
      dayName: "Today",
      tempMaxF,
      tempMinF,
      precipProbMax,
      summary,
    };
  } catch {
    return null;
  }
}
