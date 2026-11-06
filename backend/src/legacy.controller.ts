import { BadRequestException, Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { SignalService } from './signal.service';
import { CreateProjectDto, CreateFeedbackDto, UpdateFeedbackDto } from './dto';
import { isUUID } from 'class-validator';

@Controller('data')
export class LegacyController {
  constructor(private readonly signal: SignalService) {}
  @Get() get() { return this.signal.workspace(); }
  @Post() @HttpCode(200)
  async mutate(@Body() raw: unknown) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BadRequestException('Expected an object.');
    const { action, id, ...data } = raw as Record<string, unknown>;
    if (action === 'project') await this.signal.createProject(await this.valid(CreateProjectDto, data));
    else if (action === 'report') await this.signal.createFeedback(await this.valid(CreateFeedbackDto, data));
    else if (action === 'update') {
      this.assertId(id);
      await this.signal.updateFeedback(id, await this.valid(UpdateFeedbackDto, data));
    } else if (action === 'delete') {
      this.assertId(id);
      if (Object.keys(data).length) throw new BadRequestException('Unexpected delete fields.');
      await this.signal.deleteFeedback(id);
    } else throw new BadRequestException('Unknown action.');
    return { ok: true };
  }
  private assertId(id: unknown): asserts id is string {
    if (typeof id !== 'string' || !isUUID(id, '4')) throw new BadRequestException('A valid UUID is required.');
  }
  private async valid<T extends object>(type: new () => T, data: object): Promise<T> {
    const dto = plainToInstance(type, data);
    try { await validateOrReject(dto, { whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true }); }
    catch { throw new BadRequestException('Invalid fields for this action.'); }
    return dto;
  }
}
