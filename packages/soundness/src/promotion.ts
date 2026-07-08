import type { PromotionRule } from '@bpmn-react/core';
import { analyzeSoundness, type SoundnessOptions } from './rules.js';

/**
 * Promotion gate (Handoff 4 §C2): soundness ERRORS block promotion to
 * `active` through the existing LifecycleEngine mechanism — drop it into
 * `lifecycleConfig.promotionRules` and `evaluateGates`/`promote` enforce it
 * like any other gate. Warnings and info never block (§3 do handoff).
 *
 * ```ts
 * new LifecycleEngine({ promotionRules: [soundnessPromotionRule()] })
 * ```
 */
export function soundnessPromotionRule(options: SoundnessOptions = {}): PromotionRule {
  return ({ diagram, target }) => {
    if (target !== 'active') return { allowed: true };
    const errors = analyzeSoundness(diagram, options).filter(
      (issue) => issue.severity === 'error',
    );
    if (errors.length === 0) return { allowed: true };
    const codes = [...new Set(errors.map((issue) => issue.code))].join(', ');
    return {
      allowed: false,
      reason:
        options.locale === 'pt'
          ? `Soundness: ${errors.length} erro(s) estrutural(is) bloqueiam a ativação — ${codes}`
          : `Soundness: ${errors.length} structural error(s) block activation — ${codes}`,
    };
  };
}
