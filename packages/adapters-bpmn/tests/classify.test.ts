import { describe, expect, it } from 'vitest';
import { classifyDiagram } from '../src/index.js';
import { diagramAt } from './fixtures.js';

describe('classifyDiagram', () => {
  it('classifies a mixed-node diagram as flow', async () => {
    const diagram = await diagramAt({
      versionId: 'v1',
      semver: '1.0.0',
      nodes: [
        { id: 'a', type: 'startEvent' },
        { id: 'b', type: 'task' },
      ],
    });
    expect(classifyDiagram(diagram)).toBe('flow');
  });

  it('classifies single-type btv diagrams as their kind', async () => {
    const cases = [
      ['btv:persona', 'persona'],
      ['btv:prompt', 'prompt'],
      ['btv:connector', 'connector'],
      ['btv:gate', 'policy'],
    ] as const;
    for (const [nodeType, kind] of cases) {
      const diagram = await diagramAt({
        versionId: `v-${kind}`,
        semver: '1.0.0',
        nodes: [{ id: 'only', type: nodeType }],
      });
      expect(classifyDiagram(diagram)).toBe(kind);
    }
  });

  it('a homogeneous unmapped type is still a flow', async () => {
    const diagram = await diagramAt({
      versionId: 'v1',
      semver: '1.0.0',
      nodes: [
        { id: 'a', type: 'task' },
        { id: 'b', type: 'task' },
      ],
    });
    expect(classifyDiagram(diagram)).toBe('flow');
  });

  it('explicit metadata.artifactType wins over the heuristic (pt/en aliases)', async () => {
    const diagram = await diagramAt({
      versionId: 'v1',
      semver: '1.0.0',
      metadata: { artifactType: 'Política' },
      nodes: [{ id: 'p0', type: 'btv:persona' }],
    });
    expect(classifyDiagram(diagram)).toBe('policy');
  });

  it('ignores unknown metadata values and removed nodes', async () => {
    const diagram = await diagramAt({
      versionId: 'v1',
      semver: '1.0.0',
      metadata: { artifactType: 'spaceship' },
      nodes: [
        { id: 'p0', type: 'btv:persona' },
        { id: 'old', type: 'task', removedInVersion: 'v1' },
      ],
    });
    // removed 'task' node is out of the heuristic → all-active = persona
    expect(classifyDiagram(diagram)).toBe('persona');
  });

  it('an empty diagram is a flow', async () => {
    const diagram = await diagramAt({ versionId: 'v1', semver: '1.0.0', nodes: [] });
    expect(classifyDiagram(diagram)).toBe('flow');
  });
});
