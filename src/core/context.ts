import { homedir } from 'node:os';
import type { DiagnosticContext, DiagnosticFs, RunOptions } from '../types/index.js';
import { detectPlatform, runCommand, which } from './exec.js';
import { realFs } from './fs.js';

export interface BuildContextOptions {
  options: RunOptions;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  fs?: DiagnosticFs;
}

/** Assemble the real {@link DiagnosticContext} used when the CLI runs. */
export function buildContext({
  options,
  cwd = process.cwd(),
  env = process.env,
  fs = realFs,
}: BuildContextOptions): DiagnosticContext {
  const platform = detectPlatform();
  return {
    platform,
    cwd,
    env,
    homeDir: homedir(),
    options,
    network: options.network,
    fs,
    runCommand,
    which: async (binary) => which(binary, platform, env.PATH ?? '', env.PATHEXT),
  };
}
