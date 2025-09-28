import { getWeekendForecast } from "@/lib/weather";
import { getWeekendRecommendations } from "@/lib/recommend";
import { WeatherIcon } from "@/components/WeatherIcon";
import { ActivityCard } from "@/components/ActivityCard";
import { getHoursForWeekday, weekdayShortName } from "@/lib/openHours";

export default async function WeekendPage() {
  const [weekend, recs] = await Promise.all([
    getWeekendForecast(),
    getWeekendRecommendations(),
  ]);
  return (
    <div className="space-y-4">
      <section>
        <h2 className="text-xl font-semibold">Weekend</h2>
        <p className="text-sm text-gray-600">Forecast for this weekend.</p>
      </section>
      {!!weekend.days.length && (
        <section className="rounded-lg border p-3">
          <div className="text-sm font-medium mb-2">This Weekend</div>
          <div className="grid grid-cols-2 gap-2">
            {weekend.days.map((d) => (
              <div key={d.date} className="rounded-md bg-gray-50 p-2">
                <div className="flex items-center gap-2">
                  <WeatherIcon code={d.code} label={d.summary} className="text-2xl" />
                  <div>
                    <div className="text-xs text-gray-600">{d.dayName} {new Date(d.date+"T00:00:00").toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                    <div className="text-sm">{Math.round(d.tempMaxF)}° / {Math.round(d.tempMinF)}°F</div>
                  </div>
                </div>
                <div className="text-xs text-gray-600 mt-1">{d.summary}</div>
                <div className="text-xs text-gray-600">Rain: {Math.round(d.precipProbMax)}%</div>
              </div>
            ))}
          </div>
        </section>
      )}
      <section>
        <h3 className="text-base font-medium mb-2">Top Picks</h3>
        <div className="space-y-3">
          {recs.results.map((r) => {
            const spec = (r.activity as any).openHoursJson || undefined;
            const hoursText = weekend.days
              .map((d) => {
                const wd = new Date(d.date + "T00:00:00").getDay();
                const txt = getHoursForWeekday(spec, wd) ?? "Closed";
                return `${weekdayShortName(wd)}: ${txt}`;
              })
              .join(" • ");
            return (
              <ActivityCard
                key={r.activity.id}
                activity={{
                  id: r.activity.id,
                  name: r.activity.name,
                  type: r.activity.type,
                  costTier: r.activity.costTier ?? null,
                  description: r.activity.description ?? null,
                }}
                reasons={r.reasons}
                distanceMi={r.distanceMi}
                driveMinutes={(r as any).driveMinutes}
                hoursText={hoursText}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
