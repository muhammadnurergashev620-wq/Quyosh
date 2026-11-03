/**
 * Tashqi xizmat (OSRM, Yandex/OSM geokoder va h.k.) ishdan chiqqanda har bir so‘rov uni bosib tashlamasligi uchun.
 * Holatlar: CLOSED (normal) → OPEN (ketma-ket xatolar chegaradan oshdi: so‘rov yuborilmaydi) → HALF_OPEN (kutish
 * tugadi: keyingi natija holatni hal qiladi). Soddalashtirilgan: HALF_OPEN'da barcha chaqiruvlar o‘tkaziladi.
 */
export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** CLOSED'dan OPEN'ga o‘tish uchun ketma-ket xatolar soni. */
  readonly failureThreshold: number;
  /** OPEN holatda qancha kutilgach HALF_OPEN sinovga ruxsat beriladi. */
  readonly resetTimeoutMs: number;
}

/** Breaker OPEN bo‘lganda, tashqi xizmatga umuman murojaat qilinmasdan tashlanadi. */
export class CircuitBreakerOpenError extends Error {
  constructor(message = 'Tashqi xizmat vaqtincha o‘chirilgan (circuit breaker ochiq).') {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class CircuitBreaker {
  private rawState: CircuitBreakerState = 'CLOSED';
  private consecutiveFailures = 0;
  private openedAt: number | null = null;

  constructor(
    private readonly options: CircuitBreakerOptions,
    private readonly now: () => number = Date.now,
  ) {}

  /** Joriy holat: kutish muddati tugagan OPEN o‘qilganda HALF_OPEN deb hisoblanadi. */
  getState(): CircuitBreakerState {
    if (this.rawState === 'OPEN' && this.openedAt !== null && this.now() - this.openedAt >= this.options.resetTimeoutMs) {
      this.rawState = 'HALF_OPEN';
    }
    return this.rawState;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.getState() === 'OPEN') throw new CircuitBreakerOpenError();
    try {
      const result = await fn();
      this.rawState = 'CLOSED';
      this.consecutiveFailures = 0;
      this.openedAt = null;
      return result;
    } catch (error) {
      this.consecutiveFailures += 1;
      // HALF_OPEN'dagi bitta xato ham darhol qayta OPEN qiladi.
      if (this.rawState === 'HALF_OPEN' || this.consecutiveFailures >= this.options.failureThreshold) {
        this.rawState = 'OPEN';
        this.openedAt = this.now();
      }
      throw error;
    }
  }
}
