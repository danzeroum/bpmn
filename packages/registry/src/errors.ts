import { BpmnError } from '@buildtovalue/core';

/** A registry operation failed (unknown version, integrity break, bad publish). */
export class RegistryError extends BpmnError {
  constructor(message: string) {
    super('REGISTRY', message);
  }
}
