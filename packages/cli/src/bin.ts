#!/usr/bin/env node
import { BpmnLifecycleError, type VersionStatus } from '@buildtovalue/core';
import {
  approveCommand,
  assuranceCaseCommand,
  auditCommand,
  certifyCommand,
  diffCommand,
  exportCommand,
  exportXesCommand,
  formatAudit,
  formatCertify,
  formatDiff,
  formatEntry,
  formatHistory,
  formatValidation,
  promoteCommand,
  registryActiveCommand,
  registryAddCommand,
  registryBindRunCommand,
  registryDiffCommand,
  registryHistoryCommand,
  registryPublishCommand,
  validateCommand,
} from './index.js';

const USAGE = `bpmn-react — headless BPMN diagram tooling

Usage:
  bpmn-react validate <file.(json|xml|bpmn)>
  bpmn-react certify <file.bpmn> [--json] [--strict] [--require <descriptive|analytic>] [--report <path.json>]
  bpmn-react certify <file.bpmn> --assurance-case <out.html> [--ledger <ledger.json>] [--sacm-version <label>]
  bpmn-react audit <ledger.json> [--json]
  bpmn-react export-xes <ledger.json> [--registry <registry.json>] [-o <log.xes>]
  bpmn-react export <input> --to <xml|json> [-o <output>]
  bpmn-react diff <fileA> <fileB>

  bpmn-react approve <diagram.json> --actor-id <id> --actor-role <role> --reason <text> [-o <output>]
  bpmn-react promote <diagram.json> --to <status> --actor-id <id> --actor-role <role> --reason <text> [-o <output>] [--registry <registry.json>]

  bpmn-react registry add <diagram> --to <registry.json> [--notes <text>]
  bpmn-react registry history <registry.json>
  bpmn-react registry publish <registry.json> --version <id> --channel <ch> [--environment <env>] [--status <status>] [--at <iso>] [--by <who>]
  bpmn-react registry active <registry.json> --at <iso> [--channel <ch>] [--environment <env>]
  bpmn-react registry diff <registry.json> --from <versionId> --to <versionId>
  bpmn-react registry bind-run <registry.json> --version <id> [--channel <ch>] [--environment <env>] [--run-id <id>]

certify --strict: turns the STRUCTURAL pass into a gate (exit 1 on violations).
It validates against the structural manifest distilled from the official
BPMN20/Semantic XSDs (required attributes + legal parents of the supported
profile) — it is NOT full XSD validation (see CONFORMANCE.md). --xsd is
reserved and rejected until a real XSD validator exists.

Exit codes: 0 ok · 1 check failed (validation errors, differences, governance gate) · 2 usage/parse error`;

