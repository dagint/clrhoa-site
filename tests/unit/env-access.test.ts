/**
 * Bindings must be read through getEnv() (src/lib/env.ts) so the Astro 6+ migration,
 * which removes locals.runtime, only has to change that one file.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { getEnv } from '../../src/lib/env';

const SRC = join(__dirname, '../../src');
const ALLOWED = new Set(['lib/env.ts']);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.(ts|tsx|mts|astro)$/.test(name) && !name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

describe('getEnv', () => {
  it('returns locals.runtime.env', () => {
    const env = { SESSION_SECRET: 'x' };
    expect(getEnv({ runtime: { env } })).toBe(env);
  });

  it('returns undefined when runtime is absent (prerendered routes)', () => {
    expect(getEnv({})).toBeUndefined();
  });
});

describe('env access', () => {
  it('no source file reads locals.runtime except src/lib/env.ts', () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => !ALLOWED.has(relative(SRC, file).split('\\').join('/')))
      .flatMap((file) =>
        readFileSync(file, 'utf8')
          .split('\n')
          .map((line, i) => ({ line, n: i + 1 }))
          .filter(({ line }) => /\blocals\??\.runtime\b/.test(line) && !/^\s*(\*|\/\/)/.test(line))
          .map(({ n }) => `${relative(SRC, file)}:${n}`)
      );
    expect(offenders, 'Use getEnv(locals) from src/lib/env.ts instead').toEqual([]);
  });
});
