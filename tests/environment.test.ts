import { describe, expect, it } from 'vitest';
import { compareEnv, environmentPlugin, parseEnvKeys } from '../src/plugins/environment/index.js';
import { makeContext, makeFs } from './helpers.js';

describe('parseEnvKeys', () => {
  it('parses keys and detects empty values, ignoring comments', () => {
    const entries = parseEnvKeys(
      ['# comment', 'API_PORT=3000', 'EMPTY=', 'export TOKEN="abc"', 'QUOTED_EMPTY=""'].join('\n'),
    );
    expect(entries).toEqual([
      { key: 'API_PORT', empty: false },
      { key: 'EMPTY', empty: true },
      { key: 'TOKEN', empty: false },
      { key: 'QUOTED_EMPTY', empty: true },
    ]);
  });

  it('never exposes values, only key names', () => {
    const entries = parseEnvKeys('SECRET=supersecretvalue');
    expect(JSON.stringify(entries)).not.toContain('supersecretvalue');
  });
});

describe('compareEnv', () => {
  it('distinguishes missing, empty, and present variables', () => {
    const example = 'DATABASE_URL=\nAPI_PORT=\nCACHE=';
    const env = 'API_PORT=3000\nCACHE=';
    expect(compareEnv(example, env)).toEqual({
      missing: ['DATABASE_URL'],
      empty: ['CACHE'],
      present: ['API_PORT'],
    });
  });
});

describe('environmentPlugin', () => {
  it('returns nothing when no env files exist', async () => {
    const results = await environmentPlugin.detect(makeContext());
    expect(results).toEqual([]);
  });

  it('warns when .env.example exists but .env is missing', async () => {
    const ctx = makeContext({
      cwd: '/project',
      fs: makeFs({ '/project/.env.example': 'DATABASE_URL=' }),
    });
    const results = await environmentPlugin.detect(ctx);
    expect(results[0]?.status).toBe('warning');
    expect(results[0]?.message).toContain('.env is missing');
  });

  it('reports missing DATABASE_URL and warns about ungitignored .env', async () => {
    const ctx = makeContext({
      cwd: '/project',
      fs: makeFs({
        '/project/.env.example': 'DATABASE_URL=\nAPI_PORT=',
        '/project/.env': 'API_PORT=3000',
        '/project/.gitignore': 'node_modules',
      }),
    });
    const results = await environmentPlugin.detect(ctx);
    const messages = results.map((r) => r.message);
    expect(messages).toContain('.env exists but DATABASE_URL is missing');
    expect(messages).toContain('API_PORT is defined');
    expect(messages.some((m) => m.includes('not listed in .gitignore'))).toBe(true);
  });

  it('does not warn when .env is gitignored', async () => {
    const ctx = makeContext({
      cwd: '/project',
      fs: makeFs({
        '/project/.env': 'API_PORT=3000',
        '/project/.gitignore': '.env',
      }),
    });
    const results = await environmentPlugin.detect(ctx);
    expect(results.some((r) => r.message.includes('.gitignore'))).toBe(false);
  });
});
