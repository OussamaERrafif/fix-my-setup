import type { DiagnosticStatus } from '../types/index.js';
import type { Colorizer } from './colors.js';

/**
 * Unicode status glyphs with ASCII fallbacks for terminals (notably some
 * Windows consoles) that cannot render them.
 */
const GLYPHS: Record<DiagnosticStatus, { unicode: string; ascii: string }> = {
  success: { unicode: '✓', ascii: '[OK]' },
  warning: { unicode: '⚠', ascii: '[!]' },
  error: { unicode: '✗', ascii: '[x]' },
  info: { unicode: 'ℹ', ascii: '[i]' },
};

export interface SymbolOptions {
  /** Use ASCII fallbacks instead of Unicode glyphs. */
  ascii?: boolean;
}

/** Decide whether to use ASCII glyphs based on the environment. */
export function shouldUseAscii(env: NodeJS.ProcessEnv = process.env): boolean {
  // Legacy Windows consoles + non-UTF terminals struggle with Unicode glyphs.
  if (env.FIX_MY_SETUP_ASCII === '1') return true;
  const encoding = (env.LC_ALL || env.LC_CTYPE || env.LANG || '').toLowerCase();
  if (encoding && !encoding.includes('utf')) return true;
  return false;
}

export function statusSymbol(status: DiagnosticStatus, options: SymbolOptions = {}): string {
  const glyph = GLYPHS[status];
  return options.ascii ? glyph.ascii : glyph.unicode;
}

/** Return a colorized status symbol. */
export function colorizedSymbol(
  status: DiagnosticStatus,
  colors: Colorizer,
  options: SymbolOptions = {},
): string {
  const symbol = statusSymbol(status, options);
  switch (status) {
    case 'success':
      return colors.green(symbol);
    case 'warning':
      return colors.yellow(symbol);
    case 'error':
      return colors.red(symbol);
    case 'info':
      return colors.blue(symbol);
  }
}
