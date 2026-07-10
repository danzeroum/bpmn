import type { CellCheck, SfeelValue } from './types.js';

/**
 * Parser for the S-FEEL subset (§5) — input unary tests and literal outputs.
 *
 * The exclusion list (cerca §1.6) is enforced HERE, with a specific reason per
 * exclusion: function invocation, arithmetic in cells, for/some/every, nested
 * contexts, date/time/duration literals, identifier references and any other
 * non-literal construct all fail the parse with a named reason — the caller
 * turns that into `nonSimulable {cell, reason}`. Malformed cells (unbalanced
 * quotes/brackets, operator soup) fail with a structured reason too; nothing
 * in this module throws across the public API.
 */

/** One parsed unary test. A cell is a comma-separated OR of these. */
export type UnaryTest =
  | { kind: 'any' }
  | { kind: 'cmp'; op: '<' | '<=' | '>' | '>=' | '='; value: SfeelValue }
  | { kind: 'range'; lo: number; hi: number; loIncl: boolean; hiIncl: boolean }
  | { kind: 'not'; values: SfeelValue[] };

export type ParsedCell =
  | { ok: true; tests: UnaryTest[] }
  | { ok: false; reason: string };

export type ParsedOutput =
  | { ok: true; value: SfeelValue }
  | { ok: false; reason: string };

/** Internal parse failure — converted to `{ok:false}` at the API boundary. */
class CellError extends Error {}

function fail(reason: string): never {
  throw new CellError(reason);
}

/* ------------------------------------------------------------------ *
 *  Tokenizer
 * ------------------------------------------------------------------ */

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'str'; value: string }
  | { kind: 'bool'; value: boolean }
  | { kind: 'ident'; value: string }
  | { kind: 'op'; value: '<' | '<=' | '>' | '>=' | '=' }
  | { kind: 'lbracket' } // [
  | { kind: 'rbracket' } // ]
  | { kind: 'lparen' }
  | { kind: 'rparen' }
  | { kind: 'comma' }
  | { kind: 'dotdot' };

const IDENT_START = /[A-Za-z_]/;
const IDENT_CHAR = /[A-Za-z0-9_]/;
const DIGIT = /[0-9]/;

/** True when a literal value just ended — a '-' after one is arithmetic, not
 * a numeric sign. */
function endsValue(token: Token | undefined): boolean {
  if (!token) return false;
  return (
    token.kind === 'num' ||
    token.kind === 'str' ||
    token.kind === 'bool' ||
    token.kind === 'ident' ||
    token.kind === 'rparen' ||
    token.kind === 'rbracket'
  );
}

function tokenize(cell: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = cell.length;
  while (i < n) {
    const ch = cell[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }
    if (ch === '"') {
      const close = cell.indexOf('"', i + 1);
      if (close === -1) fail('malformed cell: unterminated string literal');
      tokens.push({ kind: 'str', value: cell.slice(i + 1, close) });
      i = close + 1;
      continue;
    }
    if (ch === '{' || ch === '}') {
      fail('nested context (context literal) outside the S-FEEL subset');
    }
    if (ch === '@') {
      fail('date/time/duration literal (@"…") outside the S-FEEL subset');
    }
    if (ch === '+' || ch === '*' || ch === '/') {
      fail(`arithmetic in cells ('${ch}') outside the S-FEEL subset`);
    }
    if (ch === '?') {
      fail("expression test with the '?' placeholder outside the S-FEEL subset");
    }
    if (ch === '-') {
      // A '-' after a value is arithmetic; before a digit it is a numeric sign.
      if (endsValue(tokens[tokens.length - 1])) {
        fail("arithmetic in cells ('-') outside the S-FEEL subset");
      }
      if (i + 1 < n && DIGIT.test(cell[i + 1])) {
        const start = i;
        i++;
        while (i < n && DIGIT.test(cell[i])) i++;
        if (cell[i] === '.' && DIGIT.test(cell[i + 1] ?? '')) {
          i++;
          while (i < n && DIGIT.test(cell[i])) i++;
        }
        tokens.push({ kind: 'num', value: Number(cell.slice(start, i)) });
        continue;
      }
      fail("malformed cell: stray '-' (the irrelevant marker is a lone '-')");
    }
    if (DIGIT.test(ch)) {
      const start = i;
      while (i < n && DIGIT.test(cell[i])) i++;
      if (cell[i] === '.' && DIGIT.test(cell[i + 1] ?? '')) {
        i++;
        while (i < n && DIGIT.test(cell[i])) i++;
      }
      tokens.push({ kind: 'num', value: Number(cell.slice(start, i)) });
      continue;
    }
    if (IDENT_START.test(ch)) {
      const start = i;
      while (i < n && IDENT_CHAR.test(cell[i])) i++;
      const word = cell.slice(start, i);
      if (word === 'true' || word === 'false') {
        tokens.push({ kind: 'bool', value: word === 'true' });
      } else {
        tokens.push({ kind: 'ident', value: word });
      }
      continue;
    }
    if (ch === '<' || ch === '>') {
      if (cell[i + 1] === '=') {
        tokens.push({ kind: 'op', value: (ch + '=') as '<=' | '>=' });
        i += 2;
      } else {
        tokens.push({ kind: 'op', value: ch });
        i++;
      }
      continue;
    }
    if (ch === '=') {
      tokens.push({ kind: 'op', value: '=' });
      i++;
      continue;
    }
    if (ch === '.') {
      if (cell[i + 1] === '.') {
        tokens.push({ kind: 'dotdot' });
        i += 2;
        continue;
      }
      fail("malformed cell: stray '.'");
    }
    if (ch === '[') {
      tokens.push({ kind: 'lbracket' });
      i++;
      continue;
    }
    if (ch === ']') {
      tokens.push({ kind: 'rbracket' });
      i++;
      continue;
    }
    if (ch === '(') {
      tokens.push({ kind: 'lparen' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ kind: 'rparen' });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ kind: 'comma' });
      i++;
      continue;
    }
    fail(`malformed cell: unexpected character '${ch}'`);
  }
  return tokens;
}

