import type { DiagnosticContext, DiagnosticPlugin, DiagnosticResult } from '../../types/index.js';
import { getToolVersion } from '../util.js';

/**
 * Python & pip diagnostics. Tries `python3` first (the modern default), then
 * falls back to `python`. Similarly probes `pip3`/`pip`.
 */
export const pythonPlugin: DiagnosticPlugin = {
  id: 'python',
  name: 'Python & pip',
  category: 'Python',
  async detect(context: DiagnosticContext): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];

    const python = await firstAvailable(context, ['python3', 'python']);
    if (!python) {
      results.push({
        id: 'python.installed',
        name: 'Python',
        status: 'info',
        message: 'Python is not installed or not on PATH',
        details: ['Only relevant if this project uses Python.'],
        suggestedFixes: [
          {
            title: 'Install Python',
            explanation: 'Install Python 3 if your project requires it.',
            risk: 'manual',
            canApplyAutomatically: false,
            commands: {
              macos: ['brew install python'],
              linux: ['sudo apt-get install python3 python3-pip'],
              windows: ['winget install Python.Python.3.12'],
            },
          },
        ],
      });
      return results;
    }

    results.push({
      id: 'python.installed',
      name: 'Python',
      status: 'success',
      message: `Python detected: ${python.version.version ?? python.version.raw} (${python.binary})`,
    });

    const pip = await firstAvailable(context, ['pip3', 'pip']);
    results.push(
      pip
        ? {
            id: 'python.pip',
            name: 'pip',
            status: 'success',
            message: `pip detected: ${pip.version.version ?? pip.version.raw}`,
          }
        : {
            id: 'python.pip',
            name: 'pip',
            status: 'warning',
            message: 'pip is not available',
            details: ['pip usually ships with Python 3. Try: python3 -m ensurepip --upgrade'],
          },
    );

    return results;
  },
};

async function firstAvailable(
  context: DiagnosticContext,
  binaries: string[],
): Promise<{ binary: string; version: Awaited<ReturnType<typeof getToolVersion>> } | null> {
  for (const binary of binaries) {
    const version = await getToolVersion(context, binary, ['--version']);
    if (version.found) return { binary, version };
  }
  return null;
}
