import { join } from 'node:path';
import type { DiagnosticContext, DiagnosticPlugin, DiagnosticResult } from '../../types/index.js';

export interface EnvEntry {
  key: string;
  /** True when the variable is declared but has an empty value. */
  empty: boolean;
}

/** Result of diffing a `.env` file against a `.env.example` template. */
export interface EnvComparison {
  missing: string[];
  empty: string[];
  present: string[];
}

/**
 * Environment-file diagnostics.
 *
 * Compares `.env` against `.env.example` and reports which required variables
 * are missing or empty. Values are NEVER read into results — only key names.
 * Also flags a `.env` that is not covered by `.gitignore` (a common leak).
 */
export const environmentPlugin: DiagnosticPlugin = {
  id: 'environment',
  name: 'Environment files',
  category: 'Environment',
  async detect(context: DiagnosticContext): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];

    const envPath = join(context.cwd, '.env');
    const examplePath = join(context.cwd, '.env.example');
    const hasEnv = context.fs.exists(envPath);
    const hasExample = context.fs.exists(examplePath);

    if (!hasEnv && !hasExample) {
      // No env files in this project; nothing to report.
      return results;
    }

    if (hasExample && !hasEnv) {
      const required = parseEnvKeys(context.fs.readFile(examplePath) ?? '');
      results.push({
        id: 'environment.missing-env',
        name: '.env file',
        status: 'warning',
        message: '.env.example exists but .env is missing',
        details: [
          `Create a .env with these ${required.length} variable(s): ${required
            .map((e) => e.key)
            .join(', ')}`,
        ],
        suggestedFixes: [
          {
            title: 'Create your .env from the example',
            explanation: 'Copy the template, then fill in real values locally.',
            risk: 'safe',
            canApplyAutomatically: false,
            commands: {
              macos: ['cp .env.example .env'],
              linux: ['cp .env.example .env'],
              windows: ['copy .env.example .env'],
            },
          },
        ],
      });
      return results;
    }

    if (hasEnv && hasExample) {
      const comparison = compareEnv(
        context.fs.readFile(examplePath) ?? '',
        context.fs.readFile(envPath) ?? '',
      );

      for (const key of comparison.missing) {
        results.push({
          id: `environment.missing.${key}`,
          name: `Env var ${key}`,
          status: 'warning',
          message: `.env exists but ${key} is missing`,
        });
      }
      for (const key of comparison.empty) {
        results.push({
          id: `environment.empty.${key}`,
          name: `Env var ${key}`,
          status: 'warning',
          message: `${key} is defined but empty`,
        });
      }
      for (const key of comparison.present) {
        results.push({
          id: `environment.present.${key}`,
          name: `Env var ${key}`,
          status: 'success',
          message: `${key} is defined`,
        });
      }
    } else if (hasEnv) {
      results.push({
        id: 'environment.env',
        name: '.env file',
        status: 'info',
        message: '.env is present (no .env.example to compare against)',
      });
    }

    // Security: warn if .env is not ignored by git.
    results.push(...checkGitignore(context, hasEnv));

    return results;
  },
};

function checkGitignore(context: DiagnosticContext, hasEnv: boolean): DiagnosticResult[] {
  if (!hasEnv) return [];
  const gitignorePath = join(context.cwd, '.gitignore');
  if (!context.fs.exists(gitignorePath)) return [];
  const content = context.fs.readFile(gitignorePath) ?? '';
  const ignored = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .some((line) => line === '.env' || line === '.env*' || line === '*.env');
  if (ignored) return [];
  return [
    {
      id: 'environment.gitignore',
      name: '.env not git-ignored',
      status: 'warning',
      message: '.env exists but is not listed in .gitignore',
      details: ['Committing .env can leak secrets. Add ".env" to your .gitignore.'],
    },
  ];
}

/**
 * Parse `KEY=VALUE` lines into entries, ignoring comments and blanks.
 * Only key names and emptiness are captured — values are discarded.
 */
export function parseEnvKeys(content: string): EnvEntry[] {
  const entries: EnvEntry[] = [];
  const seen = new Set<string>();
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const withoutExport = line.replace(/^export\s+/, '');
    const eq = withoutExport.indexOf('=');
    if (eq <= 0) continue;
    const key = withoutExport.slice(0, eq).trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const value = withoutExport.slice(eq + 1).trim();
    entries.push({ key, empty: stripQuotes(value).length === 0 });
  }
  return entries;
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

/** Diff a `.env` against a `.env.example`, reporting only key names. */
export function compareEnv(exampleContent: string, envContent: string): EnvComparison {
  const required = parseEnvKeys(exampleContent);
  const actual = new Map(parseEnvKeys(envContent).map((e) => [e.key, e]));

  const missing: string[] = [];
  const empty: string[] = [];
  const present: string[] = [];

  for (const entry of required) {
    const found = actual.get(entry.key);
    if (!found) missing.push(entry.key);
    else if (found.empty) empty.push(entry.key);
    else present.push(entry.key);
  }
  return { missing, empty, present };
}
