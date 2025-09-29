import { DateTime } from 'luxon';
import { CHAPEL_HILL } from '@/constants/location';
import type { EventItem } from '@/lib/events';

function formatRange(event: EventItem) {
  if (!event.startAt) return { day: '', time: event.timeText ?? '' };
  const start = DateTime.fromISO(event.startAt, { zone: CHAPEL_HILL.tz });
  const end = event.endAt ? DateTime.fromISO(event.endAt, { zone: CHAPEL_HILL.tz }) : null;
  const day = start.toFormat('ccc, MMM d');
  if (event.timeText) {
    return { day, time: event.timeText };
  }
  if (end) {
    const sameDay = start.hasSame(end, 'day');
    const endLabel = end.toFormat(sameDay ? 'h:mm a' : 'ccc h:mm a');
    return { day, time: `${start.toFormat('h:mm a')} – ${endLabel}` };
  }
  return { day, time: start.toFormat('h:mm a') };
}

export function EventCard({ event }: { event: EventItem }) {
  const { day, time } = formatRange(event);
  const costLabel = event.costText ?? (event.isFree ? 'Free' : null);

  return (
    <div className="rounded-lg border p-4 space-y-2 bg-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-medium text-gray-900">
            {event.url ? (
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {event.title}
              </a>
            ) : (
              event.title
            )}
          </h3>
          {day && (
            <div className="text-sm text-gray-700">
              <span>{day}</span>
              {time && <span className="text-gray-600"> • {time}</span>}
            </div>
          )}
          {!day && time && <div className="text-sm text-gray-700">{time}</div>}
          {event.locationText && (
            <div className="text-sm text-gray-600">{event.locationText}</div>
          )}
        </div>
        {costLabel && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            {costLabel}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Source: Triangle on the Cheap</span>
        {event.url && (
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-700 hover:underline"
          >
            View details
          </a>
        )}
      </div>
    </div>
  );
}