async function runRegistry(rest: string[]): Promise<number> {
  const [sub, ...args] = rest;
  const file = args.find((a) => !a.startsWith('-'));
  switch (sub) {
    case 'add': {
      const to = valueOf(args, '--to');
      if (!file || !to) return usage();
      const entry = await registryAddCommand(file, to, notes(valueOf(args, '--notes')));
      console.log(`Registered ${formatEntry(entry)}`);
      return 0;
    }
    case 'history': {
      if (!file) return usage();
      console.log(formatHistory(await registryHistoryCommand(file)));
      return 0;
    }
    case 'publish': {
      const versionId = valueOf(args, '--version');
      const channel = valueOf(args, '--channel');
      if (!file || !versionId || !channel) return usage();
      const pub = await registryPublishCommand(file, {
        versionId,
        channel,
        ...opt('environment', valueOf(args, '--environment')),
        ...(valueOf(args, '--status') ? { status: valueOf(args, '--status') as VersionStatus } : {}),
        ...opt('effectiveFrom', valueOf(args, '--at')),
        ...opt('publishedBy', valueOf(args, '--by')),
      });
      console.log(
        `Published ${pub.versionId} to ${pub.channel}${pub.environment ? `/${pub.environment}` : ''} as ${pub.status} (from ${pub.effectiveFrom})`,
      );
      return 0;
    }
    case 'active': {
      const at = valueOf(args, '--at');
      if (!file || !at) return usage();
      const entry = await registryActiveCommand(file, {
        at,
        ...opt('channel', valueOf(args, '--channel')),
        ...opt('environment', valueOf(args, '--environment')),
      });
      if (!entry) {
        console.log('No version in effect at that time.');
        return 1;
      }
      console.log(formatEntry(entry));
      return 0;
    }
    case 'diff': {
      const from = valueOf(args, '--from');
      const to = valueOf(args, '--to');
      if (!file || !from || !to) return usage();
      const text = await registryDiffCommand(file, from, to);
      console.log(text);
      return text === 'No changes.' ? 0 : 1;
    }
    case 'bind-run': {
      const versionId = valueOf(args, '--version');
      if (!file || !versionId) return usage();
      const run = await registryBindRunCommand(file, {
        versionId,
        ...opt('channel', valueOf(args, '--channel')),
        ...opt('environment', valueOf(args, '--environment')),
        ...opt('runId', valueOf(args, '--run-id')),
      });
      console.log(JSON.stringify(run, null, 2));
      return 0;
    }
    default:
      return usage();
  }
}

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  try {
    switch (command) {
      case 'validate': {
        const [file] = rest;
        if (!file) return usage();
        const { result, warnings } = await validateCommand(file);
        for (const warning of warnings) console.warn(`⚠ import: ${warning}`);
        console.log(formatValidation(result));
        return result.valid ? 0 : 1;
      }
      case 'export': {
        const file = rest.find((a) => !a.startsWith('-'));
        const to = valueOf(rest, '--to') as 'xml' | 'json' | undefined;
        const output = valueOf(rest, '-o') ?? valueOf(rest, '--output');
        if (!file || (to !== 'xml' && to !== 'json')) return usage();
        const content = await exportCommand(file, to, output);
        if (!output) console.log(content);
        else console.log(`Written to ${output}`);
        return 0;
      }
      case 'diff': {
        const [a, b] = rest;
        if (!a || !b) return usage();
        const diff = await diffCommand(a, b);
        const text = formatDiff(diff);
        console.log(text);
        return text === 'No changes.' ? 0 : 1;
      }
      case 'approve': {
        const file = rest.find((a) => !a.startsWith('-'));
        const actor = actorFrom(rest);
        if (!file || !actor) return usage();
        await approveCommand(file, { ...actor, ...opt('output', valueOf(rest, '-o') ?? valueOf(rest, '--output')) });
        console.log(`Approved by ${actor.actorRole} (${actor.actorId})`);
        return 0;
      }
      case 'promote': {
        const file = rest.find((a) => !a.startsWith('-'));
        const to = valueOf(rest, '--to') as VersionStatus | undefined;
        const actor = actorFrom(rest);
        if (!file || !to || !actor) return usage();
        try {
          const promoted = await promoteCommand(file, {
            ...actor,
            to,
            ...opt('output', valueOf(rest, '-o') ?? valueOf(rest, '--output')),
            ...opt('registryPath', valueOf(rest, '--registry')),
          });
          console.log(`Promoted to ${promoted.version.status} (v${promoted.version.semanticVersion})`);
          return 0;
        } catch (error) {
          if (error instanceof BpmnLifecycleError) {
            console.error(`Governance gate: ${error.message}`);
            return 1;
          }
          throw error;
        }
      }
      case 'certify': {
        const file = rest.find((a) => !a.startsWith('-'));
        const require = valueOf(rest, '--require');
        if (!file) return usage();
        if (require !== undefined && require !== 'descriptive' && require !== 'analytic') {
          return usage();
        }
        // F-C3: print-ready SACM assurance case, 100% derived from the
        // ledger + promotion approvals (aceite 10.5.8).
        const assurancePath = valueOf(rest, '--assurance-case');
        if (assurancePath) {
          const ledgerPath = valueOf(rest, '--ledger');
          const sacmVersion = valueOf(rest, '--sacm-version');
          const outcome = await assuranceCaseCommand(file, assurancePath, {
            ...(ledgerPath ? { ledger: ledgerPath } : {}),
            ...(sacmVersion ? { sacmVersion } : {}),
          });
          console.log(
            `Assurance case (${outcome.claims} claims) → ${assurancePath} · cadeia ${
              outcome.intact ? 'íntegra' : 'QUEBRADA'
            } · ${outcome.supported ? 'todos os claims sustentados' : 'há claims NÃO sustentados'}`,
          );
          return outcome.intact && outcome.supported ? 0 : 1;
        }
        // N-2 honesty rule: --xsd would claim validation we do not perform.
        if (rest.includes('--xsd')) {
          console.error(
            'certify: --xsd é reservado — não há validador XSD integral. Use --strict ' +
              '(gate sobre o manifesto estrutural derivado dos XSDs oficiais); a diferença ' +
              'está documentada no CONFORMANCE.md.',
          );
          return 2;
        }
        const strict = rest.includes('--strict');
        const reportPath = valueOf(rest, '--report');
        const report = await certifyCommand(file, {
          ...(require ? { require } : {}),
          ...(reportPath ? { report: reportPath } : {}),
        });
        if (rest.includes('--json')) console.log(JSON.stringify(report, null, 2));
        else console.log(formatCertify(report, reportPath, { strict }));
        if (!report.wellFormed) return 2;
        // --strict: structural manifest violations gate the exit code (N-2).
        if (strict && report.structuralIssues.length > 0) return 1;
        return report.requirementMet === false ? 1 : 0;
      }
      case 'audit': {
        const file = rest.find((a) => !a.startsWith('-'));
        if (!file) return usage();
        const report = await auditCommand(file);
        if (rest.includes('--json')) console.log(JSON.stringify(report, null, 2));
        else console.log(formatAudit(report));
        return report.intact ? 0 : 1;
      }
      case 'export-xes': {
        const file = rest.find((a) => !a.startsWith('-'));
        if (!file) return usage();
        const output = valueOf(rest, '-o') ?? valueOf(rest, '--output');
        const xes = await exportXesCommand(file, {
          ...opt('registryPath', valueOf(rest, '--registry')),
          ...opt('output', output),
        });
        if (!output) console.log(xes);
        else console.log(`Written to ${output}`);
        return 0;
      }
      case 'registry':
        return await runRegistry(rest);
      default:
        return usage();
    }
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    return 2;
  }
}

function actorFrom(args: string[]): { actorId: string; actorRole: string; reason: string } | undefined {
  const actorId = valueOf(args, '--actor-id');
  const actorRole = valueOf(args, '--actor-role');
  const reason = valueOf(args, '--reason');
  if (!actorId || !actorRole || reason === undefined) return undefined;
  return { actorId, actorRole, reason };
}

function valueOf(args: string[], flag: string): string | undefined {
  // `--flag=value` form.
  const inline = args.find((arg) => arg.startsWith(`${flag}=`));
  if (inline !== undefined) return inline.slice(flag.length + 1);
  const index = args.indexOf(flag);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`flag ${flag} requires a value`);
  }
  return value;
}

/** Spreads a key only when the value is defined (keeps exactOptional-friendly). */
function opt<K extends string>(key: K, value: string | undefined): Partial<Record<K, string>> {
  return value !== undefined ? ({ [key]: value } as Record<K, string>) : {};
}

function notes(value: string | undefined): { technicalNotes?: string } {
  return value !== undefined ? { technicalNotes: value } : {};
}

function usage(): number {
  console.error(USAGE);
  return 2;
}

process.exitCode = await main(process.argv.slice(2));
