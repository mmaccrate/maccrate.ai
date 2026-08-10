export function parseStrictJsonObject(raw: string): Record<string, unknown> {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('Model output is empty.');
  let text = raw.trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) text = fenced[1]!.trim();

  const start = text.indexOf('{');
  if (start < 0) throw new Error('Model output does not contain a JSON object.');
  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}' && --depth === 0) { end = index + 1; break; }
  }
  if (end < 0) throw new Error('Model output contains incomplete JSON.');
  if (text.slice(0, start).trim() || text.slice(end).trim()) throw new Error('Model output must contain exactly one JSON object.');
  let parsed: unknown;
  try { parsed = JSON.parse(text.slice(start, end)); } catch { throw new Error('Model output contains invalid JSON.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Model output must be a JSON object.');
  return parsed as Record<string, unknown>;
}

export function readBoundedString(value: unknown, field: string, maxLength = 2_000): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`);
  const result = value.trim();
  if (!result) throw new Error(`${field} must not be empty.`);
  if (result.length > maxLength) throw new Error(`${field} exceeds ${maxLength} characters.`);
  return result;
}
