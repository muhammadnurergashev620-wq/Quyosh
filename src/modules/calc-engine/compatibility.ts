/** TZ 11.13: qoidaga asoslangan moslik tekshiruvi (AI’siz). */
export type CheckStatus = 'OK' | 'WARNING' | 'ERROR' | 'UNKNOWN';

export interface PanelData { vocV?: number | null; vmpV?: number | null; impA?: number | null; tempCoeffPmaxPctPerC?: number | null; tempCoeffVocPctPerC?: number | null; nominalPowerW?: number | null }
export interface InverterData { inverterAcKw?: number | null; inverterMaxDcV?: number | null; mpptMinV?: number | null; mpptMaxV?: number | null; mpptMaxCurrentA?: number | null; batteryVoltageV?: number | null; supportedChemistries?: string[] | null }
export interface BatteryData { batteryVoltageV?: number | null; batteryChemistry?: string | null }

export interface CompatibilityInput {
  panel: PanelData;
  inverter: InverterData;
  battery?: BatteryData | null;
  seriesCount: number;
  parallelStrings: number;
  dcKwp?: number;
  tMin?: number;
  tMaxCell?: number;
}

export interface CheckItem { code: string; status: CheckStatus; value?: number; limit?: number }
export interface CompatibilityResult { status: CheckStatus; checks: CheckItem[] }

const known = (...values: Array<number | null | undefined>) => values.every((value) => typeof value === 'number' && Number.isFinite(value));
const rank: Record<CheckStatus, number> = { OK: 0, UNKNOWN: 1, WARNING: 2, ERROR: 3 };

export function checkCompatibility(input: CompatibilityInput): CompatibilityResult {
  const tMin = input.tMin ?? -15;
  const tMaxCell = input.tMaxCell ?? 70;
  const { panel, inverter } = input;
  const checks: CheckItem[] = [];
  const push = (code: string, status: CheckStatus, value?: number, limit?: number) => checks.push({ code, status, value, limit });
  const coeffVoc = (panel.tempCoeffVocPctPerC ?? -0.28) / 100;

  if (known(panel.vocV, inverter.inverterMaxDcV)) {
    const vocCold = panel.vocV! * (1 + coeffVoc * (tMin - 25));
    const value = input.seriesCount * vocCold;
    push('VOC_COLD_MAX_DC', value <= inverter.inverterMaxDcV! ? 'OK' : 'ERROR', value, inverter.inverterMaxDcV!);
  } else push('VOC_COLD_MAX_DC', 'UNKNOWN');

  if (known(panel.vmpV, panel.tempCoeffPmaxPctPerC, inverter.mpptMinV)) {
    const vmpHot = panel.vmpV! * (1 + (panel.tempCoeffPmaxPctPerC! / 100) * (tMaxCell - 25));
    const value = input.seriesCount * vmpHot;
    push('VMP_HOT_MPPT_MIN', value >= inverter.mpptMinV! ? 'OK' : 'WARNING', value, inverter.mpptMinV!);
  } else push('VMP_HOT_MPPT_MIN', 'UNKNOWN');

  if (known(panel.vmpV, inverter.mpptMaxV)) {
    const value = input.seriesCount * panel.vmpV!;
    push('VMP_MPPT_MAX', value <= inverter.mpptMaxV! ? 'OK' : 'WARNING', value, inverter.mpptMaxV!);
  } else push('VMP_MPPT_MAX', 'UNKNOWN');

  if (known(panel.impA, inverter.mpptMaxCurrentA)) {
    const value = input.parallelStrings * panel.impA!;
    push('MPPT_CURRENT', value <= inverter.mpptMaxCurrentA! ? 'OK' : 'WARNING', value, inverter.mpptMaxCurrentA!);
  } else push('MPPT_CURRENT', 'UNKNOWN');

  if (input.battery) {
    if (known(input.battery.batteryVoltageV, inverter.batteryVoltageV)) push('BATTERY_VOLTAGE', Math.abs(input.battery.batteryVoltageV! - inverter.batteryVoltageV!) < 0.5 ? 'OK' : 'ERROR', input.battery.batteryVoltageV!, inverter.batteryVoltageV!);
    else push('BATTERY_VOLTAGE', 'UNKNOWN');
    if (input.battery.batteryChemistry && inverter.supportedChemistries?.length) push('BATTERY_CHEMISTRY', inverter.supportedChemistries.map((c) => c.toLowerCase()).includes(input.battery.batteryChemistry.toLowerCase()) ? 'OK' : 'ERROR');
    else push('BATTERY_CHEMISTRY', 'UNKNOWN');
  }

  const dc = input.dcKwp ?? (known(panel.nominalPowerW) ? (panel.nominalPowerW! * input.seriesCount * input.parallelStrings) / 1000 : null);
  if (dc !== null && known(inverter.inverterAcKw)) {
    const ratio = dc / inverter.inverterAcKw!;
    push('DC_AC_RATIO', ratio >= 1 && ratio <= 1.35 ? 'OK' : 'WARNING', ratio);
  } else push('DC_AC_RATIO', 'UNKNOWN');

  const status = checks.reduce<CheckStatus>((worst, item) => (rank[item.status] > rank[worst] ? item.status : worst), 'OK');
  return { status, checks };
}
