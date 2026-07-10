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
    'edgeLabel.aria': 'Editar rótulo da aresta',
    'nodeLabel.aria': 'Editar rótulo',
  },
};
