import type {
  DiagnosticContext,
  DiagnosticPlugin,
  DiagnosticResult,
  Platform,
  SuggestedFix,
} from '../../types/index.js';

export interface PortOwner {
  pid: number;
  name?: string;
}

/**
 * Port diagnostics. Runs only when the user passes one or more `--port`
 * options. For each port it reports whether it is free, and if occupied, which
 * PID/process holds it plus a platform-specific command to stop it (never run
 * automatically).
 */
export const portsPlugin: DiagnosticPlugin = {
  id: 'ports',
  name: 'Ports',
  category: 'Ports',
  async detect(context: DiagnosticContext): Promise<DiagnosticResult[]> {
    const ports = context.options.ports;
    if (ports.length === 0) return [];

    const results: DiagnosticResult[] = [];
    for (const port of ports) {
      results.push(await checkPort(context, port));
    }
    return results;
  },
};

async function checkPort(context: DiagnosticContext, port: number): Promise<DiagnosticResult> {
  const owner = await findPortOwner(context, port);
  if (!owner) {
    return {
      id: `ports.${port}`,
      name: `Port ${port}`,
      status: 'success',
      message: `Port ${port} is available`,
    };
  }

  const who = owner.name ? `${owner.name} (PID ${owner.pid})` : `PID ${owner.pid}`;
  return {
    id: `ports.${port}`,
    name: `Port ${port}`,
    status: 'warning',
    message: `Port ${port} is currently occupied by ${who}`,
    suggestedFixes: [stopProcessFix(context.platform, owner.pid)],
  };
}

async function findPortOwner(context: DiagnosticContext, port: number): Promise<PortOwner | null> {
  if (context.platform === 'windows') {
    const netstat = await context.runCommand('netstat', ['-ano', '-p', 'TCP']);
    const pid = parseNetstat(netstat.stdout, port);
    if (pid === null) return null;
    const tasklist = await context.runCommand('tasklist', [
      '/FI',
      `PID eq ${pid}`,
      '/FO',
      'CSV',
      '/NH',
    ]);
    return { pid, name: parseTasklist(tasklist.stdout) };
  }

  // macOS / Linux
  const lsof = await context.runCommand('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fpcn']);
  if (lsof.spawnError) {
    // lsof not installed; fail gracefully as "unknown".
    return null;
  }
  return parseLsof(lsof.stdout);
}

/** Parse Windows `netstat -ano` output for the PID listening on `port`. */
export function parseNetstat(output: string, port: number): number | null {
  const lines = output.split(/\r?\n/);
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    // Format: Proto  Local Address  Foreign Address  State  PID
    if (parts.length < 5) continue;
    const localAddress = parts[1] ?? '';
    const state = parts[3] ?? '';
    if (state !== 'LISTENING') continue;
    const localPort = localAddress.split(':').pop();
    if (localPort === String(port)) {
      const pid = parseInt(parts[parts.length - 1] ?? '', 10);
      if (!Number.isNaN(pid)) return pid;
    }
  }
  return null;
}

/** Parse the first process name from `tasklist /FO CSV /NH` output. */
export function parseTasklist(output: string): string | undefined {
  const firstLine = output.split(/\r?\n/).find((l) => l.trim().length > 0);
  if (!firstLine) return undefined;
  const match = firstLine.match(/^"([^"]+)"/);
  return match ? match[1] : undefined;
}

/** Parse `lsof -F pcn` output into a {@link PortOwner}. */
export function parseLsof(output: string): PortOwner | null {
  let pid: number | null = null;
  let name: string | undefined;
  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith('p')) {
      const parsed = parseInt(line.slice(1), 10);
      if (!Number.isNaN(parsed)) pid = parsed;
    } else if (line.startsWith('c')) {
      name = line.slice(1);
    }
  }
  return pid === null ? null : { pid, name };
}

function stopProcessFix(platform: Platform, pid: number): SuggestedFix {
  return {
    title: `Stop the process using this port (PID ${pid})`,
    explanation:
      'Only stop this process if you recognize it. Fix My Setup never stops processes for you.',
    risk: 'caution',
    canApplyAutomatically: false,
    commands: {
      windows: [`taskkill /PID ${pid} /F`],
      macos: [`kill -15 ${pid}`, `# force if needed: kill -9 ${pid}`],
      linux: [`kill -15 ${pid}`, `# force if needed: kill -9 ${pid}`],
    },
  };
}
