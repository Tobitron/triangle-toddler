export function WeatherIcon({ code, label, className = "text-2xl" }: { code?: number; label?: string; className?: string }) {
  // Map Open-Meteo codes or NWS labels to a simple emoji icon for v1
  const fromCode = (c: number) => {
    if ([95, 96, 99].includes(c)) return "⛈️"; // thunderstorm
    if ([66, 67].includes(c)) return "🌧️"; // freezing rain
    if ([61, 63, 65, 80, 81, 82].includes(c)) return "🌧️"; // rain
    if ([51, 53, 55].includes(c)) return "🌦️"; // drizzle
    if ([71, 73, 75, 77, 85, 86].includes(c)) return "🌨️"; // snow
    if ([45, 48].includes(c)) return "🌫️"; // fog
    if (c === 0 || c === 1) return "☀️"; // clear/mainly clear
    if (c === 2) return "🌤️"; // partly cloudy
    if (c === 3) return "☁️"; // overcast
    return "🌥️";
  };
  const fromLabel = (s: string) => {
    const t = s.toLowerCase();
    if (/(thunder|storm)/.test(t)) return "⛈️";
    if (/(snow|flurr)/.test(t)) return "🌨️";
    if (/(rain|showers|drizzle)/.test(t)) return "🌧️";
    if (/(fog|mist|haze)/.test(t)) return "🌫️";
    if (/(clear|sunny)/.test(t)) return "☀️";
    if (/partly/.test(t)) return "🌤️";
    if (/(overcast|cloud)/.test(t)) return "☁️";
    return "🌥️";
  };
  const icon = typeof code === "number" ? fromCode(code) : label ? fromLabel(label) : "🌥️";
  return <span className={className} aria-hidden>{icon}</span>;
}
