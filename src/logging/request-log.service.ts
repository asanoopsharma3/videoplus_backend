import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, appendFile } from 'fs/promises';
import { dirname, join } from 'path';

export type HttpLogEntry = {
  datetime: string;
  /** Omitted for GET requests (not written to the log line). */
  url?: string;
  requestData: Record<string, unknown>;
  responseData: Record<string, unknown>;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** `2026-04-26 05:00:09` in local server time */
export function formatLogDatetime(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function yearMonth(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function yearMonthDay(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

@Injectable()
export class RequestLogService {
  private readonly logger = new Logger(RequestLogService.name);
  private readonly logRoot: string;
  private readonly enabled: boolean;
  private readonly maxResponseChars: number;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly config: ConfigService) {
    const dir = this.config.get<string>('LOG_DIR', 'storage/logs');
    this.logRoot = join(process.cwd(), dir);
    this.enabled = this.config.get<string>('LOG_ENABLED', 'true') !== 'false';
    this.maxResponseChars = parseInt(
      this.config.get<string>('LOG_MAX_RESPONSE_CHARS') ?? '50000',
      10,
    );
  }

  getLogRoot(): string {
    return this.logRoot;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private dayFilePath(d: Date): string {
    return join(this.logRoot, yearMonth(d), `${yearMonthDay(d)}.txt`);
  }

  private truncateIfNeeded(obj: unknown): unknown {
    try {
      const s = JSON.stringify(obj);
      if (s.length <= this.maxResponseChars) return obj;
      return {
        _truncated: true,
        length: s.length,
        preview: s.slice(0, this.maxResponseChars),
      };
    } catch {
      return { _note: 'value could not be serialized for log' };
    }
  }

  /**
   * One JSON object per line, appended under
   * `{LOG_DIR}/{YYYY-MM}/{YYYY-MM-DD}.txt` (plain text file; each line is JSON).
   * Writes are serialized so lines are not interleaved; does not block the HTTP thread.
   */
  writeHttpEntry(entry: HttpLogEntry): void {
    if (!this.enabled) return;

    const payload: Record<string, unknown> = {
      datetime: entry.datetime,
      requestData: this.truncateIfNeeded(entry.requestData),
      responseData: this.truncateIfNeeded(entry.responseData),
    };
    if (entry.url !== undefined && entry.url !== '') {
      payload.url = entry.url;
    }
    const line = JSON.stringify(payload);

    const filePath = this.dayFilePath(new Date());

    this.writeChain = this.writeChain
      .then(async () => {
        await mkdir(dirname(filePath), { recursive: true });
        await appendFile(filePath, `${line}\n`, 'utf8');
      })
      .catch((err: unknown) => {
        this.logger.error(
          `Failed to write request log: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
  }
}
