import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  formatLogDatetime,
  RequestLogService,
} from './request-log.service';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly skipPrefixes: string[];

  constructor(
    private readonly requestLog: RequestLogService,
    private readonly config: ConfigService,
  ) {
    const raw = this.config.get<string>('LOG_SKIP_PATH_PREFIXES', '');
    this.skipPrefixes = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.requestLog.isEnabled()) {
      return next.handle();
    }

    if (context.getType() !== 'http') {
      return next.handle();
    }

    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    if (this.shouldSkip(req)) {
      return next.handle();
    }

    const started = Date.now();
    const isGet = req.method === 'GET';
    const logUrl = isGet ? undefined : this.buildUrl(req);
    const requestData = this.buildRequestData(req, isGet);

    return next.handle().pipe(
      map((body: unknown) => {
        void this.requestLog.writeHttpEntry({
          datetime: formatLogDatetime(new Date()),
          url: logUrl,
          requestData,
          responseData: {
            statusCode: res.statusCode,
            durationMs: Date.now() - started,
            body: this.normalizeBody(body),
          },
        });
        return body;
      }),
      catchError((err: unknown) => {
        void this.requestLog.writeHttpEntry({
          datetime: formatLogDatetime(new Date()),
          url: logUrl,
          requestData,
          responseData: this.buildErrorResponse(err, res, started),
        });
        return throwError(() => err);
      }),
    );
  }

  /** Client IP: `X-Forwarded-For` first hop (if behind a proxy), else `req.ip`, else socket address. */
  private resolveClientIp(req: Request): string {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length > 0) {
      const first = xff.split(',')[0]?.trim();
      if (first) return first;
    }
    if (Array.isArray(xff) && xff[0]) {
      const first = String(xff[0]).split(',')[0]?.trim();
      if (first) return first;
    }
    const fromIp = req.ip;
    if (fromIp && fromIp.length > 0) return fromIp;
    const ra = req.socket?.remoteAddress;
    if (ra) return ra;
    return '';
  }

  private buildRequestData(req: Request, isGet: boolean): Record<string, unknown> {
    const base: Record<string, unknown> = {
      ip: this.resolveClientIp(req),
      method: req.method,
      path: req.path,
      query: req.query as Record<string, unknown>,
      params: req.params as Record<string, unknown>,
      body: (req.body ?? {}) as Record<string, unknown>,
    };
    if (!isGet) {
      base.originalUrl = req.originalUrl;
      base.headers = this.pickHeaders(req);
    }
    return base;
  }

  private shouldSkip(req: Request): boolean {
    const p = req.path ?? '';
    for (const prefix of this.skipPrefixes) {
      if (p.startsWith(prefix)) return true;
    }
    return false;
  }

  private buildUrl(req: Request): string {
    const host = req.get('host') ?? 'unknown-host';
    const proto = req.protocol ?? 'http';
    return `${proto}://${host}${req.originalUrl ?? ''}`;
  }

  private pickHeaders(req: Request): Record<string, string | string[] | undefined> {
    const allow = new Set(
      (this.config.get<string>('LOG_HEADER_NAMES') ?? '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );
    if (allow.size === 0) {
      return {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent'],
      };
    }
    const out: Record<string, string | string[] | undefined> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (allow.has(k.toLowerCase())) out[k] = v;
    }
    return out;
  }

  private normalizeBody(body: unknown): unknown {
    if (body === undefined || body === null) return {};
    if (typeof body === 'object') return body as Record<string, unknown>;
    return { value: body };
  }

  private buildErrorResponse(
    err: unknown,
    res: Response,
    started: number,
  ): Record<string, unknown> {
    const statusCode =
      err instanceof HttpException
        ? err.getStatus()
        : (res.statusCode >= 400 ? res.statusCode : 500);
    let message: string | object = err instanceof Error ? err.message : String(err);
    if (err instanceof HttpException) {
      const r = err.getResponse();
      message = typeof r === 'string' ? r : { ...(typeof r === 'object' && r ? r : {}) };
    }
    return {
      statusCode,
      durationMs: Date.now() - started,
      error: message,
    };
  }
}
