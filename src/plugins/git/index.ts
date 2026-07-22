import { join } from 'node:path';
import type { DiagnosticContext, DiagnosticPlugin, DiagnosticResult } from '../../types/index.js';
import { getToolVersion } from '../util.js';

/**
 * Git diagnostics: whether git is installed and, when inside a repository,
 * a couple of light repo-health signals.
 */
export const gitPlugin: DiagnosticPlugin = {
  id: 'git',
  name: 'Git',
  category: 'Git',
  async detect(context: DiagnosticContext): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];

    const git = await getToolVersion(context, 'git', ['--version']);
    if (!git.found) {
      results.push({
        id: 'git.installed',
        name: 'Git',
        status: 'warning',
        message: 'Git is not installed or not on PATH',
        suggestedFixes: [
          {
            title: 'Install Git',
            explanation: 'Git is required for most development workflows.',
            risk: 'manual',
            canApplyAutomatically: false,
            commands: {
              macos: ['brew install git', '# or: xcode-select --install'],
              linux: ['sudo apt-get install git', '# or your distro’s package manager'],
              windows: ['winget install Git.Git'],
            },
          },
        ],
      });
      return results;
    }

    results.push({
      id: 'git.installed',
      name: 'Git',
      status: 'success',
      message: `Git detected: ${git.version ?? git.raw}`,
    });

    // Repository-level checks only when a .git directory is present.
    const inRepo = context.fs.isDirectory(join(context.cwd, '.git'));
    if (inRepo) {
      const gitignore = context.fs.exists(join(context.cwd, '.gitignore'));
      results.push({
        id: 'git.gitignore',
        name: '.gitignore',
        status: gitignore ? 'success' : 'info',
        message: gitignore ? '.gitignore is present' : 'This repository has no .gitignore file',
      });
    }

    return results;
  },
};
