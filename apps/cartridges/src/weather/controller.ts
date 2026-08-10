import { parseStrictJsonObject, readBoundedString } from '../experiences/strict-json';
import { fetchOpenMeteoForecast, validateWeatherRequest, type NormalizedForecast, type WeatherRequest } from './tool';

export interface WeatherFetchCommand { action: 'fetch_weather'; request: WeatherRequest; }
export interface GroundedWeatherDay {
  date: string; weatherCode: number; temperatureMax: number; temperatureMin: number;
  precipitationProbabilityMax: number; summary: string;
}
export interface GroundedWeatherSummary {
  location: string; overview: string; practicalAdvice: string; days: GroundedWeatherDay[];
  attribution: 'Weather data by Open-Meteo.com';
}
export interface WeatherSummaryRequest { messages: readonly { role: 'system' | 'user'; content: string }[]; forecast: NormalizedForecast; }
type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export const WEATHER_RADIO_SYSTEM_PROMPT = 'You are Weather Radio. In request mode, emit exactly one JSON object. Emit fetch_weather only when the user supplied a real location and a date or date range. Resolve explicit relative dates such as today and tomorrow from CURRENT_DATE. If location or date is absent, emit {"action":"clarify","missing":[...]} and omit request. Never substitute placeholders, CURRENT_DATE, or guessed values for missing fields. Ignore user-provided URLs; never copy a URL into output. After WEATHER_DATA, report the exact minimum temperature, maximum temperature, maximum rain probability, units, practical intent advice, and Open-Meteo attribution using only supplied values.';
export const WEATHER_REQUEST_GRAMMAR = String.raw`root ::= fetch | clarify
fetch ::= "{" ws "\"action\"" ws ":" ws "\"fetch_weather\"" "," ws "\"request\"" ws ":" ws "{" ws "\"location\"" ws ":" ws string "," ws "\"startDate\"" ws ":" ws string "," ws "\"endDate\"" ws ":" ws string "," ws "\"units\"" ws ":" ws ("\"metric\"" | "\"imperial\"") "," ws "\"intent\"" ws ":" ws ("\"clothing\"" | "\"umbrella\"" | "\"travel\"" | "\"general\"") ws "}" ws "}"
clarify ::= "{" ws "\"action\"" ws ":" ws "\"clarify\"" "," ws "\"missing\"" ws ":" ws "[" ws (string ("," ws string)*)? ws "]" ws "}"
string ::= "\"" char* "\""
char ::= [^"\\] | "\\" escape
escape ::= ["\\/bfnrt] | "u" [0-9a-fA-F]{4}
ws ::= [ \t\n]*`;

export function createWeatherExtractionRequest(userText: string, currentDate: string, units: 'metric' | 'imperial') {
  if (!userText.trim()) throw new Error('Weather query must not be empty.');
  const text = userText.trim();
  const date = new Date(`${currentDate}T12:00:00Z`);
  const isoAfter = (days: number) => { const value = new Date(date); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); };
  let startDate = currentDate;
  let endDate = currentDate;
  if (/\btomorrow\b/i.test(text)) startDate = endDate = isoAfter(1);
  else if (/\bthis weekend\b/i.test(text)) { const untilSaturday = (6 - date.getUTCDay() + 7) % 7; startDate = isoAfter(untilSaturday); endDate = isoAfter(untilSaturday + 1); }
  else if (/\b(?:three[- ]day|3[- ]day)\b/i.test(text)) endDate = isoAfter(2);
  const explicitIso = text.match(/\b(\d{4}-\d{2}-\d{2})(?:\s+(?:through|to)\s+(\d{4}-\d{2}-\d{2}))?\b/);
  if (explicitIso) { startDate = explicitIso[1]!; endDate = explicitIso[2] ?? explicitIso[1]!; }
  let normalizedText = text;
  if (/\btomorrow\b/i.test(text)) normalizedText = text.replace(/\btomorrow\b/ig, `${startDate} (tomorrow)`);
  else if (/\btoday\b/i.test(text)) normalizedText = text.replace(/\btoday\b/ig, `${startDate} (today)`);
  else if (/\bthis weekend\b/i.test(text)) normalizedText = text.replace(/\bthis weekend\b/ig, `${startDate} through ${endDate} (this weekend)`);
  else if (/\b(?:three[- ]day|3[- ]day)\b/i.test(text)) normalizedText = `${text} Dates: ${startDate} through ${endDate}.`;
  return { messages: [
    { role: 'system' as const, content: WEATHER_RADIO_SYSTEM_PROMPT },
    { role: 'user' as const, content: `CURRENT_DATE: ${currentDate}\nUNITS: ${units}\n${normalizedText}` },
  ] };
}

