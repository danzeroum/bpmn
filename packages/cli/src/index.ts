import { writeFile } from 'node:fs/promises';
import {
  BpmnXmlConverter,
  BUILT_IN_VALIDATION_RULES,
  computeDiff,
  JsonSerializer,
  ValidationEngine,
  type BpmnDiff,
  type ValidationResult,
} from '@bpmn-react/core';
import { soundnessRules } from '@bpmn-react/soundness';
import { loadDiagram } from './io.js';

export * from './io.js';
export * from './audit.js';
export * from './certify.js';
export * from './registry.js';
export * from './promote.js';

export async function validateCommand(path: string): Promise<{
  result: ValidationResult;
  warnings: string[];
}> {
  const { diagram, warnings } = await loadDiagram(path);
  // Structural validation + soundness (§C1): the SND_* rules ship in the
  // plugin format, so headless consumption is just more rules in the engine.
  const engine = new ValidationEngine([...BUILT_IN_VALIDATION_RULES, ...soundnessRules()]);
  return { result: engine.validate(diagram), warnings };
}

export async function exportCommand(
  input: string,
  format: 'xml' | 'json',
  output?: string,
): Promise<string> {
  const { diagram } = await loadDiagram(input);
  const content =
    format === 'json'
      ? new JsonSerializer().serialize(diagram)
      : new BpmnXmlConverter().toXml(diagram);
  if (output) await writeFile(output, content, 'utf8');
  return content;
}

export async function diffCommand(pathA: string, pathB: string): Promise<BpmnDiff> {
  const [a, b] = await Promise.all([loadDiagram(pathA), loadDiagram(pathB)]);
  return computeDiff(a.diagram, b.diagram);
}
