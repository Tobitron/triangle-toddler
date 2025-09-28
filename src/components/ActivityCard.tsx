"use client";
import { useState } from "react";

type Activity = {
  id: number;
  name: string;
  type: string;
  costTier: number | null;
};

export function ActivityCard({
  activity,
  reasons,
  distanceMi,
  driveMinutes,
  hoursText,
}: {
  activity: Activity;
  reasons: string[];
  distanceMi: number;
  driveMinutes?: number;
  hoursText?: string | null;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function logDone() {
    try {
      setSaving(true);
      const res = await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activity_id: activity.id }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border p-4 flex items-start gap-3">
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">{activity.name}</h3>
          <span className="text-xs text-gray-500">{distanceMi.toFixed(1)} mi</span>
        </div>
        <div className="text-xs text-gray-600 mt-1">
          <span className="uppercase tracking-wide">{activity.type}</span>
          {activity.costTier === 0 && <span className="ml-2 rounded bg-green-50 text-green-700 px-1.5 py-0.5">Free</span>}
        </div>
        {/** Description if provided */}
        {(activity as any).description && (
          <p className="text-sm text-gray-700 mt-2">{(activity as any).description}</p>
        )}
        <div className="text-xs text-gray-600 mt-1">
          {typeof driveMinutes === "number" && (
            <span className="mr-2">{driveMinutes} min drive</span>
          )}
          {hoursText && <span>• {hoursText}</span>}
        </div>
        {/* Reasons intentionally hidden per user request */}
      </div>
      <button
        onClick={logDone}
        disabled={saving || saved}
        className="shrink-0 text-sm px-3 py-1.5 rounded-md bg-brand-600 text-white disabled:opacity-60"
      >
        {saved ? "Logged" : saving ? "Logging..." : "Log"}
      </button>
    </div>
  );
}
