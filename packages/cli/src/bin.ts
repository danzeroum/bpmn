#!/usr/bin/env node
import {
  diffCommand,
  exportCommand,
  formatDiff,
  formatValidation,
  validateCommand,
} from './index.js';

const USAGE = `bpmn-react — headless BPMN diagram tooling

Usage:
  bpmn-react validate <file.(json|xml|bpmn)>
  bpmn-react export <input> --to <xml|json> [-o <output>]
  bpmn-react diff <fileA> <fileB>

Exit codes: 0 ok · 1 validation errors or differences found · 2 usage/parse error`;

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
      default:
        return usage();
    }
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    return 2;
  }
}

function valueOf(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function usage(): number {
  console.error(USAGE);
  return 2;
}

process.exitCode = await main(process.argv.slice(2));
