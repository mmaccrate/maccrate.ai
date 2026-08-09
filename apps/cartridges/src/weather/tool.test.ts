import { describe, expect, it, vi } from 'vitest';
import fixture from '../../fixtures/open-meteo.fixture.json';
import { fetchOpenMeteoForecast, validateWeatherRequest } from './tool';

const request = { location: 'Washington, DC', startDate: '2026-07-28', endDate: '2026-07-29', units: 'imperial', intent: 'umbrella' } as const;

describe('Weather Radio browser-owned tool', () => {
  it('validates the fixed structured request', () => expect(validateWeatherRequest(request)).toEqual(request));
  it.each([
    [{ ...request, location: '' }, /Location/],
    [{ ...request, location: '...' }, /placeholder or URL/],
    [{ ...request, location: 'https:\/\/evil.example' }, /placeholder or URL/],
    [{ ...request, startDate: 'tomorrow' }, /startDate/],
    [{ ...request, endDate: '2026-08-20' }, /15 days/],
    [{ ...request, units: 'kelvin' }, /units/],
    [{ ...request, intent: 'anything' }, /intent/],
  ])('rejects malformed requests', (value, message) => expect(() => validateWeatherRequest(value)).toThrow(message));

  it('normalizes provider responses and never exposes the raw payload', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(fixture.geocoding), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(fixture.forecast), { status: 200 }));
    const result = await fetchOpenMeteoForecast(request, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[0]![0])).toContain('geocoding-api.open-meteo.com');
    expect(String(fetcher.mock.calls[1]![0])).toContain('api.open-meteo.com');
    expect(result).toEqual({
      requestedLocation: 'Washington, DC', resolvedName: 'Washington', country: 'United States',
      latitude: 38.8951, longitude: -77.0364, timezone: 'America/New_York', units: 'imperial', provider: 'Open-Meteo',
      days: [
        { date: '2026-07-28', weatherCode: 61, temperatureMax: 82, temperatureMin: 70, precipitationProbabilityMax: 70 },
        { date: '2026-07-29', weatherCode: 2, temperatureMax: 85, temperatureMin: 71, precipitationProbabilityMax: 20 },
      ],
      attribution: { text: 'Weather data by Open-Meteo.com', url: 'https://open-meteo.com/', license: 'CC BY 4.0', modified: true },
    });
    expect(result).not.toHaveProperty('daily');
  });

  it('retries a comma-qualified place when the provider only recognizes its city name', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(fixture.geocoding), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(fixture.forecast), { status: 200 }));
    const result = await fetchOpenMeteoForecast(request, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(new URL(String(fetcher.mock.calls[0]![0])).searchParams.get('name')).toBe('Washington, DC');
    expect(new URL(String(fetcher.mock.calls[1]![0])).searchParams.get('name')).toBe('Washington');
    expect(result.requestedLocation).toBe('Washington, DC');
    expect(result.resolvedName).toBe('Washington');
  });

  it('surfaces provider errors without inventing weather', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 503 }));
    await expect(fetchOpenMeteoForecast(request, fetcher)).rejects.toThrow('Location lookup failed: HTTP 503');
  });
});
