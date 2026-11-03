import { describe, expect, it } from 'vitest';
import { parseCallTarget } from './telegram.config';

describe('parseCallTarget', () => {
  it('accepts a topic link, a plain id and id:thread', () => {
    expect(parseCallTarget('https://t.me/c/4399344660/1166')).toEqual({ chatId: '-1004399344660', threadId: 1166 });
    expect(parseCallTarget('https://t.me/c/4399344660')).toEqual({ chatId: '-1004399344660', threadId: undefined });
    expect(parseCallTarget('-1004399344660')).toEqual({ chatId: '-1004399344660', threadId: undefined });
    expect(parseCallTarget(' -1004399344660:77 ')).toEqual({ chatId: '-1004399344660', threadId: 77 });
    expect(parseCallTarget(undefined)).toEqual({ chatId: '', threadId: undefined });
  });
});
