import type { DateRange } from './services/admin.service';

export interface RangeInputs {
  from: string;
  to: string;
}

export function toRange({ from, to }: RangeInputs): DateRange {
  return {
    dateFrom: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    dateTo: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
  };
}
