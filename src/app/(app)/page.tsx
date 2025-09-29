import { getRecommendations } from "@/lib/recommend";
import { getTodayHighLow, getWeatherSummary } from "@/lib/weather";
import { ActivityCard } from "@/components/ActivityCard";
import { EventCard } from "@/components/EventCard";
import { WeatherIcon } from "@/components/WeatherIcon";
import { getEventsForNow } from "@/lib/events";

export default async function Page() {
  const [data, current, today, events] = await Promise.all([
    getRecommendations("now"),
    getWeatherSummary("now"),
    getTodayHighLow(),
    getEventsForNow(),
  ]);
  return (
    <div className="space-y-4">
      <section>
        <h2 className="text-xl font-semibold">Now</h2>
        <p className="text-sm text-gray-600">Current conditions and today’s outlook.</p>
      </section>
      <section className="rounded-lg border p-3">
        <div className="flex items-center gap-3">
          <WeatherIcon code={current.code} className="text-3xl" />
          <div>
            <div className="text-sm font-medium">Currently</div>
            <div className="text-sm text-gray-700">{Math.round(current.tempF)}°F • Wind {Math.round(current.windMph)} mph • Rain {Math.round(current.precipProb)}%</div>
          </div>
        </div>
        {today && (
          <div className="mt-2 text-sm text-gray-700">
            Today: High {Math.round(today.tempMaxF)}° / Low {Math.round(today.tempMinF)}°F • {today.summary} • Rain {Math.round(today.precipProbMax)}%
          </div>
        )}
      </section>
      {!!events.length && (
        <section className="space-y-3">
          <h3 className="text-base font-medium">Happening Soon</h3>
          <div className="space-y-3">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}
      <div className="space-y-3">
        {data.results.map((r) => (
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
            hoursText={(r as any).hoursText}
          />
        ))}
      </div>
    </div>
  );
}
