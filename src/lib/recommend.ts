// Supabase client
import { supaServer } from "@/lib/supabase";
import { CHAPEL_HILL } from "@/constants/location";
import { haversineMiles } from "@/lib/geo";
import { getWeatherSummary, getWeekendForecast, getTodayHighLow } from "@/lib/weather";
import { getNowMs } from "@/lib/clock";
import { getDriveSeconds } from "@/lib/travel";
import { closesWithinHours, getTodayHoursText, isOpenNow } from "@/lib/openHours";

type When = "now" | "later";

const TYPE_DECAY_DAYS: Record<string, number> = {
  park: 3,
  splash: 3,
  walk: 2,
  library: 5,
  museum: 10,
  indoor: 5,
};

async function fetchActivitiesFallback(): Promise<any[]> {
  const urlBase = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY;
  if (!urlBase || !key) return [];
  try {
    const res = await fetch(`${urlBase}/rest/v1/activities?select=*`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (err) {
      const trimmed = text.trim();
      const lastBracket = trimmed.lastIndexOf("]");
      if (lastBracket >= 0) {
        return JSON.parse(trimmed.slice(0, lastBracket + 1));
      }
      throw err;
    }
  } catch (err) {
    console.error("activities fallback fetch failed", err);
    return [];
  }
}

function mapActivityRow(row: any) {
  // Map snake_case (Supabase) to the shape used by the recommender
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    description: row.description ?? null,
    lat: row.lat,
    lng: row.lng,
    minAgeMonths: row.min_age_months ?? null,
    maxAgeMonths: row.max_age_months ?? null,
    durationMin: row.duration_min ?? null,
    openHoursJson: row.open_hours_json ?? undefined,
    weatherFlags: row.weather_flags ?? [],
    costTier: row.cost_tier ?? null,
    tags: row.tags ?? [],
  };
}

