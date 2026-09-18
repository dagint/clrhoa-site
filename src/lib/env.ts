/**
 * Single access point for Cloudflare bindings (D1, KV, R2) and secrets.
 *
 * On Cloudflare Pages with @astrojs/cloudflare v12 these live on `locals.runtime.env`.
 * Astro 6+ (adapter v13+) removes `locals.runtime` and exposes bindings via
 * `import { env } from 'cloudflare:workers'`. All app code goes through this helper
 * so that migration only has to change this file.
 *
 * Do not read `locals.runtime` anywhere else (enforced by tests/unit/env-access.test.ts).
 *
 * Returns undefined at build time for prerendered routes, same as `locals.runtime?.env`.
 */

/** Minimal locals shape used by lib helpers and unit tests that don't depend on Astro types. */
type LocalsWithRuntime<E> = { runtime?: { env?: E } };

/** Same type Astro gives `locals.runtime.env` (adapter Env merged with ours from env.d.ts). */
type RuntimeEnv = App.Locals['runtime']['env'];

export function getEnv(locals: App.Locals): RuntimeEnv;
export function getEnv<E>(locals: LocalsWithRuntime<E>): E | undefined;
export function getEnv<E>(locals: LocalsWithRuntime<E>): E | undefined {
  return locals.runtime?.env;
}
