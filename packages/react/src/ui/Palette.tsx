import type { CSSProperties } from 'react';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useCanvasStore } from '../contexts/CanvasContext.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
import { useT } from '../i18n/I18nContext.js';
import { insertPaletteItem, paletteItemLabel } from './paletteInsert.js';
import type { PaletteGroup, PaletteItem } from '../plugins/types.js';

/**
 * Element palette. Clicking an item creates a node of that type near the
 * center of the current viewport (snapped to the grid) and selects it.
 */
export function Palette() {
  const { execute, announceVeto } = useDiagram();
  const { diagram } = useDiagram();
  const store = useCanvasStore();
  const config = useEditorConfig();
  const t = useT();
  const readOnly = store.getState().readOnly;
  if (readOnly) return null;

  // ES-2 reforço 8: ONE code path (position + factory + selection) shared
  // with the ⌘K entry — `insertPaletteItem`. N-3: `element.added` is emitted
  // by the command channel, no direct emission here.
  const createAt = (item: PaletteItem) => {
    insertPaletteItem(item, { diagram, registry: config.registry, store, t, execute, announceVeto });
  };

  // Items render under their group (groups keep registration order); items
  // without a known group keep the old flat behavior, appended at the end.
  const byGroup = new Map<string, PaletteItem[]>();
  const ungrouped: PaletteItem[] = [];
  for (const item of config.paletteItems) {
    const group = item.group !== undefined && config.paletteGroups.some((g) => g.id === item.group)
      ? item.group
      : undefined;
    if (group === undefined) ungrouped.push(item);
    else byGroup.set(group, [...(byGroup.get(group) ?? []), item]);
  }

  // ES-2 i18n aditivo: `palette.item.{id}` traduz o rótulo quando a chave
  // existe no dicionário; senão o label do item vale como sempre (os itens
  // atuais e os de plugin ficam intactos).
  const labelOf = (item: PaletteItem) => paletteItemLabel(t, item);

  const renderItem = (item: PaletteItem) => (
    <button
      key={item.id}
      type="button"
      className="bpmnr-palette-item"
      title={labelOf(item)}
      aria-label={t('palette.itemAria', { label: labelOf(item) })}
      data-palette-item={item.id}
      onClick={() => createAt(item)}
    >
      <span className="bpmnr-palette-icon" aria-hidden>
        {item.icon ?? '▢'}
      </span>
      <span className="bpmnr-palette-label">{labelOf(item)}</span>
    </button>
  );

  return (
    <nav className="bpmnr-palette" aria-label={t('palette.aria')}>
      {config.paletteGroups.map((group) => {
        const items = byGroup.get(group.id);
        if (!items?.length) return null;
        return (
          <section
            key={group.id}
            className="bpmnr-palette-group"
            data-palette-group={group.id}
            aria-label={group.label}
            style={groupStyle(group)}
          >
            <h3 className="bpmnr-palette-group-header">
              {group.label}
              {group.badge && <span className="bpmnr-palette-group-badge">{group.badge}</span>}
            </h3>
            {items.map(renderItem)}
          </section>
        );
      })}
      {ungrouped.map(renderItem)}
    </nav>
  );
}

/** Group color hooks become CSS custom properties consumed by styles.css. */
function groupStyle(group: PaletteGroup): CSSProperties | undefined {
  if (!group.headerColor && !group.itemBackground && !group.itemHoverBackground) return undefined;
  return {
    ...(group.headerColor && { '--bpmnr-palette-header-color': group.headerColor }),
    ...(group.itemBackground && { '--bpmnr-palette-item-bg': group.itemBackground }),
    ...(group.itemHoverBackground && { '--bpmnr-palette-item-hover-bg': group.itemHoverBackground }),
  } as CSSProperties;
}

