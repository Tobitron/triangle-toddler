import { supaServer } from "@/lib/supabase";

export default async function HistoryPage() {
  // Try snake_case then PascalCase
  let logsRes = await supaServer
    .from("activity_logs")
    .select("id, activity_id, started_at, notes")
    .order("started_at", { ascending: false })
    .limit(20);
  if (logsRes.error) {
    logsRes = await supaServer
      .from("ActivityLog")
      .select("id, activityId, startedAt, notes")
      .order("startedAt", { ascending: false })
      .limit(20);
  }
  const logs = logsRes.data ?? [];
  const activityIds = Array.from(new Set((logs ?? []).map((l: any) => l.activity_id ?? l.activityId)));
  let actsRes = activityIds.length
    ? await supaServer.from("activities").select("id, name").in("id", activityIds)
    : { data: [] as any[] };
  if ((actsRes as any).error) {
    actsRes = activityIds.length
      ? await supaServer.from("Activity").select("id, name").in("id", activityIds)
      : { data: [] as any[] };
  }
  const acts = (actsRes as any).data ?? [];
  const nameById = new Map((acts ?? []).map((a: any) => [a.id, a.name]));

  return (
    <div className="space-y-4">
      <section>
        <h2 className="text-xl font-semibold">History</h2>
        <p className="text-sm text-gray-600">Your recent activities.</p>
      </section>
      {!logs || logs.length === 0 ? (
        <div className="text-gray-500 text-sm">No logs yet.</div>
      ) : (
        <ul className="space-y-2">
          {logs.map((log: any) => (
            <li key={log.id} className="rounded border p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">{nameById.get(log.activity_id ?? log.activityId) ?? "Activity"}</div>
                <div className="text-xs text-gray-500">{new Date(log.started_at ?? log.startedAt).toLocaleString()}</div>
              </div>
              {log.notes ? <div className="text-sm text-gray-700 mt-1">{String(log.notes)}</div> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
