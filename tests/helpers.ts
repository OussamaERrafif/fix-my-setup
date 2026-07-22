import type {
  CommandResult,
  DiagnosticContext,
  DiagnosticFs,
  Platform,
  RunOptions,
} from '../src/types/index.js';

export function makeOptions(overrides: Partial<RunOptions> = {}): RunOptions {
  return {
    safe: false,
    apply: false,
    json: false,
    verbose: false,
    category: undefined,
    ports: [],
    network: true,
    reportPath: undefined,
    yes: false,
    ...overrides,
  };
}

/** Build an in-memory {@link DiagnosticFs} from a path->content map. */
export function makeFs(files: Record<string, string>, dirs: string[] = []): DiagnosticFs {
  const norm = (p: string): string => p.replace(/\\/g, '/');
  const fileMap = new Map(Object.entries(files).map(([k, v]) => [norm(k), v]));
  const dirSet = new Set(dirs.map(norm));
  return {
    exists: (p) => fileMap.has(norm(p)) || dirSet.has(norm(p)),
    readFile: (p) => fileMap.get(norm(p)) ?? null,
    readDir: (p) => (dirSet.has(norm(p)) ? [] : null),
    isDirectory: (p) => dirSet.has(norm(p)),
    canAccess: (p) => fileMap.has(norm(p)) || dirSet.has(norm(p)),
  };
}

export interface FakeContextOptions {
  platform?: Platform;
  cwd?: string;
  homeDir?: string;
  env?: NodeJS.ProcessEnv;
  options?: Partial<RunOptions>;
  fs?: DiagnosticFs;
  /** Map "binary arg1 arg2" -> CommandResult. Missing => spawnError. */
  commands?: Record<string, Partial<CommandResult>>;
  /** Set of binaries considered on PATH for `which`. */
  onPath?: string[];
}

const NOT_FOUND: CommandResult = { code: null, stdout: '', stderr: '', spawnError: 'ENOENT' };

/** Build a fully-stubbed {@link DiagnosticContext} for unit tests. */
export function makeContext(opts: FakeContextOptions = {}): DiagnosticContext {
  const platform = opts.platform ?? 'linux';
  const options = makeOptions(opts.options);
  const commands = opts.commands ?? {};
  const onPath = new Set(opts.onPath ?? []);

  return {
    platform,
    cwd: opts.cwd ?? '/project',
    homeDir: opts.homeDir ?? '/home/dev',
    env: opts.env ?? {},
    options,
    network: options.network,
    fs: opts.fs ?? makeFs({}),
    async runCommand(command, args) {
      const key = [command, ...args].join(' ');
      const stub = commands[key];
      if (!stub) return NOT_FOUND;
      return { code: 0, stdout: '', stderr: '', ...stub };
    },
    async which(binary) {
      return onPath.has(binary) ? `/usr/bin/${binary}` : null;
    },
  };
}