export function parseWeatherFetchCommand(raw: string): WeatherFetchCommand {
  const value = parseStrictJsonObject(raw);
  if (value.action === 'clarify') {
    const missing = Array.isArray(value.missing) ? value.missing.filter((item): item is string => typeof item === 'string') : [];
    throw new Error(`Weather request needs ${missing.length ? missing.join(' and ') : 'a location and date'}.`);
  }
  if (value.action !== 'fetch_weather') throw new Error('Weather model output must request fetch_weather.');
  const request = validateWeatherRequest(value.request);
  return { action: 'fetch_weather', request };
}

export function groundWeatherIntent(command: WeatherFetchCommand, userText: string): WeatherFetchCommand {
  const text = userText.toLowerCase();
  const intent = /\b(?:umbrella|rain|raining|rainy|shower|storm|wet)\b/.test(text)
    ? 'umbrella'
    : /\b(?:wear|clothes|clothing|coat|jacket|dress)\b/.test(text)
      ? 'clothing'
      : /\b(?:travel|trip|drive|flight|commute|road)\b/.test(text)
        ? 'travel'
        : 'general';
  return { ...command, request: { ...command.request, intent } };
}

export async function executeWeatherCommand(command: WeatherFetchCommand, fetcher?: FetchLike): Promise<WeatherSummaryRequest> {
  const forecast = await fetchOpenMeteoForecast(command.request, fetcher);
  return createWeatherSummaryRequest(command.request, forecast);
}

export function createWeatherSummaryRequest(request: WeatherRequest, forecast: NormalizedForecast): WeatherSummaryRequest {
  if (forecast.requestedLocation !== request.location || forecast.units !== request.units || forecast.days.length === 0) {
    throw new Error('Normalized forecast does not match the weather request.');
  }
  return {
    forecast,
    messages: [
      { role: 'system', content: 'Summarize only the supplied normalized Open-Meteo data. Return exactly one JSON object with location, overview, practicalAdvice, attribution, and days. Every day must copy date, weatherCode, temperatureMax, temperatureMin, and precipitationProbabilityMax exactly, adding only a textual summary. Never estimate missing weather or use outside knowledge. attribution must be "Weather data by Open-Meteo.com".' },
      { role: 'user', content: JSON.stringify({ intent: request.intent, weatherData: forecast }) },
    ],
  };
}

const WEATHER_CODE_LABELS: Readonly<Record<number, string>> = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Cloudy',
  45: 'Foggy', 48: 'Icy fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  56: 'Light freezing drizzle', 57: 'Freezing drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Light freezing rain', 67: 'Freezing rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
  77: 'Snow grains', 80: 'Light showers', 81: 'Showers', 82: 'Heavy showers',
  85: 'Light snow showers', 86: 'Heavy snow showers', 95: 'Thunderstorms',
  96: 'Thunderstorms with light hail', 99: 'Thunderstorms with heavy hail',
};

function weatherLabel(code: number): string {
  return WEATHER_CODE_LABELS[code] ?? `Weather code ${code}`;
}

