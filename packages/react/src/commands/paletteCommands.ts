import { insertPaletteItem, paletteItemLabel } from '../ui/paletteInsert.js';
import type { GlobalCommandContext, RegisteredGlobalCommand } from './globalCommands.js';

/**
 * COMPOSITE palette items as ⌘K commands (Handoff 17 ES-2, reforço 8): each
 * item with a `build` factory surfaces as `palette.insert.{id}`, resolved by
 * the SAME `insertPaletteItem` code path as the palette click — one command,
 * one source. Plain items stay palette-only (unchanged V-7 behavior). Lives
 * in the command REGISTRY, never inline in the palette component (the V-7
 * "zero hardcoded command" sweep pins that).
 */
export function paletteInsertCommands(ctx: GlobalCommandContext): RegisteredGlobalCommand[] {
  return ctx.config.paletteItems
    .filter((item) => item.build !== undefined)
    .map((item) => ({
      id: `palette.insert.${item.id}`,
      label: ctx.t('cmdk.insertItem', { label: paletteItemLabel(ctx.t, item) }),
      run: () => {
        insertPaletteItem(item, {
          diagram: ctx.diagram,
          registry: ctx.config.registry,
          store: ctx.store,
          t: ctx.t,
          execute: ctx.execute,
        });
      },
    }));
}
