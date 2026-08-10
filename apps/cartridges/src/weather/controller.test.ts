import { describe, expect, it, vi } from 'vitest';
import fixture from '../../fixtures/open-meteo.fixture.json';
import { createDeterministicWeatherSummary, createWeatherExtractionRequest, executeWeatherCommand, groundWeatherIntent, parseGroundedWeatherSummary, parseWeatherFetchCommand } from './controller';

const commandRaw = JSON.stringify({ action: 'fetch_weather', request: { location: 'Washington, DC', startDate: '2026-07-28', endDate: '2026-07-29', units: 'imperial', intent: 'umbrella' } });

describe('Weather production controller', () => {
  it('parses only a validated fetch command', () => {
    expect(createWeatherExtractionRequest('Will I need an umbrella?', '2026-07-28', 'imperial').messages).toHaveLength(2);
    expect(parseWeatherFetchCommand(commandRaw).request.location).toBe('Washington, DC');
    expect(() => parseWeatherFetchCommand('{"action":"answer","weather":"sunny"}')).toThrow('fetch_weather');
  });

  it('grounds practical intent in the actual question instead of model-invented intent', () => {
    const parsed = parseWeatherFetchCommand(commandRaw);
    expect(groundWeatherIntent(parsed, 'What is the weather today in New York?').request.intent).toBe('general');
    expect(groundWeatherIntent(parsed, 'Will I need an umbrella tomorrow?').request.intent).toBe('umbrella');
    expect(groundWeatherIntent(parsed, 'What should I wear tomorrow?').request.intent).toBe('clothing');
  });

  it('executes the browser-owned tool and builds a normalized-only summary prompt', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(fixture.geocoding), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(fixture.forecast), { status: 200 }));
    const result = await executeWeatherCommand(parseWeatherFetchCommand(commandRaw), fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.messages[1]!.content).toContain('precipitationProbabilityMax');
    expect(result.forecast.provider).toBe('Open-Meteo');
  });

  it('accepts exact tool-grounded facts and rejects changed or missing facts', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(fixture.geocoding), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(fixture.forecast), { status: 200 }));
    const { forecast } = await executeWeatherCommand(parseWeatherFetchCommand(commandRaw), fetcher);
    const model = { location: 'Washington', overview: 'Rain is possible across the period.', practicalAdvice: 'Consider an umbrella.',
      days: forecast.days.map((day) => ({ ...day, summary: 'Provider forecast day.' })), attribution: 'Weather data by Open-Meteo.com' };
    expect(parseGroundedWeatherSummary(JSON.stringify(model), forecast).days).toEqual(model.days);
    model.days[0]!.temperatureMax = 999;
    expect(() => parseGroundedWeatherSummary(JSON.stringify(model), forecast)).toThrow('not tool-grounded');
    expect(() => parseGroundedWeatherSummary(JSON.stringify({ ...model, days: [] }), forecast)).toThrow('every and only');
  });

  it('has no hallucinated fallback when the provider fails', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 503 }));
    await expect(executeWeatherCommand(parseWeatherFetchCommand(commandRaw), fetcher)).rejects.toThrow('Location lookup failed');
  });

  it('renders the supplied New York provider payload without model prose', () => {
    const request = { location: 'New York, New York', startDate: '2026-07-28', endDate: '2026-07-28', units: 'imperial', intent: 'general' } as const;
    const forecast = {
      requestedLocation: request.location, resolvedName: 'New York', country: 'United States', latitude: 40.710335, longitude: -73.99308,
      timezone: 'America/New_York', units: request.units, provider: 'Open-Meteo' as const,
      days: [{ date: '2026-07-28', weatherCode: 3, temperatureMax: 80, temperatureMin: 69.7, precipitationProbabilityMax: 72 }],
      attribution: { text: 'Weather data by Open-Meteo.com' as const, url: 'https://open-meteo.com/' as const, license: 'CC BY 4.0' as const, modified: true as const },
    };
    expect(createDeterministicWeatherSummary(request, forecast)).toMatchObject({
      location: 'New York',
      overview: expect.stringContaining('2026-07-28'),
      days: [{ date: '2026-07-28', weatherCode: 3, temperatureMax: 80, temperatureMin: 69.7, precipitationProbabilityMax: 72, summary: 'Cloudy' }],
      practicalAdvice: expect.stringContaining('umbrella'),
    });
  });
});
