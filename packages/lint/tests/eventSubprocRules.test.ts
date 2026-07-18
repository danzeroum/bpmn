import { describe, expect, it } from 'vitest';
import { createDiagram, createEdge, createNode, type BpmnDiagram } from '@buildtovalue/core';
import {
  ETIQUETTE_PROFILE,
  EXECUTABILITY_PROFILE,
  evtSubprocFlowRule,
  evtSubprocStartRule,
  fixCommandFor,
  lintFindings,
  typedMessageStartCommands,
} from '../src/index.js';

/**
 * Handoff 17 ES-4 — EVT_SUBPROC_FLOW e EVT_SUBPROC_START (§4d, critérios
 * 1–2) + reforços 7 (filhos DIRETOS; casca↔casca = 1 finding) e 8 (kind não
 * suportado acusa nomeando os aceitos) + política 1.2.0 (critério 5) e o
 * anti-drift do builder compartilhado.
 */
const node = (
  id: string,
  type: string,
  properties: Record<string, unknown> = {},
  label = id,
): ReturnType<typeof createNode> => createNode({ id, type, label, x: 0, y: 0, properties });

function withGraph(
  nodes: BpmnDiagram['nodes'],
  edges: Array<[string, string, string]> = [],
): BpmnDiagram {
  const diagram = createDiagram({ name: 'ESub lint' });
  diagram.nodes = nodes;
  for (const [id, sourceId, targetId] of edges) {
    diagram.edges[id] = createEdge({ id, sourceId, targetId });
  }
  return diagram;
}

describe('EVT_SUBPROC_FLOW (critério 1, reforço 7)', () => {
  it('fluxo de/para a casca acusa nomeando aresta e contêiner; comum e filhos nunca', () => {
    const diagram = withGraph(
      {
        t: node('t', 'task'),
        esub: node('esub', 'subProcess', { triggeredByEvent: true }, 'Tratar exceções'),
        common: node('common', 'subProcess', {}),
        a: node('a', 'task', { parentId: 'esub' }),
        b: node('b', 'task', { parentId: 'esub' }),
      },
      [
        ['bad', 't', 'esub'], // entra na casca
        ['ok1', 't', 'common'], // subProcess comum conectável
        ['ok2', 'a', 'b'], // filhos entre si
      ],
    );
    const issues = evtSubprocFlowRule(diagram);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: 'EVT_SUBPROC_FLOW', severity: 'error', edgeId: 'bad' });
    expect(issues[0].message).toContain('"Tratar exceções"');
    expect(issues[0].message).toContain('"bad"');
  });

  it('reforço 7 — casca↔casca = UM finding nomeando as DUAS pontas', () => {
    const diagram = withGraph(
      {
        e1: node('e1', 'subProcess', { triggeredByEvent: true }, 'Casca A'),
        e2: node('e2', 'subProcess', { triggeredByEvent: true }, 'Casca B'),
      },
      [['x', 'e1', 'e2']],
    );
    const issues = evtSubprocFlowRule(diagram);
    expect(issues).toHaveLength(1); // nunca 2 findings da mesma aresta
    expect(issues[0].message).toContain('"Casca A"');
    expect(issues[0].message).toContain('"Casca B"');
  });
});

