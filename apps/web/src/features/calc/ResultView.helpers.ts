import { kw } from './labels';
import type { EstimateResult } from './types';
import { t } from '@/i18n';
import './calc.css';

/** Bir jumlalik xulosa (U8.1). */
export function headline(result: EstimateResult): string {
  const share = Math.round(Math.min(1, result.generation.annual / Math.max(result.load.annual, 1)) * 100);
  return t('Sizga {kw} tizim mos — u yillik elektringizning taxminan {p} % ini qoplaydi', { kw: kw(result.systemPowerKw), p: share });
}
