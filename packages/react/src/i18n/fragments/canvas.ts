import type { Messages } from '../messages.js';

/**
 * Canvas-surface dictionary fragment (melhorias F5): the SVG rendering layer's
 * aria-labels, the closed-element seal, the route-collision title and the
 * autosave recovery banner. These were the last surfaces carrying hardcoded
 * (and mixed-language) strings — a PT_BR host saw English SR labels and an EN
 * host saw "FECHADO".
 */
export const canvas: { en: Messages; ptBR: Messages } = {
  en: {
    'canvas.node.aria': '{type}: {label}',
    'canvas.port.aria': 'Connection port',
    'canvas.resize.aria': 'Resize {corner}',
    'canvas.seal.closedVersion': 'CLOSED v{version}',
    'canvas.seal.closedRef': 'CLOSED #{ref}',
    'canvas.subprocess.collapse': 'Collapse {label}',
    'canvas.subprocess.expand': 'Expand {label}',
    'canvas.subprocess.open': 'Open {label}',
    'canvas.edge.aria': '{type} connection',
    'canvas.edge.noRoute': 'No obstacle-free route — the line may cross a shape.',
    'canvas.recovery.found': 'Unsaved draft from {time} found',
    'canvas.recovery.restore': 'Restore',
    'canvas.recovery.discard': 'Discard',
  },
  ptBR: {
    'canvas.node.aria': '{type}: {label}',
    'canvas.port.aria': 'Porta de conexão',
    'canvas.resize.aria': 'Redimensionar {corner}',
    'canvas.seal.closedVersion': 'FECHADO v{version}',
    'canvas.seal.closedRef': 'FECHADO #{ref}',
    'canvas.subprocess.collapse': 'Recolher {label}',
    'canvas.subprocess.expand': 'Expandir {label}',
    'canvas.subprocess.open': 'Abrir {label}',
    'canvas.edge.aria': 'Conexão {type}',
    'canvas.edge.noRoute': 'Sem rota livre de obstáculos — a linha pode cruzar uma forma.',
    'canvas.recovery.found': 'Rascunho não salvo de {time} encontrado',
    'canvas.recovery.restore': 'Restaurar',
    'canvas.recovery.discard': 'Descartar',
  },
};
