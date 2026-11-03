import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request & { id?: string }, res: Response, next: NextFunction) { const header = req.headers['x-request-id']; const incoming = typeof header === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(header) ? header : randomUUID(); req.id = incoming; res.setHeader('x-request-id', incoming); next(); }
}
