import { BpmnError } from '@buildtovalue/core';

/** An adapter lookup or mapping failed (unknown artifact, bad reference). */
export class AdapterError extends BpmnError {
  constructor(message: string) {
    super('ADAPTER', message);
  }
}