export async function getRecommendations(when: When, limit = 5) {
  // Fetch with snake_case, fall back to Prisma-style PascalCase tables
  let actsRes = await supaServer.from("activities").select("*");
  if (actsRes.error) actsRes = await supaServer.from("Activity").select("*");
  let logsRes = await supaServer.from("activity_logs").select("*").order("started_at", { ascending: false }).limit(200);
  if (logsRes.error) logsRes = await supaServer.from("ActivityLog").select("*").order("startedAt", { ascending: false }).limit(200);
  let prefsRes = await supaServer.from("category_prefs").select("*");
  if (prefsRes.error) prefsRes = await supaServer.from("CategoryPref").select("*");
  const [weather, todayHL] = await Promise.all([getWeatherSummary(when), getTodayHighLow()]);

  let activityRows = actsRes.data ?? [];
  if (actsRes.error && /Unexpected non-whitespace character/.test(actsRes.error.message ?? "")) {
    const fallback = await fetchActivitiesFallback();
    if (fallback.length) {
      console.warn("Using activities fallback due to Supabase JSON parse issue", fallback.length);
      activityRows = fallback;
    }
  }
  const activities = activityRows.map(mapActivityRow);
  const logs = (logsRes.data ?? []).map((l: any) => ({
    id: l.id,
    activityId: l.activity_id ?? l.activityId,
    startedAt: new Date(l.started_at ?? l.startedAt),
  }));
  const prefs = (prefsRes.data ?? []).map((p: any) => ({ id: p.id, category: p.category, weight: p.weight }));

  const prefWeightByCat = new Map<string, number>();
  for (const p of prefs) prefWeightByCat.set(p.category, p.weight);

  const lastDoneByActivity = new Map<number, Date>();
  const lastDoneByType = new Map<string, Date>();
  for (const log of logs) {
    if (!lastDoneByActivity.has(log.activityId)) lastDoneByActivity.set(log.activityId, log.startedAt);
  }
  for (const log of logs) {
    // fetch activity type lazily for category recency
    const act = activities.find((a) => a.id === log.activityId);
    if (act && !lastDoneByType.has(act.type)) lastDoneByType.set(act.type, log.startedAt);
  }

  const withAvailability = activities.filter((a: any) => {
    if (when !== "now") return true;
    const spec = (a.openHoursJson as any) || undefined;
    if (spec && !isOpenNow(spec)) return false;
    if (spec && closesWithinHours(spec, 2)) return false;
    return true;
  });

  const scored = withAvailability
    .map((a) => {
      const distanceMi = haversineMiles({ lat: a.lat, lng: a.lng }, CHAPEL_HILL);
      const reasons: string[] = [];

      // Weather fit: if raining, prefer indoor; if hot, prefer shade/water; if cold, prefer indoor/short
      let weatherFit = 1;
      const flags = new Set(a.weatherFlags ?? []);
      if (weather.isRaining && !flags.has("indoor")) weatherFit -= 0.7, reasons.push("Rain: prefer indoor");
      if (!weather.isRaining && flags.has("indoor")) reasons.push("Indoor OK today");
      if (weather.isHot && (flags.has("water") || flags.has("shade"))) reasons.push("Hot: water/shade");
      if (weather.isCold && flags.has("indoor")) reasons.push("Cold: indoor");

      // Novelty: penalty if done recently, and lighter penalty by category
      const now = getNowMs();
      const lastAct = lastDoneByActivity.get(a.id)?.getTime();
      const lastType = lastDoneByType.get(a.type)?.getTime();
      const decayDays = TYPE_DECAY_DAYS[a.type] ?? 5;
      const recentActDays = lastAct ? (now - lastAct) / (1000 * 60 * 60 * 24) : Infinity;
      const recentTypeDays = lastType ? (now - lastType) / (1000 * 60 * 60 * 24) : Infinity;
      let novelty = 1;
      if (recentActDays < decayDays) {
        novelty -= 0.6 * (1 - recentActDays / decayDays);
        reasons.push(`Did recently (${Math.max(1, Math.floor(recentActDays))}d ago)`);
      } else if (recentTypeDays < decayDays) {
        novelty -= 0.3 * (1 - recentTypeDays / decayDays);
        reasons.push(`Similar recently (${Math.max(1, Math.floor(recentTypeDays))}d)`);
      } else {
        reasons.push("Nice change of pace");
      }

      // Preferences weight
      const pref = prefWeightByCat.get(a.type) ?? 0.5; // neutral default
      if (pref > 0.6) reasons.push(`You like ${a.type}`);

      // Distance penalty (favor closer)
      const distPenalty = Math.min(1, distanceMi / 12); // 0..1 scaled by ~12mi
      if (distanceMi < 3) reasons.push(`Close by (${distanceMi.toFixed(1)} mi)`);

      // Cost consideration
      if ((a.costTier ?? 0) === 0) reasons.push("Free");

      // Composite score (0..100)
      const score =
        40 * pref +
        25 * Math.max(0, weatherFit) +
        15 * Math.max(0, novelty) +
        10 * (1 - distPenalty) +
        10; // base

      return { activity: a, score, reasons, distanceMi };
    })
    .sort((a, b) => b.score - a.score);

  // Apply 75/25 outdoor vs indoor mix per rule
  const maxToday = todayHL?.tempMaxF ?? weather.tempF;
  const noRain = !weather.isRaining && weather.precipProb <= 10;
  const heavyRain = (todayHL?.precipProbMax ?? 0) > 90 || weather.precipProb > 90;
  const comfy = noRain && maxToday >= 60 && maxToday <= 80;
  const outdoorShare = comfy ? 0.75 : 0.25;
  const outdoorTarget = heavyRain ? 0 : Math.round(limit * outdoorShare);
  const indoorTarget = heavyRain ? limit : limit - outdoorTarget;

  const isIndoor = (a: typeof scored[number]["activity"]) => new Set(a.weatherFlags ?? []).has("indoor");
  const outdoor = scored.filter((r) => !isIndoor(r.activity));
  const indoor = scored.filter((r) => isIndoor(r.activity));

  const pick = <T>(arr: T[], n: number) => arr.slice(0, Math.max(0, n));
  let picked: typeof scored;
  if (heavyRain) {
    // Do not include any outdoor activities
    picked = pick(indoor, limit);
  } else {
    picked = [...pick(outdoor, outdoorTarget), ...pick(indoor, indoorTarget)];
    if (picked.length < limit) {
      const remaining = scored.filter((r) => !picked.includes(r));
      picked = [...picked, ...pick(remaining, limit - picked.length)];
    } else {
      picked = picked.slice(0, limit);
    }
  }

  // Enrich with drive times and hours text
  const enriched = await Promise.all(
    picked.map(async (r) => {
      const sec = await getDriveSeconds({ lat: r.activity.lat, lng: r.activity.lng });
      const mins = Math.max(1, Math.round(sec / 60));
      const hoursText = getTodayHoursText((r.activity.openHoursJson as any) || undefined);
      return { ...r, driveMinutes: mins, hoursText };
    })
  );

  return { when, weather, results: enriched };
}

