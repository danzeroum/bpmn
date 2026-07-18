import type { Messages } from '../messages.js';
import { toolbar } from './toolbar.js';
import { properties } from './properties.js';
import { palette } from './palette.js';
import { versioning } from './versioning.js';
import { pedigree } from './pedigree.js';
import { ledgerStatus } from './ledgerStatus.js';
import { promotion } from './promotion.js';
import { copilot } from './copilot.js';
import { menus } from './menus.js';
import { simulation } from './simulation.js';
import { studio } from './studio.js';
import { agentStudio } from './agentStudio.js';
import { canvas } from './canvas.js';
import { lint } from './lint.js';
import { review } from './review.js';
import { commandPalette } from './commandPalette.js';
import { eventDefs } from './eventDefs.js';

/**
 * Every dictionary fragment (Handoff 11 N-6). One entry per migrated surface
 * group; `en.ts` / `ptBR.ts` spread the matching side of each into the flat
 * lookup tables. Adding a surface = add its fragment here.
 */
export const FRAGMENTS: Array<{ en: Messages; ptBR: Messages }> = [
  toolbar,
  properties,
  palette,
  versioning,
  pedigree,
  ledgerStatus,
  promotion,
  copilot,
  menus,
  simulation,
  studio,
  agentStudio,
  canvas,
  lint,
  review,
  commandPalette,
  eventDefs,
];
