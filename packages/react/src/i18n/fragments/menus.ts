import type { Messages } from '../messages.js';

/**
 * Menus dictionary fragment (Handoff 11 N-6): built-in context-menu labels and
 * the inline label editors. Plugin-provided item labels stay data (`item.label`)
 * and are never keyed here. Keys are namespaced by surface (`contextMenu.*`,
 * `edgeLabel.*`, `nodeLabel.*`); both official dictionaries sit side by side.
 */
export const menus: { en: Messages; ptBR: Messages } = {
  en: {
    'contextMenu.aria': 'Context menu',
    'contextMenu.backToAuto': 'Back to automatic',
    'contextMenu.addWaypoint': 'Add waypoint here',
    'contextMenu.editLabel': 'Edit label',
    'contextMenu.moveIntoSubprocess': 'Move into “{name}”',
    'contextMenu.removeFromSubprocess': 'Remove from sub-process',
    'contextMenu.copy': 'Copy',
    'contextMenu.duplicate': 'Duplicate',
    'contextMenu.paste': 'Paste here',
    'contextMenu.alignLeft': 'Align left edges',
    'contextMenu.alignCenterX': 'Align horizontal centers',
    'contextMenu.alignTop': 'Align top edges',
    'contextMenu.alignCenterY': 'Align vertical centers',
    'contextMenu.distributeHorizontal': 'Distribute horizontally',
    'contextMenu.distributeVertical': 'Distribute vertically',
    'edgeLabel.aria': 'Edit edge label',
    'nodeLabel.aria': 'Edit label',
  },
  ptBR: {
    'contextMenu.aria': 'Menu de contexto',
    'contextMenu.backToAuto': 'Voltar ao automático',
    'contextMenu.addWaypoint': 'Adicionar waypoint aqui',
    'contextMenu.editLabel': 'Editar rótulo',
    'contextMenu.moveIntoSubprocess': 'Mover para dentro de “{name}”',
    'contextMenu.removeFromSubprocess': 'Remover do subprocesso',
    'contextMenu.copy': 'Copiar',
    'contextMenu.duplicate': 'Duplicar',
    'contextMenu.paste': 'Colar aqui',
    'contextMenu.alignLeft': 'Alinhar bordas esquerdas',
    'contextMenu.alignCenterX': 'Alinhar centros na horizontal',
    'contextMenu.alignTop': 'Alinhar bordas superiores',
    'contextMenu.alignCenterY': 'Alinhar centros na vertical',
    'contextMenu.distributeHorizontal': 'Distribuir na horizontal',
    'contextMenu.distributeVertical': 'Distribuir na vertical',
    'edgeLabel.aria': 'Editar rótulo da aresta',
    'nodeLabel.aria': 'Editar rótulo',
  },
};
