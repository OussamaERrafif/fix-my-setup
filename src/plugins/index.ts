import type { DiagnosticPlugin } from '../types/index.js';
import { PluginRegistry } from '../core/plugin-registry.js';
import { systemPlugin } from './system/index.js';
import { nodePlugin } from './node/index.js';
import { gitPlugin } from './git/index.js';
import { pythonPlugin } from './python/index.js';
import { javaPlugin } from './java/index.js';
import { portsPlugin } from './ports/index.js';
import { environmentPlugin } from './environment/index.js';

/** All built-in plugins, in the order they should run and display. */
export const builtinPlugins: readonly DiagnosticPlugin[] = [
  systemPlugin,
  nodePlugin,
  gitPlugin,
  pythonPlugin,
  javaPlugin,
  environmentPlugin,
  portsPlugin,
];

/** Create a registry pre-loaded with all built-in plugins. */
export function createDefaultRegistry(): PluginRegistry {
  return new PluginRegistry().registerAll(builtinPlugins);
}

export {
  systemPlugin,
  nodePlugin,
  gitPlugin,
  pythonPlugin,
  javaPlugin,
  portsPlugin,
  environmentPlugin,
};
