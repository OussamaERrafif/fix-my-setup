import { describe, expect, it } from 'vitest';
import { nodePlugin } from '../src/plugins/node/index.js';
import { makeContext, makeFs } from './helpers.js';

function byId(results: Awaited<ReturnType<typeof nodePlugin.detect>>, id: string) {
  return results.find((r) => r.id === id);
}

describe('nodePlugin', () => {
  it('errors when Node.js is not installed', async () => {
    const results = await nodePlugin.detect(makeContext({ options: { network: false } }));
    expect(byId(results, 'node.installed')?.status).toBe('error');
  });

  it('flags an End-of-Life Node.js version', async () => {
    const ctx = makeContext({
      options: { network: false },
      commands: {
        'node --version': { stdout: 'v16.20.0' },
        'npm --version': { stdout: '8.0.0' },
      },
    });
    const results = await nodePlugin.detect(ctx);
    expect(byId(results, 'node.version')?.status).toBe('error');
  });

  it('accepts a supported Node.js version', async () => {
    const ctx = makeContext({
      options: { network: false },
      commands: {
        'node --version': { stdout: 'v22.14.0' },
        'npm --version': { stdout: '10.8.0' },
        'npx --version': { stdout: '10.8.0' },
        'npm prefix -g': { stdout: '/usr/local' },
        'npm config get cache': { stdout: '/home/dev/.npm' },
      },
    });
    const results = await nodePlugin.detect(ctx);
    expect(byId(results, 'node.version')?.status).toBe('success');
    expect(byId(results, 'node.version')?.message).toContain('22.14.0');
  });

  it('detects npm global bin missing from PATH', async () => {
    const ctx = makeContext({
      platform: 'linux',
      env: { PATH: '/usr/bin:/bin' },
      options: { network: false },
      commands: {
        'node --version': { stdout: 'v22.0.0' },
        'npm --version': { stdout: '10.0.0' },
        'npm prefix -g': { stdout: '/usr/local' },
        'npm config get cache': { stdout: '/home/dev/.npm' },
      },
      fs: makeFs({}, ['/home/dev/.npm']),
    });
    const results = await nodePlugin.detect(ctx);
    const globalBin = byId(results, 'node.global-bin');
    expect(globalBin?.status).toBe('error');
    expect(globalBin?.details?.[0]).toContain('/usr/local/bin');
  });

  it('recognizes the npm global bin when it is on PATH', async () => {
    const ctx = makeContext({
      platform: 'linux',
      env: { PATH: '/usr/local/bin:/usr/bin' },
      options: { network: false },
      commands: {
        'node --version': { stdout: 'v22.0.0' },
        'npm --version': { stdout: '10.0.0' },
        'npm prefix -g': { stdout: '/usr/local' },
        'npm config get cache': { stdout: '/home/dev/.npm' },
      },
      fs: makeFs({}, ['/home/dev/.npm']),
    });
    const results = await nodePlugin.detect(ctx);
    expect(byId(results, 'node.global-bin')?.status).toBe('success');
  });

  it('errors when package.json declares deps but node_modules is missing', async () => {
    const ctx = makeContext({
      cwd: '/project',
      options: { network: false },
      commands: {
        'node --version': { stdout: 'v22.0.0' },
        'npm --version': { stdout: '10.0.0' },
        'npm prefix -g': { stdout: '/usr/local' },
        'npm config get cache': { stdout: '/home/dev/.npm' },
      },
      env: { PATH: '/usr/local/bin' },
      fs: makeFs({
        '/project/package.json': JSON.stringify({ dependencies: { left: '1.0.0' } }),
      }),
    });
    const results = await nodePlugin.detect(ctx);
    expect(byId(results, 'node.node-modules')?.status).toBe('error');
  });

  it('warns about multiple lock files', async () => {
    const ctx = makeContext({
      cwd: '/project',
      options: { network: false },
      env: { PATH: '/usr/local/bin' },
      commands: {
        'node --version': { stdout: 'v22.0.0' },
        'npm --version': { stdout: '10.0.0' },
        'npm prefix -g': { stdout: '/usr/local' },
        'npm config get cache': { stdout: '/home/dev/.npm' },
      },
      fs: makeFs(
        {
          '/project/package.json': JSON.stringify({ dependencies: { a: '1' } }),
          '/project/package-lock.json': '{}',
          '/project/yarn.lock': '',
        },
        ['/project/node_modules'],
      ),
    });
    const results = await nodePlugin.detect(ctx);
    expect(byId(results, 'node.lockfiles')?.status).toBe('warning');
  });
});
