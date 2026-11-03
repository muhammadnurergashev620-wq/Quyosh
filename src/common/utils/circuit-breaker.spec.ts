import { describe, expect, it } from 'vitest';
import { CircuitBreaker, CircuitBreakerOpenError } from './circuit-breaker';

const fail = () => Promise.reject(new Error('down'));

describe('CircuitBreaker', () => {
  it('trips OPEN after the failure threshold and refuses calls without invoking them', async () => {
    let time = 0;
    const breaker = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 }, () => time);
    for (let i = 0; i < 3; i += 1) await expect(breaker.execute(fail)).rejects.toThrow('down');
    expect(breaker.getState()).toBe('OPEN');
    let called = false;
    await expect(breaker.execute(async () => { called = true; })).rejects.toBeInstanceOf(CircuitBreakerOpenError);
    expect(called).toBe(false);
  });

  it('a success resets the failure count', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 1000 });
    await expect(breaker.execute(fail)).rejects.toThrow();
    await breaker.execute(async () => 'ok');
    await expect(breaker.execute(fail)).rejects.toThrow();
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('goes HALF_OPEN after the timeout; a success closes it, a failure re-opens it', async () => {
    let time = 0;
    const breaker = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 1000 }, () => time);
    await expect(breaker.execute(fail)).rejects.toThrow();
    expect(breaker.getState()).toBe('OPEN');
    time = 1000;
    expect(breaker.getState()).toBe('HALF_OPEN');
    await expect(breaker.execute(fail)).rejects.toThrow('down');
    expect(breaker.getState()).toBe('OPEN');
    time = 2000;
    await breaker.execute(async () => 'ok');
    expect(breaker.getState()).toBe('CLOSED');
  });
});
