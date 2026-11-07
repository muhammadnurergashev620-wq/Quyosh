import { Badge, type BadgeTone } from './Badge';

type StatusMap = Record<string, { label: string; tone: BadgeTone }>;

/** Jarayon davom etayotgan (javob/harakat kutilayotgan) holatlar — pulsatsiyalanuvchi nuqta bilan. */
const LIVE = new Set(['OPEN', 'SENT', 'CLARIFICATION_REQUESTED', 'INSTALLED', 'PENDING', 'PENDING_REVIEW', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'VALIDATING', 'APPLYING', 'QUEUED', 'PROCESSING']);

/**
 * Yagona status belgisi (U5.3): matn va ton bitta xaritadan (`REQUEST_STATUS`, `QUOTE_STATUS`, `INSTALLATION_STATUS`,
 * `SHOP_STATUS` …). Noma’lum qiymat — neytral, kodning o‘zi.
 */
export function StatusBadge<M extends StatusMap>({ map, status, live }: { map: M; status: keyof M & string; live?: boolean }) {
  const info = map[status] ?? { label: status, tone: 'neutral' as BadgeTone };
  return <Badge tone={info.tone} live={live ?? LIVE.has(status)}>{info.label}</Badge>;
}
