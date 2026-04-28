import { Controller, Get } from '@nestjs/common';

@Controller('callback')
export class CallbackController {
  @Get()
  handleCallback() {
    return { ok: true };
  }
}
