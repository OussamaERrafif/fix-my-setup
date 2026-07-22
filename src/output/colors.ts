/**
 * Minimal, dependency-free terminal color helper.
 *
 * Colors are disabled automatically when:
 *  - `NO_COLOR` is set (https://no-color.org)
 *  - the stream is not a TTY (piped/redirected output)
 *  - `TERM=dumb`
 *
 * `FORCE_COLOR` overrides detection and forces colors on.
 */

/** ASCII escape character (0x1B); built at runtime to avoid raw control bytes. */
const ESC = String.fromCharCode(27);

const CODES = {
  reset: 0,
  bold: 1,
  dim: 2,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  cyan: 36,
  gray: 90,
} as const;

type ColorName = keyof typeof CODES;

export interface ColorOptions {
  isTTY?: boolean;
  env?: NodeJS.ProcessEnv;
}

export function supportsColor({
  isTTY = Boolean(process.stdout.isTTY),
  env = process.env,
}: ColorOptions = {}): boolean {
  if (env.FORCE_COLOR && env.FORCE_COLOR !== '0') return true;
  if (env.NO_COLOR !== undefined) return false;
  if (env.TERM === 'dumb') return false;
  return isTTY;
}

export interface Colorizer {
  enabled: boolean;
  red(text: string): string;
  green(text: string): string;
  yellow(text: string): string;
  blue(text: string): string;
  cyan(text: string): string;
  gray(text: string): string;
  bold(text: string): string;
  dim(text: string): string;
}

/** Create a colorizer. When disabled, every method is an identity function. */
export function createColorizer(enabled: boolean): Colorizer {
  const wrap =
    (name: ColorName) =>
    (text: string): string =>
      enabled ? ESC + '[' + CODES[name] + 'm' + text + ESC + '[' + CODES.reset + 'm' : text;

  return {
    enabled,
    red: wrap('red'),
    green: wrap('green'),
    yellow: wrap('yellow'),
    blue: wrap('blue'),
    cyan: wrap('cyan'),
    gray: wrap('gray'),
    bold: wrap('bold'),
    dim: wrap('dim'),
  };
}
