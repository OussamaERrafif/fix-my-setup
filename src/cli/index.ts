#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Command, Option } from 'commander';
import type { RunOptions } from '../types/index.js';
import { runDoctor } from './run.js';
import { runApply } from './apply.js';
import { createDefaultRegistry } from '../plugins/index.js';
import { createColorizer, supportsColor } from '../output/colors.js';

interface RawOptions {
  safe?: boolean;
  apply?: boolean;
  json?: boolean;
  verbose?: boolean;
  category?: string;
  port?: number[];
  network?: boolean; // commander sets false for --no-network
  report?: string;
  yes?: boolean;
}

function readVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(here, '..', '..', 'package.json'), 'utf8'));
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** Convert commander's raw flags into normalized {@link RunOptions}. */
function toRunOptions(raw: RawOptions): RunOptions {
  return {
    safe: Boolean(raw.safe),
    apply: Boolean(raw.apply),
    json: Boolean(raw.json),
    verbose: Boolean(raw.verbose),
    category: raw.category,
    ports: raw.port ?? [],
    network: raw.network !== false,
    reportPath: raw.report,
    yes: Boolean(raw.yes),
  };
}

function parsePort(value: string, previous: number[] = []): number[] {
  const port = Number.parseInt(value, 10);
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: "${value}" (expected 1–65535)`);
  }
  return [...previous, port];
}

/** Attach the shared diagnostic options to a command. */
function withSharedOptions(command: Command): Command {
  return command
    .option('--safe', 'Explain fixes without changing anything', false)
    .option('--apply', 'Apply only explicitly approved low-risk fixes', false)
    .option('--json', 'Return machine-readable JSON', false)
    .option('--verbose', 'Show additional diagnostic details', false)
    .option('--category <name>', 'Run only one diagnostic category')
    .option('--port <number>', 'Check a specific port (repeatable)', parsePort)
    .addOption(new Option('--no-network', 'Skip checks requiring internet access'))
    .option('--report <path>', 'Save an anonymous diagnostic report')
    .option('--yes', 'Skip confirmation for harmless approved operations', false);
}

async function dispatch(raw: RawOptions): Promise<number> {
  const options = toRunOptions(raw);
  if (options.apply) {
    return runApply(options);
  }
  const outcome = await runDoctor(options);
  return outcome.exitCode;
}

const program = new Command();

program
  .name('fix-my-setup')
  .description('One command to discover why your development setup is broken.')
  .version(readVersion(), '-v, --version', 'Output the version number');

// Default command: `fix-my-setup` with no subcommand runs the doctor.
// Options are declared on both root and subcommands; we read the merged view
// with optsWithGlobals() so a flag is honored no matter which level parsed it.
withSharedOptions(program).action(async (_opts, command: Command) => {
  process.exitCode = await dispatch(command.optsWithGlobals() as RawOptions);
});

withSharedOptions(
  program.command('doctor').description('Run all diagnostics (default command)'),
).action(async (_opts, command: Command) => {
  process.exitCode = await dispatch(command.optsWithGlobals() as RawOptions);
});

program
  .command('list')
  .description('List available diagnostic categories and plugins')
  .action(() => {
    const colors = createColorizer(supportsColor());
    const registry = createDefaultRegistry();
    console.log(colors.bold('Available diagnostics:\n'));
    for (const plugin of registry.list()) {
      const platforms = plugin.supportedPlatforms
        ? ` ${colors.dim('(' + plugin.supportedPlatforms.join(', ') + ')')}`
        : '';
      console.log(`  ${colors.cyan(plugin.category.padEnd(12))} ${plugin.name}${platforms}`);
    }
    console.log('\n' + colors.dim(`Filter with: fix-my-setup --category <name>`));
  });

withSharedOptions(
  program.command('report').description('Run diagnostics and save an anonymized report'),
).action(async (_opts, command: Command) => {
  const raw = command.optsWithGlobals() as RawOptions;
  // Default the report path when the user didn't specify one.
  const withReport: RawOptions = {
    ...raw,
    report: raw.report ?? `fix-my-setup-report-${Date.now()}.json`,
  };
  process.exitCode = await dispatch(withReport);
});

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    // Reserved exit code 3: the tool itself failed.
    const message = error instanceof Error ? error.message : String(error);
    console.error(`fix-my-setup: ${message}`);
    process.exitCode = 3;
  }
}

void main();
