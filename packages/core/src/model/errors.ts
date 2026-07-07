/** Error hierarchy — lets host applications branch on error kind. */

export class BpmnError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

/** A diagram or element failed model validation. */
export class BpmnValidationError extends BpmnError {
  constructor(message: string) {
    super('VALIDATION', message);
  }
}

/** An invalid lifecycle transition or unmet promotion requirement. */
export class BpmnLifecycleError extends BpmnError {
  constructor(message: string) {
    super('LIFECYCLE', message);
  }
}

/** Audit ledger integrity or usage failure. */
export class BpmnAuditError extends BpmnError {
  constructor(message: string) {
    super('AUDIT', message);
  }
}

/** XML (or other format) parsing failure. */
export class BpmnParseError extends BpmnError {
  /** 1-based line where the problem was detected, when known. */
  readonly line?: number;

  constructor(message: string, line?: number) {
    super('PARSE', line !== undefined ? `${message} (line ${line})` : message);
    this.line = line;
  }
}

/** A command was vetoed by a rule. */
export class BpmnRuleError extends BpmnError {
  constructor(message: string) {
    super('RULE', message);
  }
}
