import type { Messages } from '../messages.js';

/**
 * Properties inspector dictionary fragment (Handoff 11 N-6). Each migrated
 * surface owns one fragment holding both official dictionaries side by side;
 * `en.ts` / `ptBR.ts` spread the fragments into the flat lookup tables. Keys are
 * namespaced by surface (`properties.*`); plural pairs use `_one` / `_other`.
 */
export const properties: { en: Messages; ptBR: Messages } = {
  en: {
    'properties.title': 'Properties',
    'properties.nothingSelected': 'Nothing selected',
    'properties.elementsSelected_one': '{count} element selected',
    'properties.elementsSelected_other': '{count} elements selected',
    'properties.elementNotFound': 'Element not found',
    'properties.label': 'Label',
    'properties.purpose': 'Purpose',
    'properties.purposePlaceholder': 'Why does this handoff exist?',
    'properties.backToAuto': 'Back to automatic',
    'properties.createdInVersion': 'Created in version',
    'properties.closedInVersion': 'Closed in version',
    'properties.supersedes': 'Supersedes',
    'properties.properties': 'Properties',
    'properties.noProperties': 'No properties',
    'properties.addProperty': 'Add property…',
    'properties.newPropertyName': 'New property name',
  },
  ptBR: {
    'properties.title': 'Propriedades',
    'properties.nothingSelected': 'Nada selecionado',
    'properties.elementsSelected_one': '{count} elemento selecionado',
    'properties.elementsSelected_other': '{count} elementos selecionados',
    'properties.elementNotFound': 'Elemento não encontrado',
    'properties.label': 'Rótulo',
    'properties.purpose': 'Propósito',
    'properties.purposePlaceholder': 'Por que este handoff existe?',
    'properties.backToAuto': 'Voltar ao automático',
    'properties.createdInVersion': 'Criado na versão',
    'properties.closedInVersion': 'Encerrado na versão',
    'properties.supersedes': 'Substitui',
    'properties.properties': 'Propriedades',
    'properties.noProperties': 'Nenhuma propriedade',
    'properties.addProperty': 'Adicionar propriedade…',
    'properties.newPropertyName': 'Nome da nova propriedade',
  },
};
