import { arch, release, userInfo } from 'node:os';
import type { DiagnosticContext, DiagnosticPlugin, DiagnosticResult } from '../../types/index.js';
import { parsePath } from '../util.js';

const PLATFORM_LABELS: Record<string, string> = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
};

/**
 * Reports basic system information: OS, arch, shell, cwd, PATH, and elevated
 * privilege status. These are `info` results (never warnings/errors) unless
 * something is genuinely wrong (e.g. an empty PATH).
 */
export const systemPlugin: DiagnosticPlugin = {
  id: 'system',
  name: 'System',
  category: 'System',
  async detect(context: DiagnosticContext): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];

    results.push({
      id: 'system.os',
      name: 'Operating system',
      status: 'info',
      message: `OS: ${PLATFORM_LABELS[context.platform] ?? context.platform} (${release()})`,
    });

    results.push({
      id: 'system.arch',
      name: 'Architecture',
      status: 'info',
      message: `Architecture: ${arch()}`,
    });

    results.push({
      id: 'system.shell',
      name: 'Shell',
      status: 'info',
      message: `Shell: ${detectShell(context)}`,
    });

    results.push({
      id: 'system.cwd',
      name: 'Working directory',
      status: 'info',
      message: `Working directory: ${context.cwd}`,
    });

    const pathEntries = parsePath(context.env.PATH ?? context.env.Path, context.platform);
    if (pathEntries.length === 0) {
      results.push({
        id: 'system.path',
        name: 'PATH',
        status: 'error',
        message: 'PATH is empty or unset',
        details: ['No directories were found in the PATH environment variable.'],
      });
    } else {
      results.push({
        id: 'system.path',
        name: 'PATH',
        status: 'info',
        message: `PATH contains ${pathEntries.length} entr${pathEntries.length === 1 ? 'y' : 'ies'}`,
        details: pathEntries,
      });
    }

    results.push({
      id: 'system.privileges',
      name: 'Elevated privileges',
      status: 'info',
      message: `Elevated/administrator: ${isElevated(context) ? 'yes' : 'no'}`,
    });

    return results;
  },
};

function detectShell(context: DiagnosticContext): string {
  const { env, platform } = context;
  if (platform === 'windows') {
    if (env.PSModulePath) return 'PowerShell';
    if (env.ComSpec) return env.ComSpec.split(/[\\/]/).pop() ?? 'cmd.exe';
    return 'unknown';
  }
  const shell = env.SHELL;
  return shell ? (shell.split('/').pop() ?? shell) : 'unknown';
}

/**
 * Best-effort elevation detection. On POSIX, uid 0 is root. On Windows we
 * cannot reliably detect elevation without spawning a command, so we report
 * a conservative "no" (informational only — nothing depends on it).
 */
function isElevated(context: DiagnosticContext): boolean {
  if (context.platform === 'windows') return false;
  try {
    return userInfo().uid === 0;
  } catch {
    return false;
  }
}
