import { describe, expect, it } from 'vitest';
import { PluginRegistry } from '../src/core/plugin-registry.js';
import { createDefaultRegistry } from '../src/plugins/index.js';
import type { DiagnosticPlugin } from '../src/types/index.js';

const winOnly: DiagnosticPlugin = {
  id: 'win',
  name: 'win',
  category: 'Windows',
  supportedPlatforms: ['windows'],
  detect: async () => [],
};
const anyPlatform: DiagnosticPlugin = {
  id: 'any',
  name: 'any',
  category: 'Any',
  detect: async () => [],
};

describe('PluginRegistry', () => {
  it('registers and lists plugins in order', () => {
    const registry = new PluginRegistry().registerAll([anyPlatform, winOnly]);
    expect(registry.list().map((p) => p.id)).toEqual(['any', 'win']);
  });

  it('throws on duplicate ids', () => {
    const registry = new PluginRegistry().register(anyPlatform);
    expect(() => registry.register(anyPlatform)).toThrow(/Duplicate plugin id/);
  });

  it('filters by platform', () => {
    const registry = new PluginRegistry().registerAll([anyPlatform, winOnly]);
    expect(registry.select('linux').map((p) => p.id)).toEqual(['any']);
    expect(registry.select('windows').map((p) => p.id)).toEqual(['any', 'win']);
  });

  it('filters by category', () => {
    const registry = new PluginRegistry().registerAll([anyPlatform, winOnly]);
    expect(registry.select('windows', 'Windows').map((p) => p.id)).toEqual(['win']);
  });

  it('exposes sorted distinct categories', () => {
    const registry = new PluginRegistry().registerAll([winOnly, anyPlatform]);
    expect(registry.categories()).toEqual(['Any', 'Windows']);
  });
});

describe('createDefaultRegistry', () => {
  it('registers all built-in plugins', () => {
    const registry = createDefaultRegistry();
    const ids = registry.list().map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining(['system', 'node', 'git', 'python', 'java', 'ports', 'environment']),
    );
  });
});
