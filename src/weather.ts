import type { Coords } from "./types.ts";

export function mapWeatherCode(code: number): string {
  if (code === 0) return "clear";
  if (code >= 1 && code <= 3) return "overcast";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "light rain";
  if (code === 61) return "light rain";
  if (code >= 63 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "showers";
  if (code >= 85 && code <= 86) return "snow showers";
  if (code >= 95 && code <= 99) return "thunderstorm";
  return "clear";
}

export function formatWeather(code: number, tempC: number): string {
  const desc = mapWeatherCode(code);
  const t = Math.round(tempC);
  return `${desc}, ${t}°C`;
}

interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    weather_code: number;
    precipitation: number;
  };
}

export async function fetchWeather(coords: Coords): Promise<string | null> {
  const [lon, lat] = coords;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weather_code,precipitation`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as OpenMeteoResponse;
    return formatWeather(data.current.weather_code, data.current.temperature_2m);
  } catch {
    return null;
  }
}
