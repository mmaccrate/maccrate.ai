export type WeatherUnits = 'metric' | 'imperial';
export type WeatherIntent = 'clothing' | 'umbrella' | 'travel' | 'general';
export interface WeatherRequest { location: string; startDate: string; endDate: string; units: WeatherUnits; intent: WeatherIntent; }
export interface NormalizedForecastDay { date: string; weatherCode: number; temperatureMax: number; temperatureMin: number; precipitationProbabilityMax: number; }
export interface NormalizedForecast {
  requestedLocation: string; resolvedName: string; country?: string; latitude: number; longitude: number;
  timezone: string; units: WeatherUnits; days: NormalizedForecastDay[]; provider: 'Open-Meteo';
  attribution: { text: 'Weather data by Open-Meteo.com'; url: 'https://open-meteo.com/'; license: 'CC BY 4.0'; modified: true };
}

export const WEATHER_PRIVACY_DISCLOSURE = 'AI processing stays on-device; the requested location, coordinates, dates, and forecast fields are sent to Open-Meteo.';

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
export function validateWeatherRequest(input: unknown): WeatherRequest {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Weather request must be an object.');
  const value = input as Record<string, unknown>;
  if (typeof value.location !== 'string' || value.location.trim().length < 2 || value.location.length > 120) throw new Error('Location must be 2–120 characters.');
  const location = value.location.trim();
  if (/^(?:\.{2,}|unknown|none|null|n\/a|location)$/i.test(location) || /https?:\/\//i.test(location) || /[\u0000-\u001f]/.test(location)) throw new Error('Location must name a real place, not a placeholder or URL.');
  if (typeof value.startDate !== 'string' || !isoDate.test(value.startDate) || Number.isNaN(Date.parse(`${value.startDate}T00:00:00Z`))) throw new Error('startDate must be YYYY-MM-DD.');
  if (typeof value.endDate !== 'string' || !isoDate.test(value.endDate) || Number.isNaN(Date.parse(`${value.endDate}T00:00:00Z`))) throw new Error('endDate must be YYYY-MM-DD.');
  const start = Date.parse(`${value.startDate}T00:00:00Z`); const end = Date.parse(`${value.endDate}T00:00:00Z`);
  if (end < start || (end - start) / 86_400_000 > 14) throw new Error('Forecast range must be chronological and at most 15 days.');
  if (value.units !== 'metric' && value.units !== 'imperial') throw new Error('units must be metric or imperial.');
  if (!['clothing', 'umbrella', 'travel', 'general'].includes(String(value.intent))) throw new Error('Unsupported weather intent.');
  return { location, startDate: value.startDate, endDate: value.endDate, units: value.units, intent: value.intent as WeatherIntent };
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export async function fetchOpenMeteoForecast(raw: unknown, fetcher: FetchLike = fetch): Promise<NormalizedForecast> {
  const request = validateWeatherRequest(raw);
  type Place = { name: string; country?: string; latitude: number; longitude: number; timezone?: string };
  const candidates = [request.location];
  const beforeComma = request.location.split(',')[0]?.trim();
  if (beforeComma && beforeComma !== request.location) candidates.push(beforeComma);
  let place: Place | undefined;
  for (const name of candidates) {
    const geocode = new URL('https://geocoding-api.open-meteo.com/v1/search');
    geocode.search = new URLSearchParams({ name, count: '1', language: 'en', format: 'json' }).toString();
    const geoResponse = await fetcher(geocode);
    if (!geoResponse.ok) throw new Error(`Location lookup failed: HTTP ${geoResponse.status}`);
    const geo = await geoResponse.json() as { results?: Place[] };
    place = geo.results?.[0];
    if (place) break;
  }
  if (!place) throw new Error('Location not found.');

  const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
  const params: Record<string, string> = {
    latitude: String(place.latitude), longitude: String(place.longitude),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: place.timezone ?? 'auto', start_date: request.startDate, end_date: request.endDate,
  };
  if (request.units === 'imperial') Object.assign(params, { temperature_unit: 'fahrenheit', wind_speed_unit: 'mph', precipitation_unit: 'inch' });
  forecastUrl.search = new URLSearchParams(params).toString();
  const forecastResponse = await fetcher(forecastUrl);
  if (!forecastResponse.ok) throw new Error(`Forecast request failed: HTTP ${forecastResponse.status}`);
  const forecast = await forecastResponse.json() as { timezone?: string; daily?: { time?: string[]; weather_code?: number[]; temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_probability_max?: number[] } };
  const daily = forecast.daily;
  if (!daily?.time || !daily.weather_code || !daily.temperature_2m_max || !daily.temperature_2m_min || !daily.precipitation_probability_max) throw new Error('Forecast provider returned an incomplete daily response.');
  const days = daily.time.map((date, index) => ({ date, weatherCode: daily.weather_code![index]!, temperatureMax: daily.temperature_2m_max![index]!, temperatureMin: daily.temperature_2m_min![index]!, precipitationProbabilityMax: daily.precipitation_probability_max![index]! }));
  return {
    requestedLocation: request.location, resolvedName: place.name, country: place.country,
    latitude: place.latitude, longitude: place.longitude,
    timezone: forecast.timezone ?? place.timezone ?? 'unknown', units: request.units, days, provider: 'Open-Meteo',
    attribution: { text: 'Weather data by Open-Meteo.com', url: 'https://open-meteo.com/', license: 'CC BY 4.0', modified: true },
  };
}
