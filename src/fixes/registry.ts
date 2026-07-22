import type { ApplicableFix } from '../types/index.js';

/**
 * Registry of automatically-applicable fixes.
 *
 * Diagnostics reference a fix by `applyId`; the CLI looks it up here when the
 * user runs `--apply`. Keeping applicable fixes separate from the serializable
 * {@link import('../types/index.js').SuggestedFix} shape means the diagnostic
 * data stays pure while the imperative "apply" logic lives in one place.
 */
export class FixRegistry {
  private readonly fixes = new Map<string, ApplicableFix>();

  register(fix: ApplicableFix): this {
    if (this.fixes.has(fix.id)) {
      throw new Error(`Duplicate fix id: "${fix.id}"`);
    }
    this.fixes.set(fix.id, fix);
    return this;
  }

  registerAll(fixes: readonly ApplicableFix[]): this {
    for (const fix of fixes) this.register(fix);
    return this;
  }

  get(id: string): ApplicableFix | undefined {
    return this.fixes.get(id);
  }

  has(id: string): boolean {
    return this.fixes.has(id);
  }

  list(): ApplicableFix[] {
    return [...this.fixes.values()];
  }
}