describe('EVT_SUBPROC_START (critério 2, reforços 7–8)', () => {
  it('0 starts, >1 starts e sem gatilho acusam com mensagens DISTINTAS nomeando o contêiner', () => {
    const diagram = withGraph({
      zero: node('zero', 'subProcess', { triggeredByEvent: true }, 'Sem start'),
      two: node('two', 'subProcess', { triggeredByEvent: true }, 'Duplicado'),
      s1: node('s1', 'startEvent', { parentId: 'two', eventDefinition: 'message' }),
      s2: node('s2', 'startEvent', { parentId: 'two', eventDefinition: 'error' }),
      untyped: node('untyped', 'subProcess', { triggeredByEvent: true }, 'Sem gatilho'),
      s3: node('s3', 'startEvent', { parentId: 'untyped' }),
      ok: node('ok', 'subProcess', { triggeredByEvent: true }, 'Certo'),
      s4: node('s4', 'startEvent', { parentId: 'ok', eventDefinition: 'timer' }),
      common: node('common', 'subProcess', {}),
    });
    const issues = evtSubprocStartRule(diagram);
    const byNode = new Map(issues.map((issue) => [issue.nodeId, issue.message]));
    expect(byNode.get('zero')).toContain('found: 0');
    expect(byNode.get('zero')).toContain('"Sem start"');
    expect(byNode.get('two')).toContain('found: 2');
    expect(byNode.get('untyped')).toContain('untyped start');
    // subProcess COMUM e o contêiner correto nunca acusam.
    expect(byNode.has('ok')).toBe(false);
    expect(byNode.has('common')).toBe(false);
    expect(issues).toHaveLength(3);
  });

  it('reforço 7 — a contagem é dos filhos DIRETOS: start em subProcess ANINHADO nunca conta', () => {
    const diagram = withGraph({
      esub: node('esub', 'subProcess', { triggeredByEvent: true }, 'Externo'),
      inner: node('inner', 'subProcess', { parentId: 'esub' }),
      deepStart: node('deepStart', 'startEvent', { parentId: 'inner', eventDefinition: 'message' }),
    });
    const issues = evtSubprocStartRule(diagram);
    // O start aninhado não satisfaz o contêiner externo: found: 0.
    expect(issues.map((issue) => issue.nodeId)).toEqual(['esub']);
    expect(issues[0].message).toContain('found: 0');
  });

  it('§5d — start de escalação em esub é LEGAL (migração da rejeição ES-4)', () => {
    // Handoff 18 §5d: escalation entrou em SUBPROC_TRIGGER_KINDS → não acusa mais.
    const diagram = withGraph({
      esub: node('esub', 'subProcess', { triggeredByEvent: true }, 'Escalado'),
      s: node('s', 'startEvent', { parentId: 'esub', eventDefinition: 'escalation' }),
    });
    expect(evtSubprocStartRule(diagram)).toHaveLength(0);
  });

  it('reforço 8 — kind AINDA fora da lista (compensation, pendência) acusa NOMEANDO os aceitos', () => {
    const diagram = withGraph({
      esub: node('esub', 'subProcess', { triggeredByEvent: true }, 'Compensado'),
      s: node('s', 'startEvent', { parentId: 'esub', eventDefinition: 'compensation' }),
    });
    const issues = evtSubprocStartRule(diagram);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('kind "compensation" is not supported');
    expect(issues[0].message).toContain('message, signal, error, timer, conditional, escalation');
  });
});

describe('quick-fix do 0-starts (critério 2) + anti-drift do builder', () => {
  it('SÓ 0-starts é mecânico: UM composto via o builder compartilhado; >1 e sem gatilho → null', () => {
    const diagram = withGraph({
      zero: node('zero', 'subProcess', { triggeredByEvent: true }, 'Sem start'),
      untyped: node('untyped', 'subProcess', { triggeredByEvent: true }, 'Sem gatilho'),
      s3: node('s3', 'startEvent', { parentId: 'untyped' }),
    });
    const findings = lintFindings(diagram, [ETIQUETTE_PROFILE]);
    const zeroFinding = findings.find(
      (f) => f.code === 'EVT_SUBPROC_START' && f.nodeId === 'zero',
    )!;
    const untypedFinding = findings.find(
      (f) => f.code === 'EVT_SUBPROC_START' && f.nodeId === 'untyped',
    )!;
    expect(zeroFinding.fixable).toBe(true);
    expect(untypedFinding.fixable).toBe(false);
    expect(fixCommandFor(diagram, untypedFinding, [ETIQUETTE_PROFILE])).toBeNull();
    // O fix cria start message tipado + definição referenciada DENTRO do
    // contêiner — a MESMA FORMA do composto da paleta ES-2 (uma fonte).
    const command = fixCommandFor(diagram, zeroFinding, [ETIQUETTE_PROFILE])!;
    const fixed = command.execute(diagram);
    const start = Object.values(fixed.nodes).find((n) => n.type === 'startEvent' && n.properties.parentId === 'zero')!;
    expect(start.properties.eventDefinition).toBe('message');
    expect(start.properties.eventDefinitionRef).toBe('msg-1');
    expect(fixed.definitions?.messages).toEqual([{ id: 'msg-1', name: 'New message' }]);
    // Depois do fix, a finding do zero some (regra satisfeita).
    expect(
      evtSubprocStartRule(fixed).filter((issue) => issue.nodeId === 'zero'),
    ).toEqual([]);
    // 1 undo reverte start E definição (composto atômico) — o s3 do fixture
    // (start do untyped) permanece, claro.
    const undone = command.undo!(fixed);
    expect(undone.definitions?.messages ?? []).toEqual([]);
    expect(
      Object.values(undone.nodes).filter(
        (n) => n.type === 'startEvent' && n.properties.parentId === 'zero' && !n.removedInVersion,
      ),
    ).toEqual([]);
    expect(evtSubprocStartRule(undone).find((issue) => issue.nodeId === 'zero')?.message).toContain(
      'found: 0',
    );
  });

  it('anti-drift: o builder compartilhado produz a FORMA do composto da paleta (kinds/ref/shape)', () => {
    const diagram = withGraph({
      esub: node('esub', 'subProcess', { triggeredByEvent: true }),
    });
    const { commands, startId, definitionId } = typedMessageStartCommands(diagram, {
      parentId: 'esub',
      x: 24,
      y: 48,
    });
    expect(commands).toHaveLength(2); // definição + start, sempre nesta forma
    let out = diagram;
    for (const command of commands) out = command.execute(out);
    expect(out.definitions?.messages).toEqual([{ id: definitionId, name: 'New message' }]);
    expect(out.nodes[startId].properties).toMatchObject({
      parentId: 'esub',
      eventDefinition: 'message',
      eventDefinitionRef: definitionId,
    });
  });
});

