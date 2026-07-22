import { describe, expect, it } from 'vitest';
import { Sanitizer } from '../src/core/sanitizer.js';

const sanitizer = new Sanitizer({
  homeDir: 'C:/Users/alice',
  projectDir: 'C:/Users/alice/dev/app',
  username: 'alice',
});

describe('Sanitizer', () => {
  it('replaces project and home paths with placeholders', () => {
    expect(sanitizer.sanitize('C:/Users/alice/dev/app/package.json')).toBe(
      '<PROJECT>/package.json',
    );
    expect(sanitizer.sanitize('C:\\Users\\alice\\AppData\\Roaming\\npm')).toBe(
      '<HOME>/AppData/Roaming/npm',
    );
  });

  it('redacts credentials embedded in URLs', () => {
    expect(sanitizer.sanitize('https://user:secretpass@github.com/x')).toBe(
      'https://<REDACTED>@github.com/x',
    );
  });

  it('redacts common token shapes', () => {
    expect(sanitizer.sanitize('token ghp_ABCDEFGHIJKLMNOP1234')).toContain('<REDACTED>');
    expect(sanitizer.sanitize('AWS AKIAIOSFODNN7EXAMPLE key')).toContain('<REDACTED>');
  });

  it('redacts key=value secret pairs', () => {
    expect(sanitizer.sanitize('API_TOKEN=abc123xyz')).toBe('API_TOKEN=<REDACTED>');
    expect(sanitizer.sanitize('password: hunter2')).toContain('<REDACTED>');
  });

  it('redacts emails and non-loopback IPs but keeps loopback', () => {
    expect(sanitizer.sanitize('contact me@example.com')).toBe('contact <EMAIL>');
    expect(sanitizer.sanitize('host 203.0.113.9')).toBe('host <IP>');
    expect(sanitizer.sanitize('bound to 127.0.0.1')).toBe('bound to 127.0.0.1');
  });

  it('replaces bare username occurrences', () => {
    expect(sanitizer.sanitize('logged in as alice')).toBe('logged in as <USER>');
  });

  it('recursively sanitizes nested values', () => {
    const out = sanitizer.sanitizeValue({
      path: 'C:/Users/alice/dev/app/x',
      list: ['alice', 'ok'],
    });
    expect(out).toEqual({ path: '<PROJECT>/x', list: ['<USER>', 'ok'] });
  });
});
