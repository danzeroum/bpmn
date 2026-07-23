import type { ExpressionEvaluator } from './types.js';

/**
 * Avaliador S-FEEL CANÔNICO de `validation`/`visibleWhen` dos formulários —
 * a MESMA implementação para o preview do cliente e a validação do servidor
 * (fecha a divergência histórica: o servidor validava só igualdade enquanto o
 * preview aceitava comparações). Subconjunto HONESTO da v1:
 *  - comparações `>  >=  <  <=  =  !=` sobre `value` (o campo em edição) e as
 *    chaves dos outros campos;
 *  - conjunção/disjunção `and`/`or`, da esquerda para a direita, sem parênteses
 *    (precedência do S-FEEL: `and` liga mais forte que `or`; aqui `or` é
 *    quebrado primeiro, então cada termo pode conter `and`);
 *  - literais: número, `"texto"`, `true`/`false`.
 * Qualquer coisa fora disso retorna `{ error }` — NUNCA um booleano
 * silenciosamente errado (mesma disciplina do D19/lint e da cerca de
 * honestidade da biblioteca).
 */

const UNSUPPORTED = Symbol.for('btv:unsupported');

type Cmp = '>=' | '<=' | '!=' | '>' | '<' | '=';
const CMP: Cmp[] = ['>=', '<=', '!=', '>', '<', '='];

function coerce(token: string, ctx: Readonly<Record<string, unknown>>): unknown {
  const t = token.trim();
  if (t === 'value') return ctx.value;
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (/^"[^"]*"$/.test(t)) return t.slice(1, -1);
  if (/^[A-Za-z_]\w*$/.test(t)) return ctx[t];
  return UNSUPPORTED;
}

function evalComparison(
  expr: string,
  ctx: Readonly<Record<string, unknown>>,
): { value: boolean } | { error: string } {
  for (const op of CMP) {
    const at = expr.indexOf(op);
    if (at <= 0) continue;
    // não confundir '=' com '>=' '<=' '!=' (esses já foram testados antes de '=')
    if (op === '=' && (expr[at - 1] === '>' || expr[at - 1] === '<' || expr[at - 1] === '!')) continue;
    const left = coerce(expr.slice(0, at), ctx);
    const right = coerce(expr.slice(at + op.length), ctx);
    if (left === UNSUPPORTED || right === UNSUPPORTED) {
      return { error: `operando fora do subconjunto v1 em "${expr.trim()}"` };
    }
    switch (op) {
      case '=':
        return { value: left === right };
      case '!=':
        return { value: left !== right };
      default: {
        if (typeof left !== 'number' || typeof right !== 'number') {
          // comparação de ordem exige números definidos; ausente → falso
          return { value: false };
        }
        if (op === '>') return { value: left > right };
        if (op === '<') return { value: left < right };
        if (op === '>=') return { value: left >= right };
        return { value: left <= right };
      }
    }
  }
  return { error: `expressão sem operador de comparação suportado: "${expr.trim()}"` };
}

export const formExpressionEvaluator: ExpressionEvaluator = {
  evaluate(expression, context) {
    const expr = expression.trim();
    if (expr === '') return { error: 'expressão vazia' };
    if (/\bor\b/.test(expr)) {
      for (const part of expr.split(/\bor\b/)) {
        const r = this.evaluate(part, context);
        if ('error' in r) return r;
        if (r.value) return { value: true };
      }
      return { value: false };
    }
    if (/\band\b/.test(expr)) {
      for (const part of expr.split(/\band\b/)) {
        const r = this.evaluate(part, context);
        if ('error' in r) return r;
        if (!r.value) return { value: false };
      }
      return { value: true };
    }
    return evalComparison(expr, context);
  },
};