/* ------------------------------------------------------------------ *
 *  Unary-test parser
 * ------------------------------------------------------------------ */

class Cursor {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}
  peek(): Token | undefined {
    return this.tokens[this.pos];
  }
  next(): Token | undefined {
    return this.tokens[this.pos++];
  }
  done(): boolean {
    return this.pos >= this.tokens.length;
  }
}

const QUANTIFIERS = new Set(['for', 'some', 'every']);
const TEMPORALS = new Set(['date', 'time', 'duration']);

function parseLiteral(cursor: Cursor, what: string): SfeelValue {
  const token = cursor.next();
  if (!token) fail(`malformed cell: expected ${what}, found end of cell`);
  if (token.kind === 'num' || token.kind === 'str' || token.kind === 'bool') return token.value;
  return identFailure(token, cursor);
}

/** Precise reason for a non-literal where a literal was required. */
function identFailure(token: Token, cursor: Cursor): never {
  if (token.kind === 'ident') {
    if (QUANTIFIERS.has(token.value)) {
      return fail(`quantified expression ('${token.value}') outside the S-FEEL subset`);
    }
    if (cursor.peek()?.kind === 'lparen') {
      const hint = TEMPORALS.has(token.value)
        ? ' (date/time/duration types are outside the subset)'
        : '';
      return fail(`function invocation '${token.value}(…)' outside the S-FEEL subset${hint}`);
    }
    return fail(
      `identifier reference '${token.value}' outside the S-FEEL subset (compare against literals only)`,
    );
  }
  return fail('malformed cell: expected a literal value');
}

function parseNumberLiteral(cursor: Cursor, what: string): number {
  const value = parseLiteral(cursor, what);
  if (typeof value !== 'number') fail(`${what} must be a number literal in the S-FEEL subset`);
  return value as number;
}

