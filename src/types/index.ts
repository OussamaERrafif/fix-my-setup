/**
 * Core type definitions for Fix My Setup.
 *
 * These types form the public contract between the diagnostic runner,
 * the plugins, and the output/report layers. Keep them stable and
 * serialization-friendly (no functions in serialized shapes).
 */

/** Supported operating-system families. */
export type Platform = 'windows' | 'macos' | 'linux';

/** Outcome of a single diagnostic check. */
export type DiagnosticStatus = 'success' | 'warning' | 'error' | 'info';

/** How risky it is to apply a suggested fix automatically. */
export type FixRisk = 'safe' | 'caution' | 'manual';

/**
 * A concrete, human-readable fix suggestion for a diagnostic.
 *
 * `commands` are shown to the user but never executed during diagnosis.
 * Only fixes with `canApplyAutomatically: true` may be run via `--apply`,
 * and only through their registered {@link ApplicableFix} handler.
 */
export interface SuggestedFix {
  title: string;
  explanation: string;
  /** Platform-specific shell commands, shown verbatim (never auto-run). */
  commands?: Partial<Record<Platform, string[]>>;
  risk: FixRisk;
  canApplyAutomatically: boolean;
  /**
   * Optional id linking this suggestion to an {@link ApplicableFix} handler
   * in the fix registry. Required when `canApplyAutomatically` is true.
   */
  applyId?: string;
}

/** Structured result returned by every diagnostic check. */
export interface DiagnosticResult {
  id: string;
  name: string;
  status: DiagnosticStatus;
  message: string;
  details?: string[];
  suggestedFixes?: SuggestedFix[];
}

/** Result of executing an external command. */
export interface CommandResult {
  /** Process exit code, or null if the process was killed / never spawned. */
  code: number | null;
  stdout: string;
  stderr: string;
  /** Populated when the command could not be spawned at all. */
  spawnError?: string;
}

/** Options that can be passed to {@link DiagnosticContext.runCommand}. */
export interface RunCommandOptions {
  timeoutMs?: number;
  cwd?: string;
}

/** Normalized CLI options shared with every plugin. */
export interface RunOptions {
  safe: boolean;
  apply: boolean;
  json: boolean;
  verbose: boolean;
  category?: string;
  ports: number[];
  network: boolean;
  reportPath?: string;
  yes: boolean;
}

/**
 * Execution context handed to every plugin.
 *
 * All OS interaction (command execution, filesystem, environment) flows
 * through this object so plugins stay pure and unit-testable: tests build a
 * fake context with stubbed `runCommand`/`which`/`fs`.
 */
export interface DiagnosticContext {
  platform: Platform;
  cwd: string;
  homeDir: string;
  env: NodeJS.ProcessEnv;
  options: RunOptions;
  /** Whether network-dependent checks are permitted. */
  network: boolean;
  /** Run an external command, capturing stdout/stderr without throwing. */
  runCommand(command: string, args: string[], options?: RunCommandOptions): Promise<CommandResult>;
  /** Resolve an executable on PATH, or null if not found. */
  which(binary: string): Promise<string | null>;
  /** Minimal filesystem surface (injectable for tests). */
  fs: DiagnosticFs;
}

/** The small filesystem surface plugins are allowed to use. */
export interface DiagnosticFs {
  exists(path: string): boolean;
  readFile(path: string): string | null;
  readDir(path: string): string[] | null;
  isDirectory(path: string): boolean;
  canAccess(path: string): boolean;
}

/**
 * A diagnostic plugin. Each plugin owns one category of checks and returns
 * zero or more {@link DiagnosticResult}s. Plugins must never throw for
 * "expected" problems — they report them as results instead. The runner
 * still isolates unexpected throws so one plugin can't break the run.
 */
export interface DiagnosticPlugin {
  id: string;
  name: string;
  category: string;
  supportedPlatforms?: Platform[];
  detect(context: DiagnosticContext): Promise<DiagnosticResult[]>;
}

/** Outcome of an applied fix. */
export interface ApplyResult {
  applied: boolean;
  message: string;
  /** Human-readable summary of what changed (or would change). */
  changes: string[];
}

/**
 * An automatically-applicable fix handler, registered in the fix registry
 * and referenced from a {@link SuggestedFix} via `applyId`.
 */
export interface ApplicableFix {
  id: string;
  risk: FixRisk;
  /** Describe exactly what will change, without changing anything. */
  preview(context: DiagnosticContext): Promise<string[]>;
  /** Perform the change. Only called after preview + confirmation. */
  apply(context: DiagnosticContext): Promise<ApplyResult>;
}

/** Aggregate result of a full diagnostic run. */
export interface RunSummary {
  results: DiagnosticResult[];
  counts: Record<DiagnosticStatus, number>;
  /** Chosen process exit code. */
  exitCode: 0 | 1 | 2 | 3;
  durationMs: number;
}
