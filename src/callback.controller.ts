import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
} from '@nestjs/common';
import { CallbackService } from './callback.service';
import {
  resolveCallbackObjectsFromPost,
  resolveCallbackObjectsFromQuery,
} from './callback-payload.util';

@Controller('callback')
export class CallbackController {
  constructor(private readonly callbackService: CallbackService) {}

  /**
   * GET — flat params and/or JSON in query (`data`, `code`, partner fragment).
   */
  @Get()
  async callbackGet(
    @Query() query: Record<string, string | string[] | undefined>,
  ) {
    const objects = resolveCallbackObjectsFromQuery(query);
    const result = await this.callbackService.insertFromPayloads(objects);
    return { ok: true, ...result };
  }

  /**
   * POST — JSON body with `code`, `sequenceNumber`, `data`, …
   * Query: `code`, `transactionId`, `notificationType` (override body).
   */
  @Post()
  @HttpCode(200)
  async callbackPost(
    @Body() body: unknown,
    @Query() query: Record<string, string | string[] | undefined>,
  ) {
    const objects = resolveCallbackObjectsFromPost(body, query);
    const result = await this.callbackService.insertFromPayloads(objects);
    return { ok: true, ...result };
  }
}
