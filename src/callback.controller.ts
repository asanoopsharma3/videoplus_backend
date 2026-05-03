import {
  BadRequestException,
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import { CallbackService } from './callback.service';

/** Not merged as row fields; only used as JSON blob. */
const JSON_BLOB_KEYS = new Set(['data', 'requestedData']);

function firstQueryValue(
  v: string | string[] | undefined,
): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function payloadFromFlatQuery(
  query: Record<string, string | string[] | undefined>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(query)) {
    if (JSON_BLOB_KEYS.has(key)) continue;
    const s = firstQueryValue(val);
    if (s !== undefined && s !== '') {
      payload[key] = s;
    }
  }
  return payload;
}

function parseJsonToObjectRows(raw: string): Record<string, unknown>[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    try {
      parsed = JSON.parse(decodeURIComponent(raw));
    } catch {
      throw new BadRequestException(
        'Invalid JSON in "data" or "requestedData".',
      );
    }
  }

  const rows = Array.isArray(parsed) ? parsed : [parsed];
  const objects = rows.filter(
    (r): r is Record<string, unknown> =>
      r !== null && typeof r === 'object' && !Array.isArray(r),
  );
  if (objects.length !== rows.length) {
    throw new BadRequestException(
      'Expected a JSON object or a JSON array of objects.',
    );
  }
  return objects;
}

@Controller('callback')
export class CallbackController {
  constructor(private readonly callbackService: CallbackService) {}

  /**
   * GET callback supports, alone or **combined**:
   * - JSON in `data` or `requestedData` (object or array of objects).
   * - Flat query params (same field names as JSON).
   * When both are present, each JSON row is merged with all flat params; **query values win** on duplicate keys.
   */
  @Get()
  async callback(@Query() query: Record<string, string | string[] | undefined>) {
    const flatQuery = payloadFromFlatQuery(query);
    const rawJson = (
      firstQueryValue(query.data) ?? firstQueryValue(query.requestedData)
    )?.trim();

    let jsonRows: Record<string, unknown>[] | null = null;
    if (rawJson && (rawJson.startsWith('[') || rawJson.startsWith('{'))) {
      jsonRows = parseJsonToObjectRows(rawJson);
    }

    let objects: Record<string, unknown>[];

    if (jsonRows !== null && jsonRows.length > 0) {
      objects = jsonRows.map((row) => ({ ...row, ...flatQuery }));
    } else if (Object.keys(flatQuery).length > 0) {
      objects = [flatQuery];
    } else if (jsonRows !== null && jsonRows.length === 0) {
      throw new BadRequestException(
        'JSON array is empty; add row objects and/or flat query parameters.',
      );
    } else if (rawJson) {
      throw new BadRequestException(
        '"data" / "requestedData" must begin with "{" or "[" to be parsed as JSON.',
      );
    } else {
      throw new BadRequestException(
        'Provide flat query parameters and/or JSON in "data" or "requestedData".',
      );
    }

    const result = await this.callbackService.insertFromPayloads(objects);
    return { ok: true, ...result };
  }
}
