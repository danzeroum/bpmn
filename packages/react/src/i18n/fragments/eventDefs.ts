import type { Messages } from '../messages.js';

/**
 * Handoff 16 E-2 dictionary fragment (§3a UI): the "Evento" section of the
 * properties panel — named-definition picker, «+» auto-create, inline rename
 * (cascade by construction), usage list and the blocked-deletion flow.
 */
export const eventDefs: { en: Messages; ptBR: Messages } = {
  en: {
    'eventDefs.kicker.message': 'Event — message',
    'eventDefs.kicker.signal': 'Event — signal',
    'eventDefs.kicker.error': 'Event — error',
    'eventDefs.picker.label': 'Named definition',
    'eventDefs.picker.none': '— no definition —',
    'eventDefs.add': 'New definition',
    'eventDefs.add.aria': 'Create a named definition and reference it here',
    'eventDefs.defaultName.message': 'New message',
    'eventDefs.defaultName.signal': 'New signal',
    'eventDefs.defaultName.error': 'New error',
    'eventDefs.compose.create': 'Create and reference event definition',
    'eventDefs.name.label': 'Definition name',
    'eventDefs.errorCode.label': 'Error code',
    'eventDefs.usages.kicker_one': 'Used by {count} event',
    'eventDefs.usages.kicker_other': 'Used by {count} events',
    'eventDefs.usages.none': 'No other event uses this definition.',
    'eventDefs.usages.goto': 'Go to event {label}',
    'eventDefs.delete': 'Delete definition',
    'eventDefs.delete.aria': 'Delete the selected named definition',
  },
  ptBR: {
    'eventDefs.kicker.message': 'Evento — mensagem',
    'eventDefs.kicker.signal': 'Evento — sinal',
    'eventDefs.kicker.error': 'Evento — erro',
    'eventDefs.picker.label': 'Definição nomeada',
    'eventDefs.picker.none': '— sem definição —',
    'eventDefs.add': 'Nova definição',
    'eventDefs.add.aria': 'Criar uma definição nomeada e referenciá-la aqui',
    'eventDefs.defaultName.message': 'Nova mensagem',
    'eventDefs.defaultName.signal': 'Novo sinal',
    'eventDefs.defaultName.error': 'Novo erro',
    'eventDefs.compose.create': 'Criar e referenciar definição de evento',
    'eventDefs.name.label': 'Nome da definição',
    'eventDefs.errorCode.label': 'Código de erro',
    'eventDefs.usages.kicker_one': 'Usada por {count} evento',
    'eventDefs.usages.kicker_other': 'Usada por {count} eventos',
    'eventDefs.usages.none': 'Nenhum outro evento usa esta definição.',
    'eventDefs.usages.goto': 'Ir ao evento {label}',
    'eventDefs.delete': 'Excluir definição',
    'eventDefs.delete.aria': 'Excluir a definição nomeada selecionada',
  },
};
