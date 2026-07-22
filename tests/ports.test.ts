import { describe, expect, it } from 'vitest';
import { parseLsof, parseNetstat, parseTasklist, portsPlugin } from '../src/plugins/ports/index.js';
import { makeContext } from './helpers.js';

const NETSTAT = `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       18432
  TCP    127.0.0.1:5432         0.0.0.0:0              LISTENING       900
  TCP    0.0.0.0:445            0.0.0.0:0              ESTABLISHED     4
`;

describe('port output parsers', () => {
  it('finds the listening PID for a port (netstat)', () => {
    expect(parseNetstat(NETSTAT, 3000)).toBe(18432);
    expect(parseNetstat(NETSTAT, 5432)).toBe(900);
  });

  it('ignores non-listening rows and unknown ports (netstat)', () => {
    expect(parseNetstat(NETSTAT, 445)).toBeNull();
    expect(parseNetstat(NETSTAT, 9999)).toBeNull();
  });

  it('parses a process name from tasklist CSV', () => {
    expect(parseTasklist('"node.exe","18432","Console","1","55,000 K"')).toBe('node.exe');
    expect(parseTasklist('')).toBeUndefined();
  });

  it('parses lsof -F output', () => {
    expect(parseLsof('p12345\ncnode\nn*:3000')).toEqual({ pid: 12345, name: 'node' });
    expect(parseLsof('no pids here')).toBeNull();
  });
});

describe('portsPlugin', () => {
  it('returns nothing when no ports requested', async () => {
    const results = await portsPlugin.detect(makeContext());
    expect(results).toEqual([]);
  });

  it('reports an available port on linux', async () => {
    const ctx = makeContext({ platform: 'linux', options: { ports: [3000] } });
    const results = await portsPlugin.detect(ctx);
    expect(results[0]?.status).toBe('success');
    expect(results[0]?.message).toContain('3000 is available');
  });

  it('reports an occupied port with a stop-command fix on windows', async () => {
    const ctx = makeContext({
      platform: 'windows',
      options: { ports: [3000] },
      commands: {
        'netstat -ano -p TCP': { stdout: NETSTAT },
        'tasklist /FI PID eq 18432 /FO CSV /NH': { stdout: '"node.exe","18432","Console"' },
      },
    });
    const results = await portsPlugin.detect(ctx);
    expect(results[0]?.status).toBe('warning');
    expect(results[0]?.message).toContain('node.exe');
    expect(results[0]?.suggestedFixes?.[0]?.commands?.windows?.[0]).toBe('taskkill /PID 18432 /F');
  });
});
