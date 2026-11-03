import { Injectable } from '@nestjs/common';
import type { CircuitBreaker } from '../../common/utils/circuit-breaker';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  private readonly httpDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP so‘rovlarining davomiyligi',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  private readonly queueDepth = new Gauge({
    name: 'queue_depth',
    help: 'Navbatdagi kutayotgan joblar soni',
    labelNames: ['queue'] as const,
    registers: [this.registry],
  });

  private readonly otpAbuse = new Counter({
    name: 'otp_abuse_total',
    help: 'OTP limitlariga urilgan so‘rovlar soni',
    labelNames: ['reason'] as const,
    registers: [this.registry],
  });

  private readonly orderTransitions = new Counter({
    name: 'order_status_transition_total',
    help: 'Buyurtma holati o‘zgarishlari soni',
    labelNames: ['from', 'to'] as const,
    registers: [this.registry],
  });

  private readonly paymentFailures = new Counter({
    name: 'payment_failure_total',
    help: 'Muvaffaqiyatsiz to‘lovlar soni',
    labelNames: ['provider'] as const,
    registers: [this.registry],
  });

  private readonly providerCalls = new Counter({
    name: 'provider_requests_total',
    help: 'Tashqi xizmatlarga so‘rovlar (outcome: success | failure | circuit_open)',
    labelNames: ['provider', 'outcome'] as const,
    registers: [this.registry],
  });

  private readonly breakers = new Map<string, CircuitBreaker>();

  constructor() {
    // 0 = CLOSED, 1 = HALF_OPEN, 2 = OPEN: scrape paytida har bir breaker'ning haqiqiy holati o‘qiladi.
    const breakers = this.breakers;
    new Gauge({
      name: 'circuit_breaker_state',
      help: 'Circuit breaker holati: 0 yopiq (normal), 1 yarim ochiq, 2 ochiq',
      labelNames: ['provider'] as const,
      registers: [this.registry],
      collect() {
        this.reset();
        for (const [provider, breaker] of breakers) {
          const state = breaker.getState();
          this.set({ provider }, state === 'OPEN' ? 2 : state === 'HALF_OPEN' ? 1 : 0);
        }
      },
    });
    collectDefaultMetrics({ register: this.registry });
  }

  observeHttp(method: string, route: string, status: number, seconds: number): void {
    this.httpDuration.observe({ method, route, status: String(status) }, seconds);
  }

  setQueueDepth(queue: string, depth: number): void {
    this.queueDepth.set({ queue }, depth);
  }

  otpAbused(reason: string): void {
    this.otpAbuse.inc({ reason });
  }

  orderTransitioned(from: string | null, to: string): void {
    this.orderTransitions.inc({ from: from ?? 'NONE', to });
  }

  paymentFailed(provider: string): void {
    this.paymentFailures.inc({ provider });
  }

  /** Breaker holatini `circuit_breaker_state` gauge'iga ulaydi. */
  registerBreaker(provider: string, breaker: CircuitBreaker): void {
    this.breakers.set(provider, breaker);
  }

  providerCall(provider: string, outcome: 'success' | 'failure' | 'circuit_open'): void {
    this.providerCalls.inc({ provider, outcome });
  }
}