export async function getWeekendRecommendations(limit = 6) {
  let actsRes = await supaServer.from("activities").select("*");
  if (actsRes.error) actsRes = await supaServer.from("Activity").select("*");
  let logsRes = await supaServer.from("activity_logs").select("*").order("started_at", { ascending: false }).limit(200);
  if (logsRes.error) logsRes = await supaServer.from("ActivityLog").select("*").order("startedAt", { ascending: false }).limit(200);
  let prefsRes = await supaServer.from("category_prefs").select("*");
  if (prefsRes.error) prefsRes = await supaServer.from("CategoryPref").select("*");
  const weekend = await getWeekendForecast();

  let activityRows = actsRes.data ?? [];
  if (actsRes.error && /Unexpected non-whitespace character/.test(actsRes.error.message ?? "")) {
    const fallback = await fetchActivitiesFallback();
    if (fallback.length) {
      console.warn("Using activities fallback due to Supabase JSON parse issue", fallback.length);
      activityRows = fallback;
    }
  }
  const activities = activityRows.map(mapActivityRow);
  const logs = (logsRes.data ?? []).map((l: any) => ({ id: l.id, activityId: l.activity_id ?? l.activityId, startedAt: new Date(l.started_at ?? l.startedAt) }));
  const prefs = (prefsRes.data ?? []).map((p: any) => ({ id: p.id, category: p.category, weight: p.weight }));

  const prefWeightByCat = new Map<string, number>();
  for (const p of prefs) prefWeightByCat.set(p.category, p.weight);

  const lastDoneByActivity = new Map<number, Date>();
  const lastDoneByType = new Map<string, Date>();
  for (const log of logs) if (!lastDoneByActivity.has(log.activityId)) lastDoneByActivity.set(log.activityId, log.startedAt);
  for (const log of logs) {
    const act = activities.find((a) => a.id === log.activityId);
    if (act && !lastDoneByType.has(act.type)) lastDoneByType.set(act.type, log.startedAt);
  }

  // Derive weekend condition signals
  const highs = weekend.days.map((d) => d.tempMaxF).filter((n) => Number.isFinite(n));
  const lows = weekend.days.map((d) => d.tempMinF).filter((n) => Number.isFinite(n));
  const pops = weekend.days.map((d) => d.precipProbMax).filter((n) => Number.isFinite(n));
  const avgHigh = highs.length ? highs.reduce((a, b) => a + b, 0) / highs.length : 75;
  const minLow = lows.length ? Math.min(...lows) : 50;
  const maxPop = pops.length ? Math.max(...pops) : 20;
  const weekendRainy = maxPop >= 50;
  const weekendHot = avgHigh >= 85;
  const weekendCold = minLow <= 45;

  const scored = activities
    .map((a) => {
      const distanceMi = haversineMiles({ lat: a.lat, lng: a.lng }, CHAPEL_HILL);
      const reasons: string[] = [];

      // Weekend weather fit
      let weatherFit = 1;
      const flags = new Set(a.weatherFlags ?? []);
      if (weekendRainy && !flags.has("indoor")) weatherFit -= 0.6, reasons.push("Rain likely: indoor better");
      if (weekendHot && (flags.has("water") || flags.has("shade"))) reasons.push("Hot: water/shade good");
      if (weekendCold && flags.has("indoor")) reasons.push("Cold: indoor");

      // Novelty
      const now = getNowMs();
      const lastAct = lastDoneByActivity.get(a.id)?.getTime();
      const lastType = lastDoneByType.get(a.type)?.getTime();
      const decayDays = TYPE_DECAY_DAYS[a.type] ?? 5;
      const recentActDays = lastAct ? (now - lastAct) / (1000 * 60 * 60 * 24) : Infinity;
      const recentTypeDays = lastType ? (now - lastType) / (1000 * 60 * 60 * 24) : Infinity;
      let novelty = 1;
      if (recentActDays < decayDays) {
        novelty -= 0.6 * (1 - recentActDays / decayDays);
        reasons.push(`Did recently (${Math.max(1, Math.floor(recentActDays))}d ago)`);
      } else if (recentTypeDays < decayDays) {
        novelty -= 0.3 * (1 - recentTypeDays / decayDays);
        reasons.push(`Similar recently (${Math.max(1, Math.floor(recentTypeDays))}d)`);
      } else {
        reasons.push("Nice change of pace");
      }

      // Preferences
      const pref = prefWeightByCat.get(a.type) ?? 0.5;
      if (pref > 0.6) reasons.push(`You like ${a.type}`);

      // Distance
      const distPenalty = Math.min(1, distanceMi / 12);
      if (distanceMi < 3) reasons.push(`Close (${distanceMi.toFixed(1)} mi)`);

      if ((a.costTier ?? 0) === 0) reasons.push("Free");

      const score = 40 * pref + 25 * Math.max(0, weatherFit) + 15 * Math.max(0, novelty) + 10 * (1 - distPenalty) + 10;
      return { activity: a, score, reasons, distanceMi };
    })
    .sort((a, b) => b.score - a.score);

  // Apply 75/25 outdoor vs indoor mix per rule for weekend
  const noRainWeekend = maxPop <= 10; // essentially no rain forecast
  const heavyRainWeekend = maxPop > 90;
  const comfyWeekend = noRainWeekend && avgHigh >= 60 && avgHigh <= 80;
  const outdoorShare = comfyWeekend ? 0.75 : 0.25;
  const outdoorTarget = heavyRainWeekend ? 0 : Math.round(limit * outdoorShare);
  const indoorTarget = heavyRainWeekend ? limit : limit - outdoorTarget;

  const isIndoor = (a: typeof scored[number]["activity"]) => new Set(a.weatherFlags ?? []).has("indoor");
  const outdoor = scored.filter((r) => !isIndoor(r.activity));
  const indoor = scored.filter((r) => isIndoor(r.activity));
  const pick = <T>(arr: T[], n: number) => arr.slice(0, Math.max(0, n));
  let picked: typeof scored;
  if (heavyRainWeekend) {
    picked = pick(indoor, limit); // only indoor when >90% rain chance
  } else {
    picked = [...pick(outdoor, outdoorTarget), ...pick(indoor, indoorTarget)];
    if (picked.length < limit) {
      const remaining = scored.filter((r) => !picked.includes(r));
      picked = [...picked, ...pick(remaining, limit - picked.length)];
    } else {
      picked = picked.slice(0, limit);
    }
  }

  const enriched = await Promise.all(
    picked.map(async (r) => {
      const sec = await getDriveSeconds({ lat: r.activity.lat, lng: r.activity.lng });
      const mins = Math.max(1, Math.round(sec / 60));
      const hoursText = getTodayHoursText((r.activity.openHoursJson as any) || undefined);
      return { ...r, driveMinutes: mins, hoursText };
    })
  );

  return { weekend, results: enriched };
}