function parseTest(cursor: Cursor): UnaryTest {
  const token = cursor.peek();
  if (!token) fail('malformed cell: expected a test, found end of cell');

  if (token.kind === 'op') {
    cursor.next();
    const op = token.value;
    if (op === '=') return { kind: 'cmp', op, value: parseLiteral(cursor, 'a literal after =') };
    const value = parseNumberLiteral(cursor, `the operand of '${op}'`);
    return { kind: 'cmp', op, value };
  }

  if (token.kind === 'lbracket' || token.kind === 'rbracket') {
    cursor.next();
    // FEEL: '[' opens inclusive; a LEADING ']' opens exclusive (]a..b]).
    const loIncl = token.kind === 'lbracket';
    const lo = parseNumberLiteral(cursor, 'a range endpoint');
    if (cursor.next()?.kind !== 'dotdot') fail("malformed cell: expected '..' in range");
    const hi = parseNumberLiteral(cursor, 'a range endpoint');
    const closer = cursor.next();
    if (!closer || (closer.kind !== 'lbracket' && closer.kind !== 'rbracket')) {
      fail("malformed cell: expected ']' or '[' closing the range");
    }
    // ']' closes inclusive; a TRAILING '[' closes exclusive ([a..b[).
    const hiIncl = closer!.kind === 'rbracket';
    return { kind: 'range', lo, hi, loIncl, hiIncl };
  }

  if (token.kind === 'ident' && token.value === 'not') {
    cursor.next();
    if (cursor.next()?.kind !== 'lparen') fail("malformed cell: expected '(' after not");
    const values: SfeelValue[] = [parseLiteralOnly(cursor)];
    while (cursor.peek()?.kind === 'comma') {
      cursor.next();
      values.push(parseLiteralOnly(cursor));
    }
    if (cursor.next()?.kind !== 'rparen') fail("malformed cell: expected ')' closing not(…)");
    return { kind: 'not', values };
  }

  if (token.kind === 'num' || token.kind === 'str' || token.kind === 'bool') {
    cursor.next();
    return { kind: 'cmp', op: '=', value: token.value };
  }

  if (token.kind === 'lparen') {
    fail('parenthesized expression outside the S-FEEL subset');
  }
  return identFailure(cursor.next()!, cursor);
}

/** Inside not(…): strictly literal values (§5 — negation of a value list). */
function parseLiteralOnly(cursor: Cursor): SfeelValue {
  const token = cursor.peek();
  if (token && (token.kind === 'op' || token.kind === 'lbracket')) {
    fail('not(…) supports only a list of literal values in the S-FEEL subset');
  }
  return parseLiteral(cursor, 'a literal inside not(…)');
}

/** True when the cell means "irrelevant" — a lone '-' or an empty cell. */
export function isIrrelevant(cell: string): boolean {
  const trimmed = cell.trim();
  return trimmed === '' || trimmed === '-';
}

/**
 * Parses one input cell into its OR'd unary tests. Never throws: every
 * failure — subset exclusion or malformed syntax — comes back as
 * `{ok:false, reason}`.
 */
export function parseUnaryTests(cell: string): ParsedCell {
  if (isIrrelevant(cell)) return { ok: true, tests: [{ kind: 'any' }] };
  try {
    const cursor = new Cursor(tokenize(cell));
    const tests: UnaryTest[] = [parseTest(cursor)];
    while (cursor.peek()?.kind === 'comma') {
      cursor.next();
      tests.push(parseTest(cursor));
    }
    if (!cursor.done()) fail('malformed cell: unexpected trailing tokens');
    return { ok: true, tests };
  } catch (error) {
    if (error instanceof CellError) return { ok: false, reason: error.message };
    /* v8 ignore next -- defensive: no other throw site exists */
    throw error;
  }
}

/**
 * Parses one output cell: a single literal (§5 — non-literal output
 * expressions are outside the subset).
 */
export function parseOutputLiteral(cell: string): ParsedOutput {
  const trimmed = cell.trim();
  if (trimmed === '') return { ok: false, reason: 'empty output entry' };
  try {
    const cursor = new Cursor(tokenize(trimmed));
    const token = cursor.peek();
    if (!token) return { ok: false, reason: 'empty output entry' };
    if (token.kind !== 'num' && token.kind !== 'str' && token.kind !== 'bool') {
      identFailure(cursor.next()!, cursor);
    }
    cursor.next();
    if (!cursor.done()) {
      fail('non-literal output expression outside the S-FEEL subset (literals only)');
    }
    return { ok: true, value: (token as Extract<Token, { value: SfeelValue }>).value };
  } catch (error) {
    if (error instanceof CellError) return { ok: false, reason: error.message };
    /* v8 ignore next -- defensive: no other throw site exists */
    throw error;
  }
}

/** Editor feedback (⚠ before simulation): is this INPUT cell in the subset? */
export function checkUnaryCell(cell: string): CellCheck {
  const parsed = parseUnaryTests(cell);
  return parsed.ok ? { simulable: true } : { simulable: false, reason: parsed.reason };
}

/** Editor feedback: is this OUTPUT cell a subset literal? */
export function checkOutputCell(cell: string): CellCheck {
  const parsed = parseOutputLiteral(cell);
  return parsed.ok ? { simulable: true } : { simulable: false, reason: parsed.reason };
}
