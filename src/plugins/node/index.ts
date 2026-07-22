import { delimiter, join } from 'node:path';
import type {
  DiagnosticContext,
  DiagnosticPlugin,
  DiagnosticResult,
  SuggestedFix,
} from '../../types/index.js';
import { getToolVersion, parsePath } from '../util.js';

/** Node versions below this are treated as unsupported (End-of-Life). */
const MIN_SUPPORTED_MAJOR = 18;
/** Node versions below this get a soft warning (approaching/at EOL). */
const RECOMMENDED_MAJOR = 20;

/**
 * Node.js / npm diagnostics — the core of Fix My Setup.
 *
 * Covers presence and version of node/npm/npx, whether npm's global bin
 * directory is on PATH, cache accessibility, registry reachability, and a set
 * of project-level checks (node_modules, lockfiles, declared packageManager).
 */
export const nodePlugin: DiagnosticPlugin = {
  id: 'node',
  name: 'Node.js & npm',
  category: 'Node.js',
  async detect(context: DiagnosticContext): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];

    const nodeResult = await checkNode(context);
    results.push(nodeResult.result);

    const npmResult = await checkNpm(context);
    results.push(npmResult.result);

    results.push(await checkNpx(context));

    // Only run npm-config-dependent checks when npm is actually available.
    if (npmResult.available) {
      results.push(await checkGlobalBinOnPath(context));
      results.push(await checkNpmCache(context));
      if (context.network) {
        results.push(await checkRegistry(context));
      } else {
        results.push({
          id: 'node.registry',
          name: 'npm registry',
          status: 'info',
          message: 'Skipped npm registry check (--no-network)',
        });
      }
    }

    results.push(...checkProject(context));

    return results;
  },
};

async function checkNode(
  context: DiagnosticContext,
): Promise<{ result: DiagnosticResult; available: boolean }> {
  const node = await getToolVersion(context, 'node', ['--version']);
  if (!node.found || !node.version) {
    return {
      available: false,
      result: {
        id: 'node.installed',
        name: 'Node.js',
        status: 'error',
        message: 'Node.js is not installed or not on PATH',
        suggestedFixes: [installNodeFix()],
      },
    };
  }

  const major = parseInt(node.version.split('.')[0] ?? '0', 10);
  if (major < MIN_SUPPORTED_MAJOR) {
    return {
      available: true,
      result: {
        id: 'node.version',
        name: 'Node.js version',
        status: 'error',
        message: `Node.js ${node.version} is unsupported (End-of-Life)`,
        details: [
          `Node.js ${MIN_SUPPORTED_MAJOR}+ is required; ${RECOMMENDED_MAJOR}+ recommended.`,
        ],
        suggestedFixes: [installNodeFix()],
      },
    };
  }
  if (major < RECOMMENDED_MAJOR) {
    return {
      available: true,
      result: {
        id: 'node.version',
        name: 'Node.js version',
        status: 'warning',
        message: `Node.js ${node.version} is nearing End-of-Life`,
        details: [`Consider upgrading to Node.js ${RECOMMENDED_MAJOR} LTS or newer.`],
        suggestedFixes: [installNodeFix()],
      },
    };
  }
  return {
    available: true,
    result: {
      id: 'node.version',
      name: 'Node.js',
      status: 'success',
      message: `Node.js detected: ${node.version}`,
    },
  };
}

async function checkNpm(
  context: DiagnosticContext,
): Promise<{ result: DiagnosticResult; available: boolean }> {
  const npm = await getToolVersion(context, 'npm', ['--version']);
  if (!npm.found || !npm.version) {
    return {
      available: false,
      result: {
        id: 'node.npm',
        name: 'npm',
        status: 'error',
        message: 'npm is not available',
        details: ['npm normally ships with Node.js. Reinstalling Node.js usually restores it.'],
        suggestedFixes: [installNodeFix()],
      },
    };
  }
  return {
    available: true,
    result: {
      id: 'node.npm',
      name: 'npm',
      status: 'success',
      message: `npm detected: ${npm.version}`,
    },
  };
}

