import { getRecommendations } from "@/lib/recommend";
import { ActivityCard } from "@/components/ActivityCard";
import { EventCard } from "@/components/EventCard";
import { getEventsForLater } from "@/lib/events";

export default async function LaterPage() {
  const [data, events] = await Promise.all([
    getRecommendations("later"),
    getEventsForLater(),
  ]);
  return (
    <div className="space-y-4">
      <section>
        <h2 className="text-xl font-semibold">Later</h2>
        <p className="text-sm text-gray-600">Plan ahead for later today or the weekend.</p>
      </section>
      {!!events.length && (
        <section className="space-y-3">
          <h3 className="text-base font-medium">Upcoming Events</h3>
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
          />
        ))}
      </div>
    </div>
  );
}
