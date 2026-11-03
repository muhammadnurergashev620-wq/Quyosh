import { apiPostKeepalive } from '@/services/api.client';

type Ev = { eventType: 'home_view' | 'page_view' | 'calc_started' | 'calc_result' | 'shop_view' | 'product_view' | 'knowledge_view' | 'cta_click'; shopId?: string; entityId?: string; regionCode?: string; properties?: Record<string, string | number | boolean> };

const KEY = 'quyosh.aid';
function anonymousId() {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID().replace(/-/g, '');
    localStorage.setItem(KEY, id);
  }
  return id;
}

let queue: Ev[] = [];
let timer: number | undefined;
const sent = new Set<string>();

/** Funnel hodisalari (TZ 7.7): PII yuborilmaydi; bir sahifada bir xil hodisa bir marta. */
export function track(event: Ev, onceKey?: string) {
  try {
    if (onceKey) {
      if (sent.has(onceKey)) return;
      sent.add(onceKey);
    }
    queue.push(event);
    window.clearTimeout(timer);
    timer = window.setTimeout(flush, 1500);
  } catch {
    // analitika ilovani to‘xtatmaydi
  }
}

function flush() {
  if (!queue.length) return;
  const events = queue.slice(0, 20);
  queue = queue.slice(20);
  apiPostKeepalive('/analytics/events', { anonymousId: anonymousId(), events });
  if (queue.length) timer = window.setTimeout(flush, 500);
}
if (typeof window !== 'undefined') window.addEventListener('pagehide', flush);
