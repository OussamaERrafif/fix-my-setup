import type { DiagnosticContext, DiagnosticPlugin, DiagnosticResult } from '../../types/index.js';
import { getToolVersion } from '../util.js';

/**
 * Java diagnostics: the runtime (`java`) and the compiler (`javac`). Both
 * print their version to stderr, which {@link getToolVersion} already merges.
 */
export const javaPlugin: DiagnosticPlugin = {
  id: 'java',
  name: 'Java',
  category: 'Java',
  async detect(context: DiagnosticContext): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];

    const java = await getToolVersion(context, 'java', ['-version']);
    if (!java.found) {
      results.push({
        id: 'java.runtime',
        name: 'Java runtime',
        status: 'info',
        message: 'Java is not installed or not on PATH',
        details: ['Only relevant if this project uses Java.'],
        suggestedFixes: [
          {
            title: 'Install a JDK',
            explanation: 'Install a Java Development Kit (which includes the runtime).',
            risk: 'manual',
            canApplyAutomatically: false,
            commands: {
              macos: ['brew install openjdk'],
              linux: ['sudo apt-get install default-jdk'],
              windows: ['winget install EclipseAdoptium.Temurin.21.JDK'],
            },
          },
        ],
      });
      return results;
    }

    results.push({
      id: 'java.runtime',
      name: 'Java runtime',
      status: 'success',
      message: `Java detected: ${java.version ?? firstLine(java.raw)}`,
    });

    const javac = await getToolVersion(context, 'javac', ['-version']);
    results.push(
      javac.found
        ? {
            id: 'java.compiler',
            name: 'Java compiler',
            status: 'success',
            message: `Java compiler detected: ${javac.version ?? firstLine(javac.raw)}`,
          }
        : {
            id: 'java.compiler',
            name: 'Java compiler',
            status: 'warning',
            message: 'Java runtime found but the compiler (javac) is missing',
            details: ['You likely have a JRE, not a full JDK. Install a JDK to compile Java.'],
          },
    );

    return results;
  },
};

function firstLine(text: string): string {
  return text.split(/\r?\n/)[0] ?? text;
}
