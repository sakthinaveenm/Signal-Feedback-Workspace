import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

export const Public = () => SetMetadata('public', true);
export const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');
@Injectable()
export class AdminKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService, private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride('public', [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<Request>();
    const value = request.headers.authorization || '';
    const key = value.startsWith('Bearer ') ? value.slice(7) : '';
    if (!key || !timingSafeEqual(Buffer.from(hashKey(key)), Buffer.from(hashKey(this.config.getOrThrow('ADMIN_API_KEY'))))) {
      throw new UnauthorizedException('A valid admin Bearer token is required.');
    }
    return true;
  }
}