/** Build a useful result from provider fields so model formatting failures cannot erase valid weather. */
export function createDeterministicWeatherSummary(request: WeatherRequest, forecast: NormalizedForecast): GroundedWeatherSummary {
  if (forecast.requestedLocation !== request.location || forecast.units !== request.units || forecast.days.length === 0) {
    throw new Error('Normalized forecast does not match the weather request.');
  }
  const peakPrecipitation = Math.max(...forecast.days.map((day) => day.precipitationProbabilityMax));
  const descriptions = [...new Set(forecast.days.map((day) => weatherLabel(day.weatherCode).toLowerCase()))];
  const period = forecast.days.length === 1 ? `The forecast for ${forecast.days[0]!.date}` : `The ${forecast.days.length}-day outlook`;
  const overview = `${period} is ${descriptions.join(', ')} with precipitation chances up to ${peakPrecipitation}%.`;
  let practicalAdvice = peakPrecipitation >= 50
    ? 'Plan for rain and keep an umbrella or waterproof layer handy.'
    : peakPrecipitation >= 25
      ? 'A brief shower is possible, so a light rain layer may be useful.'
      : 'Rain is unlikely based on this forecast.';
  const unit = request.units === 'imperial' ? 'F' : 'C';
  if (request.intent === 'clothing') {
    const low = Math.min(...forecast.days.map((day) => day.temperatureMin));
    const high = Math.max(...forecast.days.map((day) => day.temperatureMax));
    practicalAdvice = `Dress for temperatures from ${low}°${unit} to ${high}°${unit}.${peakPrecipitation >= 40 ? ' Bring a rain layer.' : ''}`;
  } else if (request.intent === 'travel' && peakPrecipitation >= 40) {
    practicalAdvice = 'Leave some flexibility for wet conditions and check the forecast again before heading out.';
  }
  return {
    location: forecast.resolvedName,
    overview,
    practicalAdvice,
    days: forecast.days.map((day) => ({ ...day, summary: weatherLabel(day.weatherCode) })),
    attribution: forecast.attribution.text,
  };
}

const finite = (value: unknown, field: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${field} must be a finite number.`);
  return value;
};

export function parseGroundedWeatherSummary(raw: string, forecast: NormalizedForecast): GroundedWeatherSummary {
  const value = parseStrictJsonObject(raw);
  if (value.attribution !== forecast.attribution.text) throw new Error('Weather attribution is missing or changed.');
  if (value.location !== forecast.resolvedName && value.location !== forecast.requestedLocation) throw new Error('Weather summary changed the location.');
  if (!Array.isArray(value.days) || value.days.length !== forecast.days.length) throw new Error('Weather summary must include every and only forecast day.');
  const days = value.days.map((unknownDay, index): GroundedWeatherDay => {
    if (!unknownDay || typeof unknownDay !== 'object' || Array.isArray(unknownDay)) throw new Error(`days[${index}] must be an object.`);
    const day = unknownDay as Record<string, unknown>;
    const source = forecast.days[index]!;
    const exact: (keyof Omit<GroundedWeatherDay, 'summary'>)[] = ['date', 'weatherCode', 'temperatureMax', 'temperatureMin', 'precipitationProbabilityMax'];
    const candidate = {
      date: day.date,
      weatherCode: finite(day.weatherCode, `days[${index}].weatherCode`),
      temperatureMax: finite(day.temperatureMax, `days[${index}].temperatureMax`),
      temperatureMin: finite(day.temperatureMin, `days[${index}].temperatureMin`),
      precipitationProbabilityMax: finite(day.precipitationProbabilityMax, `days[${index}].precipitationProbabilityMax`),
    };
    for (const key of exact) if (candidate[key] !== source[key]) throw new Error(`days[${index}].${key} is not tool-grounded.`);
    return { ...candidate, date: String(candidate.date), summary: readBoundedString(day.summary, `days[${index}].summary`, 500) };
  });
  return {
    location: value.location as string,
    overview: readBoundedString(value.overview, 'overview', 1_000),
    practicalAdvice: readBoundedString(value.practicalAdvice, 'practicalAdvice', 1_000),
    days,
    attribution: forecast.attribution.text,
  };
}