async function checkNpx(context: DiagnosticContext): Promise<DiagnosticResult> {
  const npx = await getToolVersion(context, 'npx', ['--version']);
  if (!npx.found) {
    return {
      id: 'node.npx',
      name: 'npx',
      status: 'warning',
      message: 'npx is not available',
      details: ['npx ships with npm 5.2+. Reinstalling Node.js/npm usually restores it.'],
    };
  }
  return {
    id: 'node.npx',
    name: 'npx',
    status: 'success',
    message: `npx detected: ${npx.version}`,
  };
}

async function checkGlobalBinOnPath(context: DiagnosticContext): Promise<DiagnosticResult> {
  const prefixResult = await context.runCommand('npm', ['prefix', '-g']);
  const prefix = prefixResult.stdout.trim();
  if (!prefix) {
    return {
      id: 'node.global-bin',
      name: 'npm global bin on PATH',
      status: 'info',
      message: 'Could not determine npm global prefix',
    };
  }

  // On Windows global executables live in the prefix itself; on POSIX in bin/.
  const globalBin = context.platform === 'windows' ? prefix : `${prefix.replace(/\/+$/, '')}/bin`;
  const norm = (p: string): string => normalizeForCompare(p, context.platform);
  const pathEntries = parsePath(context.env.PATH ?? context.env.Path, context.platform).map(norm);
  const onPath = pathEntries.includes(norm(globalBin));

  if (onPath) {
    return {
      id: 'node.global-bin',
      name: 'npm global bin on PATH',
      status: 'success',
      message: 'npm global binary directory is on PATH',
    };
  }
  return {
    id: 'node.global-bin',
    name: 'npm global bin on PATH',
    status: 'error',
    message: 'npm global directory is missing from PATH',
    details: [`Global binaries are installed to: ${globalBin}`],
    suggestedFixes: [addToPathFix(globalBin)],
  };
}

async function checkNpmCache(context: DiagnosticContext): Promise<DiagnosticResult> {
  const cacheResult = await context.runCommand('npm', ['config', 'get', 'cache']);
  const cacheDir = cacheResult.stdout.trim();
  if (!cacheDir || cacheDir === 'undefined') {
    return {
      id: 'node.cache',
      name: 'npm cache',
      status: 'info',
      message: 'Could not determine npm cache directory',
    };
  }
  if (!context.fs.exists(cacheDir)) {
    return {
      id: 'node.cache',
      name: 'npm cache',
      status: 'warning',
      message: 'npm cache directory does not exist yet',
      details: [`Expected at: ${cacheDir}`, 'It is created automatically on first use.'],
    };
  }
  if (!context.fs.canAccess(cacheDir)) {
    return {
      id: 'node.cache',
      name: 'npm cache',
      status: 'error',
      message: 'npm cache directory cannot be accessed',
      details: [`Path: ${cacheDir}`, 'This is often a permissions problem.'],
    };
  }
  return {
    id: 'node.cache',
    name: 'npm cache',
    status: 'success',
    message: 'npm cache directory is accessible',
  };
}

async function checkRegistry(context: DiagnosticContext): Promise<DiagnosticResult> {
  const registryResult = await context.runCommand('npm', ['config', 'get', 'registry']);
  const registry = registryResult.stdout.trim() || 'https://registry.npmjs.org/';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(registry, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timer);
    if (response.ok || response.status === 405 || response.status === 404) {
      return {
        id: 'node.registry',
        name: 'npm registry',
        status: 'success',
        message: `npm registry is reachable (${registry})`,
      };
    }
    return {
      id: 'node.registry',
      name: 'npm registry',
      status: 'warning',
      message: `npm registry returned HTTP ${response.status}`,
      details: [`Registry: ${registry}`],
    };
  } catch (error) {
    return {
      id: 'node.registry',
      name: 'npm registry',
      status: 'error',
      message: 'npm registry is unreachable',
      details: [`Registry: ${registry}`, error instanceof Error ? error.message : String(error)],
    };
  }
}

const LOCKFILES: Record<string, string> = {
  'package-lock.json': 'npm',
  'yarn.lock': 'yarn',
  'pnpm-lock.yaml': 'pnpm',
  'bun.lockb': 'bun',
};

