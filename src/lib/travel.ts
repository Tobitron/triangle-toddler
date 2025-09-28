import { getHomeCoords } from "@/lib/config";

export async function getDriveSeconds(dest: { lat: number; lng: number }): Promise<number> {
  const origin = getHomeCoords();
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=false`;
    const res = await fetch(url, { next: { revalidate: 60 * 60 } });
    const data = await res.json();
    const sec = data?.routes?.[0]?.duration;
    if (typeof sec === "number" && Number.isFinite(sec)) return Math.round(sec);
  } catch {}
  // Fallback: straight-line at 28 mph average
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(dest.lat - origin.lat);
  const dLon = toRad(dest.lng - origin.lng);
  const lat1 = toRad(origin.lat);
  const lat2 = toRad(dest.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const miles = 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  const hours = miles / 28; // average mixed traffic in town
  return Math.round(hours * 3600);
}

