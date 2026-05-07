import {
  BadRequestException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
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

  /** Copies payload-built fields onto an existing row (preserves id and createdAt). */
  private copyMutableFields(
    from: CallbackTransaction,
    to: CallbackTransaction,
  ): void {
    to.serviceType = from.serviceType;
    to.contentId = from.contentId;
    to.resultCode = from.resultCode;
    to.renFlag = from.renFlag;
    to.requestNo = from.requestNo;
    to.logTime = from.logTime;
    to.optionalParameter3 = from.optionalParameter3;
    to.sequenceNo = from.sequenceNo;
    to.callingParty = from.callingParty;
    to.newContentId = from.newContentId;
    to.bearerId = from.bearerId;
    to.operationId = from.operationId;
    to.requestedPlan = from.requestedPlan;
    to.appliededPlan = from.appliededPlan;
    to.chargeAmount = from.chargeAmount;
    to.serviceNode = from.serviceNode;
    to.msisdn = from.msisdn;
    to.serviceId = from.serviceId;
    to.keyword = from.keyword;
    to.category = from.category;
    to.validityDays = from.validityDays;
    to.status = from.status;
    to.actionType = from.actionType;
    to.eventDate = from.eventDate;
    to.isChargeable = from.isChargeable;
  }

  private buildEntity(
    row: CallbackPayload,
  ):
    | { ok: true; entity: CallbackTransaction }
    | { ok: false; error: string } {
    const requestNo = str(row.requestNo);
    if (!requestNo) {
      return { ok: false, error: 'requestNo is required' };
    }

    const chargeAmount = parseMoney(row.chargeAmount);
    const chargeNum = Number(chargeAmount);

    const entity = new CallbackTransaction();
    entity.serviceType = str(row.serviceType);
    entity.contentId = parseOptionalInt(row.contentId);
    entity.resultCode = parseOptionalInt(row.resultCode);
    entity.renFlag = str(row.renFlag);
    entity.requestNo = requestNo;
    entity.logTime = new Date();
    entity.optionalParameter3 =
      str(row.OptionalParameter3) ?? str(row.optionalParameter3);
    entity.sequenceNo = str(row.sequenceNo);
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
    entity.keyword = str(row.keyword);
    entity.category = str(row.category);
    entity.validityDays = parseOptionalInt(row.validityDays);
    entity.status = str(row.result) ?? str(row.status);
    entity.actionType =
      str(row.OptionalParameter3) ??
      str(row.optionalParameter3) ??
      str(row.operationId);
    entity.eventDate = todayDateString();
    entity.isChargeable = chargeNum > 0;
    return { ok: true, entity };
  }

  async insertFromPayloads(rows: CallbackPayload[]): Promise<{
    inserted: string[];
    updated: string[];
    duplicates: string[];
    errors: { requestNo: string | null; message: string }[];
  }> {
    if (!rows.length) {
      throw new BadRequestException('Payload array is empty');
    }

    const inserted: string[] = [];
    const updated: string[] = [];
    const duplicates: string[] = [];
    const errors: { requestNo: string | null; message: string }[] = [];

    for (const row of rows) {
      const built = this.buildEntity(row);
      if (!built.ok) {
        errors.push({ requestNo: str(row.requestNo), message: built.error });
        continue;
      }
      const entity = built.entity;

      const serviceId = entity.serviceId;
      const msisdn = entity.msisdn;
      if (serviceId && msisdn) {
        const existing = await this.repo.findOne({
          where: { serviceId, msisdn },
          order: { id: 'DESC' },
        });
        if (existing) {
          try {
            this.copyMutableFields(entity, existing);
            const saved = await this.repo.save(existing);
            updated.push(saved.id);
          } catch (e) {
            this.logger.error(
              `Update failed for requestNo=${entity.requestNo} serviceId=${entity.serviceId} msisdn=${entity.msisdn}`,
              e,
            );
            errors.push({
              requestNo: entity.requestNo,
              message: e instanceof Error ? e.message : String(e),
            });
          }
          continue;
        }
      }

      try {
        const saved = await this.repo.save(entity);
        inserted.push(saved.id);
      } catch (e) {
        const pgCode =
          e instanceof QueryFailedError
            ? (
                e as QueryFailedError & {
                  driverError?: { code?: string };
                  code?: string;
                }
              ).driverError?.code ?? (e as { code?: string }).code
            : undefined;
        if (pgCode === '23505') {
          duplicates.push(entity.requestNo);
          this.logger.warn(`Duplicate requestNo skipped: ${entity.requestNo}`);
        } else {
          this.logger.error(
            `Insert failed for requestNo=${entity.requestNo}`,
            e,
          );
          errors.push({
            requestNo: entity.requestNo,
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }

    if (
      !inserted.length &&
      !updated.length &&
      !duplicates.length &&
      errors.length
    ) {
      throw new UnprocessableEntityException({
        inserted,
        updated,
        duplicates,
        errors,
      });
    }

    return { inserted, updated, duplicates, errors };
  }
}
