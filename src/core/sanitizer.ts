/**
 * Redacts sensitive information from strings before they enter a report.
 *
 * The sanitizer is deliberately conservative: it errs toward over-redaction.
 * It replaces absolute paths, usernames, credentials, tokens and network
 * identifiers with stable placeholders so reports are safe to share.
 */

export interface SanitizerConfig {
  homeDir: string;
  projectDir: string;
  /** Current OS username, if known. */
  username?: string;
}

const PLACEHOLDER = {
  home: '<HOME>',
  project: '<PROJECT>',
  user: '<USER>',
  secret: '<REDACTED>',
  email: '<EMAIL>',
  ip: '<IP>',
} as const;

export class Sanitizer {
  private readonly homeDir: string;
  private readonly projectDir: string;
  private readonly username?: string;

  constructor(config: SanitizerConfig) {
    // Normalize to forward slashes so Windows/POSIX paths match uniformly.
    this.homeDir = normalize(config.homeDir);
    this.projectDir = normalize(config.projectDir);
    this.username = config.username || undefined;
  }

  /** Sanitize a single string value. */
  sanitize(input: string): string {
    let out = normalize(input);

    // Order matters: project path first (usually nested under home), then home.
    if (this.projectDir) out = replaceAll(out, this.projectDir, PLACEHOLDER.project);
    if (this.homeDir) out = replaceAll(out, this.homeDir, PLACEHOLDER.home);

    // Credentials embedded in URLs, e.g. https://user:pass@host -> https://<REDACTED>@host
    out = out.replace(/\/\/[^/\s:@]+:[^/\s@]+@/g, `//${PLACEHOLDER.secret}@`);

    // Common secret token shapes.
    out = out.replace(
      /\b(ghp|gho|ghu|ghs|ghr|github_pat|sk|pk|xox[baprs]|AKIA|ASIA)[A-Za-z0-9_-]{8,}\b/g,
      PLACEHOLDER.secret,
    );
    // key=value / key: value pairs whose key looks secret-ish.
    out = out.replace(
      /\b([A-Za-z0-9_]*(?:token|secret|password|passwd|apikey|api_key|access_key)[A-Za-z0-9_]*)\s*[=:]\s*\S+/gi,
      `$1=${PLACEHOLDER.secret}`,
    );

    // Email addresses.
    out = out.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, PLACEHOLDER.email);

    // IPv4 addresses (leave loopback alone; it carries no identity).
    out = out.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, (match) =>
      match === '127.0.0.1' || match === '0.0.0.0' ? match : PLACEHOLDER.ip,
    );

    // Bare username occurrences (after paths are already placeholdered).
    if (this.username && this.username.length >= 3) {
      out = replaceAll(out, this.username, PLACEHOLDER.user);
    }

    return out;
  }

  /** Recursively sanitize any JSON-serializable value. */
  sanitizeValue<T>(value: T): T {
    if (typeof value === 'string') return this.sanitize(value) as unknown as T;
    if (Array.isArray(value)) return value.map((v) => this.sanitizeValue(v)) as unknown as T;
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) out[key] = this.sanitizeValue(val);
      return out as T;
    }
    return value;
  }
}

function normalize(path: string): string {
  return path.replace(/\\/g, '/');
}

function replaceAll(haystack: string, needle: string, replacement: string): string {
  if (!needle) return haystack;
  return haystack.split(needle).join(replacement);
}
