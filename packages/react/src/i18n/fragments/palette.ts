import type { Messages } from '../messages.js';

/**
 * Palette + minimap dictionary fragment (Handoff 11 N-6). Holds the literal
 * chrome for the element palette (`palette.*`) and the overview minimap
 * (`minimap.*`) side by side; `en.ts` / `ptBR.ts` spread both dictionaries into
 * the flat lookup tables. Plugin-authored palette item/group labels stay in
 * their data and are never keyed here.
 */
export const palette: { en: Messages; ptBR: Messages } = {
  en: {
    'palette.aria': 'Element palette',
    'palette.itemAria': 'Add {label}',
    'minimap.aria': 'Diagram overview',
  },
  ptBR: {
    'palette.aria': 'Paleta de elementos',
    'palette.itemAria': 'Adicionar {label}',
    'minimap.aria': 'Visão geral do diagrama',
  },
};