describe('guardas e ramos do builder', () => {
  it('builder sem parentId (start solto) e com definitionName da camada (paleta)', () => {
    const diagram = withGraph({});
    const named = typedMessageStartCommands(diagram, { x: 5, y: 6, definitionName: 'Nova mensagem' });
    let out = diagram;
    for (const command of named.commands) out = command.execute(out);
    expect(out.definitions?.messages).toEqual([{ id: named.definitionId, name: 'Nova mensagem' }]);
    expect('parentId' in out.nodes[named.startId].properties).toBe(false);
  });

  it('aresta com ponta inexistente e aresta não-fluxo nunca acusam FLOW', () => {
    const diagram = withGraph(
      {
        esub: node('esub', 'subProcess', { triggeredByEvent: true }),
        note: node('note', 'textAnnotation', {}),
      },
      [['dangling', 'ghost', 'esub']],
    );
    diagram.edges.assoc = createEdge({
      id: 'assoc',
      sourceId: 'note',
      targetId: 'esub',
      type: 'association',
    });
    expect(evtSubprocFlowRule(diagram).map((issue) => issue.edgeId)).toEqual(['dangling']);
  });

  it('fix é null para finding sem nodeId válido ou contêiner que deixou de ser event subprocess', () => {
    const diagram = withGraph({
      zero: node('zero', 'subProcess', { triggeredByEvent: true }, 'Sem start'),
    });
    const finding = lintFindings(diagram, [ETIQUETTE_PROFILE]).find(
      (f) => f.code === 'EVT_SUBPROC_START',
    )!;
    // Contêiner virou comum entre o lint e o fix (diagrama atual manda).
    const mutated = withGraph({ zero: node('zero', 'subProcess', {}, 'Sem start') });
    expect(fixCommandFor(mutated, finding, [ETIQUETTE_PROFILE])).toBeNull();
    const orphan = { ...finding, nodeId: 'ghost' };
    expect(fixCommandFor(diagram, orphan, [ETIQUETTE_PROFILE])).toBeNull();
  });
});

describe('política 1.2.0 (critério 5)', () => {
  it('perfis em 1.2.0 com as regras novas registradas na MESMA fonte', () => {
    expect(ETIQUETTE_PROFILE.version).toBe('1.3.0');
    expect(EXECUTABILITY_PROFILE.version).toBe('1.3.0');
    const ids = ETIQUETTE_PROFILE.rules.map((rule) => rule.id);
    expect(ids).toContain('evt-subproc-flow');
    expect(ids).toContain('evt-subproc-start');
  });
});
