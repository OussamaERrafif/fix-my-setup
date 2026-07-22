import type { DiagnosticPlugin, Platform } from '../types/index.js';

/**
 * A tiny in-memory registry of diagnostic plugins.
 *
 * The registry is intentionally minimal: register plugins, list them, and
 * filter by platform/category. Community/remote plugin loading is out of
 * scope for the MVP (see docs/plugins.md for the proposed model).
 */
export class PluginRegistry {
  private readonly plugins = new Map<string, DiagnosticPlugin>();

  /** Register a plugin. Throws on duplicate id to catch wiring mistakes. */
  register(plugin: DiagnosticPlugin): this {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Duplicate plugin id: "${plugin.id}"`);
    }
    this.plugins.set(plugin.id, plugin);
    return this;
  }

  /** Register several plugins at once. */
  registerAll(plugins: readonly DiagnosticPlugin[]): this {
    for (const plugin of plugins) this.register(plugin);
    return this;
  }

  has(id: string): boolean {
    return this.plugins.has(id);
  }

  get(id: string): DiagnosticPlugin | undefined {
    return this.plugins.get(id);
  }

  /** All registered plugins, in registration order. */
  list(): DiagnosticPlugin[] {
    return [...this.plugins.values()];
  }

  /** All distinct categories, sorted for deterministic output. */
  categories(): string[] {
    return [...new Set(this.list().map((p) => p.category))].sort();
  }

  /**
   * Plugins that should run for this platform and (optional) category filter.
   */
  select(platform: Platform, category?: string): DiagnosticPlugin[] {
    return this.list().filter((plugin) => {
      const platformOk = !plugin.supportedPlatforms || plugin.supportedPlatforms.includes(platform);
      const categoryOk = !category || plugin.category === category;
      return platformOk && categoryOk;
    });
  }
}