/** Project-level Node checks that do not require running npm. */
function checkProject(context: DiagnosticContext): DiagnosticResult[] {
  const results: DiagnosticResult[] = [];
  const pkgPath = join(context.cwd, 'package.json');
  if (!context.fs.exists(pkgPath)) {
    // Not in a Node project — nothing project-specific to report.
    return results;
  }

  const pkg = readPackageJson(context, pkgPath);
  const hasDeps = pkg
    ? Object.keys(pkg.dependencies ?? {}).length + Object.keys(pkg.devDependencies ?? {}).length > 0
    : false;
  const nodeModulesExists = context.fs.isDirectory(join(context.cwd, 'node_modules'));

  if (hasDeps && !nodeModulesExists) {
    results.push({
      id: 'node.node-modules',
      name: 'Installed dependencies',
      status: 'error',
      message: 'package.json declares dependencies but node_modules is missing',
      details: ['Dependencies have not been installed in this project.'],
      suggestedFixes: [installDepsFix()],
    });
  } else if (nodeModulesExists) {
    results.push({
      id: 'node.node-modules',
      name: 'Installed dependencies',
      status: 'success',
      message: 'node_modules is present',
    });
  }

  // Multiple lockfiles from different package managers.
  const presentLockfiles = Object.keys(LOCKFILES).filter((f) =>
    context.fs.exists(join(context.cwd, f)),
  );
  if (presentLockfiles.length > 1) {
    results.push({
      id: 'node.lockfiles',
      name: 'Lock files',
      status: 'warning',
      message: `Multiple package-manager lock files found: ${presentLockfiles.join(', ')}`,
      details: ['Mixing package managers can cause inconsistent installs. Keep just one.'],
    });
  }

  // Declared packageManager unavailable.
  if (pkg?.packageManager) {
    const managerName = String(pkg.packageManager).split('@')[0];
    if (managerName && managerName !== 'npm') {
      results.push({
        id: 'node.package-manager',
        name: 'Declared package manager',
        status: 'info',
        message: `Project declares packageManager: ${pkg.packageManager}`,
        details: [`Ensure "${managerName}" is installed (e.g. via corepack enable).`],
      });
    }
  }

  return results;
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  packageManager?: string;
}

function readPackageJson(context: DiagnosticContext, path: string): PackageJson | null {
  const raw = context.fs.readFile(path);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PackageJson;
  } catch {
    return null;
  }
}

function normalizeForCompare(p: string, platform: DiagnosticContext['platform']): string {
  // Compare using forward slashes; Windows paths are case-insensitive.
  let out = p.replace(/\\/g, '/').replace(/\/+$/, '');
  if (platform === 'windows') out = out.toLowerCase();
  return out;
}

// --- Suggested fixes -------------------------------------------------------

function installNodeFix(): SuggestedFix {
  return {
    title: 'Install a supported Node.js version',
    explanation: 'Install Node.js 20 LTS or newer. Using a version manager makes upgrades easy.',
    risk: 'manual',
    canApplyAutomatically: false,
    commands: {
      macos: ['brew install node', '# or: nvm install --lts'],
      linux: ['# Using nvm:', 'nvm install --lts', 'nvm use --lts'],
      windows: ['winget install OpenJS.NodeJS.LTS', '# or download from https://nodejs.org'],
    },
  };
}

function addToPathFix(dir: string): SuggestedFix {
  return {
    title: 'Add the npm global directory to your PATH',
    explanation:
      'Globally-installed CLI tools live here. Adding it to PATH lets you run them by name.',
    risk: 'caution',
    canApplyAutomatically: false,
    commands: {
      macos: [`echo 'export PATH="${dir}:$PATH"' >> ~/.zshrc`, 'source ~/.zshrc'],
      linux: [`echo 'export PATH="${dir}:$PATH"' >> ~/.bashrc`, 'source ~/.bashrc'],
      windows: [`setx PATH "${dir}${delimiter}%PATH%"`],
    },
  };
}

function installDepsFix(): SuggestedFix {
  return {
    title: 'Install project dependencies',
    explanation: 'Run your package manager’s install command to populate node_modules.',
    risk: 'safe',
    canApplyAutomatically: false,
    commands: {
      macos: ['npm install'],
      linux: ['npm install'],
      windows: ['npm install'],
    },
  };
}
