import type { InstallationStatus } from '@prisma/client';
import { assertTransitionIn, canTransitionIn, type TransitionTable } from '../../common/state/transition-table';

export type InstallationActor = 'CUSTOMER' | 'SHOP' | 'ADMIN' | 'SYSTEM';

/** TZ 13.1 — Installation.status. Avtomatik tasdiqlash yo‘q. */
const INSTALLATION: TransitionTable<InstallationStatus, InstallationActor> = [
  { from: ['AGREED'], to: 'SITE_VISIT_SCHEDULED', actors: ['SYSTEM'] },
  { from: ['AGREED', 'SITE_VISIT_SCHEDULED'], to: 'INSTALLATION_SCHEDULED', actors: ['SHOP'] },
  { from: ['INSTALLATION_SCHEDULED'], to: 'INSTALLED', actors: ['SHOP'] },
  { from: ['INSTALLED'], to: 'CONFIRMED', actors: ['CUSTOMER'] },
  { from: ['INSTALLED'], to: 'DISPUTED', actors: ['CUSTOMER'] },
  { from: ['DISPUTED'], to: 'CONFIRMED', actors: ['ADMIN'] },
  { from: ['DISPUTED'], to: 'CANCELLED', actors: ['ADMIN'] },
  { from: ['AGREED', 'SITE_VISIT_SCHEDULED', 'INSTALLATION_SCHEDULED'], to: 'CANCELLED', actors: ['CUSTOMER', 'SHOP'] },
];

export const canInstallationTransition = (from: InstallationStatus, to: InstallationStatus, actor: InstallationActor) => canTransitionIn(INSTALLATION, from, to, actor);
export const assertInstallationTransition = (from: InstallationStatus, to: InstallationStatus, actor: InstallationActor) => assertTransitionIn(INSTALLATION, from, to, actor);
