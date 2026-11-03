import {
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { authCookieNames, panelOf } from '../utils/panel';

function readCookie(request: { headers?: { cookie?: unknown } }, name: string): string | undefined {
  const header = request.headers?.cookie;
  if (typeof header !== 'string') return undefined;

  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      const value = rest.join('=');
      return value ? decodeURIComponent(value) : undefined;
    }
  }
  return undefined;
}

export const RefreshToken = createParamDecorator(
  (_key: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const token = readCookie(request, authCookieNames(panelOf(request)).refresh);
    return token;
  },
);
