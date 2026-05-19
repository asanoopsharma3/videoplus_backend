import { BadRequestException } from '@nestjs/common';

function isPresent(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string' && v.trim() === '') return false;
  return true;
}

export function firstQueryValue(
  v: string | string[] | undefined,
): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function tryParseJson(raw: string): unknown {
  const attempts = [raw, decodeURIComponent(raw)];
  for (const s of attempts) {
    try {
      return JSON.parse(s);
    } catch {
      /* next */
    }
  }
  return undefined;
}

/** Partner sends `code=268012...","sequenceNumber":"...", "data":{...}, ...` */
export function parseJsonFragmentFromCodeValue(
  value: string,
): Record<string, unknown> | null {
  const trimmed = value.trim();
  if (!trimmed.includes('","')) return null;

  let inner = trimmed;
  if (inner.endsWith('}')) {
    inner = inner.slice(0, -1);
  }

  try {
    const parsed = JSON.parse(`{"code":"${inner}}`);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* fall through */
  }
  return null;
}

function objectsFromParsed(parsed: unknown): Record<string, unknown>[] {
  if (Array.isArray(parsed)) {
    return parsed.filter(
      (r): r is Record<string, unknown> =>
        r !== null && typeof r === 'object' && !Array.isArray(r),
    );
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return [parsed as Record<string, unknown>];
  }
  return [];
}

function parseQueryValue(
  key: string,
  raw: string,
): Record<string, unknown>[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const parsed = tryParseJson(trimmed);
    if (parsed !== undefined) {
      const rows = objectsFromParsed(parsed);
      if (rows.length) return rows;
    }
  }

  const fragment = parseJsonFragmentFromCodeValue(trimmed);
  if (fragment) return [fragment];

  if (key === 'code' && trimmed.includes('","')) {
    const fromCode = parseJsonFragmentFromCodeValue(trimmed);
    if (fromCode) return [fromCode];
  }

  return [{ [key]: trimmed }];
}

function shallowMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...target };
  for (const [key, val] of Object.entries(source)) {
    if (isPresent(val)) {
      out[key] = val;
    }
  }
  return out;
}

/**
 * Top-level fields win; missing values are taken from nested `data`.
 */
export function normalizeCallbackRow(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const nested = row.data;
  const inner =
    nested !== null &&
    nested !== undefined &&
    typeof nested === 'object' &&
    !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : {};

  const out: Record<string, unknown> = { ...inner };
  for (const [key, val] of Object.entries(row)) {
    if (key === 'data') continue;
    if (isPresent(val)) {
      out[key] = val;
    }
  }
  return out;
}

/**
 * GET only — merge flat query params and JSON embedded in any query value
 * (including partner `code=...","sequenceNumber":"...", "data":{...}` format).
 */
export function resolveCallbackObjectsFromQuery(
  query: Record<string, string | string[] | undefined>,
): Record<string, unknown>[] {
  let merged: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(query)) {
    const s = firstQueryValue(val);
    if (!s) continue;

    const parts = parseQueryValue(key, s);
    for (const part of parts) {
      merged = shallowMerge(merged, part);
    }
  }

  if (!Object.keys(merged).length) {
    throw new BadRequestException(
      'Provide query parameters (flat and/or JSON in any param, e.g. code or data).',
    );
  }

  const normalized = normalizeCallbackRow(merged);
  if (!isPresent(normalized.requestNo)) {
    throw new BadRequestException('requestNo is required (query or data.requestNo).');
  }

  return [normalized];
}

const POST_QUERY_OVERLAY_KEYS = [
  'code',
  'transactionId',
  'notificationType',
] as const;

function parseBodyToObjects(body: unknown): Record<string, unknown>[] {
  if (typeof body === 'string') {
    const trimmed = body.trim();
    if (!trimmed) return [];
    const parsed = tryParseJson(trimmed);
    if (parsed === undefined) {
      throw new BadRequestException('Invalid JSON body.');
    }
    return objectsFromParsed(parsed);
  }
  return objectsFromParsed(body);
}

/**
 * POST — JSON body (`code`, `sequenceNumber`, `data`, …) with optional query
 * overlay for `code`, `transactionId`, and `notificationType` (query wins).
 */
export function resolveCallbackObjectsFromPost(
  body: unknown,
  query: Record<string, string | string[] | undefined>,
): Record<string, unknown>[] {
  const rows = parseBodyToObjects(body);
  if (!rows.length) {
    throw new BadRequestException(
      'Provide a JSON body with code, sequenceNumber, and data.',
    );
  }

  const overlay: Record<string, unknown> = {};
  for (const key of POST_QUERY_OVERLAY_KEYS) {
    const s = firstQueryValue(query[key]);
    if (s) overlay[key] = s;
  }

  const normalized = rows.map((row) =>
    normalizeCallbackRow(shallowMerge(row, overlay)),
  );

  for (const row of normalized) {
    if (!isPresent(row.requestNo)) {
      throw new BadRequestException(
        'requestNo is required (body data.requestNo).',
      );
    }
  }

  return normalized;
}
