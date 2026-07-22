/**
 * Public library surface for Fix My Setup.
 *
 * Importing this package programmatically gives access to the plugin system,
 * runner, and types so you can embed diagnostics in your own tooling.
 */
export * from './types/index.js';
export { PluginRegistry } from './core/plugin-registry.js';
export { DiagnosticRunner, countStatuses, selectExitCode } from './core/diagnostic-runner.js';
export { buildContext } from './core/context.js';
export { Sanitizer } from './core/sanitizer.js';
export { buildReport, type DiagnosticReport } from './core/reporter.js';
export { FixRegistry } from './fixes/registry.js';
export { builtinFixes } from './fixes/builtin.js';
export {
  builtinPlugins,
  createDefaultRegistry,
  systemPlugin,
  nodePlugin,
  gitPlugin,
  pythonPlugin,
  javaPlugin,
  portsPlugin,
  environmentPlugin,
} from './plugins/index.js';
