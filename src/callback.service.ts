import {
  BadRequestException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CallbackTransaction } from './entities/callback-transaction.entity';

/** Raw shape from partner JSON (camelCase + OptionalParameter3). */
export type CallbackPayload = Record<string, unknown>;

function str(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function parseOptionalInt(v: unknown): number | null {
  const s = str(v);
  if (s === null) return null;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

function parseMoney(v: unknown): string {
  const s = str(v);
  if (s === null) return '0.00';
  const n = Number(s);
  if (Number.isNaN(n)) return '0.00';
  return n.toFixed(2);
}

function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Injectable()
export class CallbackService {
  private readonly logger = new Logger(CallbackService.name);

  constructor(
    @InjectRepository(CallbackTransaction)
    private readonly repo: Repository<CallbackTransaction>,
  ) {}

  private buildEntity(row: CallbackPayload): CallbackTransaction {
    const chargeAmount = parseMoney(row.chargeAmount);
    const chargeNum = Number(chargeAmount);

    const entity = new CallbackTransaction();
    entity.serviceType = str(row.serviceType);
    entity.contentId = parseOptionalInt(row.contentId);
    entity.resultCode = parseOptionalInt(row.resultCode);
    entity.renFlag = str(row.renFlag);
    entity.requestNo = str(row.requestNo) ?? '';
    entity.logTime = new Date();
    entity.optionalParameter3 =
      str(row.OptionalParameter3) ?? str(row.optionalParameter3);
    entity.sequenceNumber =
      str(row.sequenceNumber) ?? str(row.sequenceNo);
    entity.callingParty = str(row.callingParty);
    entity.newContentId = parseOptionalInt(row.newContentId);
    entity.bearerId = str(row.bearerId);
    entity.operationId = str(row.operationId);
    entity.requestedPlan = str(row.requestedPlan);
    entity.appliededPlan = str(row.appliededPlan);
    entity.chargeAmount = chargeAmount;
    entity.serviceNode = str(row.serviceNode);
    entity.msisdn = str(row.msisdn);
    entity.serviceId = str(row.serviceId);
    entity.code = str(row.code);
    entity.keyword = str(row.keyword);
    entity.category = str(row.category);
    entity.validityDays = parseOptionalInt(row.validityDays);
    entity.result = str(row.result);
    entity.transactionId = str(row.transactionId);
    entity.notificationType = str(row.notificationType);
    entity.actionType =
      str(row.OptionalParameter3) ??
      str(row.optionalParameter3) ??
      str(row.operationId);
    entity.eventDate = todayDateString();
    entity.isChargeable = chargeNum > 0;
    return entity;
  }

  async insertFromPayloads(rows: CallbackPayload[]): Promise<{
    inserted: string[];
    errors: { requestNo: string | null; message: string }[];
  }> {
    if (!rows.length) {
      throw new BadRequestException('Payload array is empty');
    }

    const inserted: string[] = [];
    const errors: { requestNo: string | null; message: string }[] = [];

    for (const row of rows) {
      const entity = this.buildEntity(row);

      try {
        const saved = await this.repo.save(entity);
        inserted.push(saved.id);
      } catch (e) {
        this.logger.error(
          `Insert failed for requestNo=${entity.requestNo}`,
          e,
        );
        errors.push({
          requestNo: entity.requestNo || null,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }

    if (!inserted.length && errors.length) {
      throw new UnprocessableEntityException({ inserted, errors });
    }

    return { inserted, errors };
  }
}
