export function getHomeCoords() {
  const lat = Number(process.env.HOME_LAT);
  const lng = Number(process.env.HOME_LNG);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }
  // Fallback to Chapel Hill center
  return { lat: 35.9132, lng: -79.0558 };
}

