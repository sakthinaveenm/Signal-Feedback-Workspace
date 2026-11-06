import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Public } from './auth';
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}
  @Public() @Get('live') live() { return { status: 'ok' }; }
  @Public() @Get('ready') async ready() {
    if (this.connection.readyState !== 1 || !this.connection.db) throw new ServiceUnavailableException('Database unavailable.');
    try { await this.connection.db.command({ ping: 1 }, { timeoutMS: 2000 }); }
    catch { throw new ServiceUnavailableException('Database unavailable.'); }
    return { status: 'ok', database: 'connected' };
  }
}
