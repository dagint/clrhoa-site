#!/usr/bin/env node
/**
 * npm audit gate with a reviewed allowlist.
 *
 * Fails when any advisory at or above --level (default: high) is not listed in
 * audit-allowlist.json, or when a listed entry has passed its expiry date.
 * Warns about allowlist entries that no longer match an advisory so they get cleaned up.
 *
 * Usage: node scripts/audit-check.mjs [--level=high|critical|moderate|low]
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const SEVERITY_RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };

const levelArg = process.argv.find((a) => a.startsWith('--level='));
const level = levelArg ? levelArg.split('=')[1] : 'high';
if (!(level in SEVERITY_RANK)) {
  console.error(`Unknown --level "${level}"`);
  process.exit(2);
}

const allowlist = JSON.parse(readFileSync(new URL('../audit-allowlist.json', import.meta.url), 'utf8'));
const allowed = new Map(allowlist.advisories.map((a) => [a.id, a]));

let raw;
try {
  raw = execFileSync('npm', ['audit', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
} catch (err) {
  // npm audit exits non-zero when vulnerabilities exist; the JSON is still on stdout.
  raw = err.stdout;
}
const report = JSON.parse(raw);
if (!report.vulnerabilities) {
  console.error('Unexpected npm audit output:', raw.slice(0, 500));
  process.exit(2);
}

// Root advisories appear as objects in `via`; string entries just point at other packages.
const advisories = new Map();
for (const vuln of Object.values(report.vulnerabilities)) {
  for (const via of vuln.via) {
    if (typeof via !== 'object') continue;
    const id = via.url.split('/').pop();
    advisories.set(id, { id, package: via.name, severity: via.severity, title: via.title, url: via.url });
  }
}

const today = new Date().toISOString().slice(0, 10);
const failures = [];
const accepted = [];

for (const adv of advisories.values()) {
  if (SEVERITY_RANK[adv.severity] < SEVERITY_RANK[level]) continue;
  const entry = allowed.get(adv.id);
  if (!entry) {
    failures.push(`${adv.severity.toUpperCase()} ${adv.package}: ${adv.title} (${adv.url})`);
  } else if (entry.expires < today) {
    failures.push(`EXPIRED allowlist entry ${adv.id} (${adv.package}, expired ${entry.expires}): re-review or fix`);
  } else {
    accepted.push(`${adv.id} ${adv.package} (${adv.severity}, expires ${entry.expires})`);
  }
}

const stale = [...allowed.keys()].filter((id) => !advisories.has(id));

if (accepted.length) console.log(`Allowlisted advisories (${accepted.length}):\n  ${accepted.join('\n  ')}`);
if (stale.length) console.warn(`::warning::Allowlist entries no longer reported by npm audit; remove them: ${stale.join(', ')}`);

if (failures.length) {
  console.error(`\nnpm audit found ${failures.length} unaccepted issue(s) at level "${level}" or above:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`\nnpm audit: no unaccepted advisories at level "${level}" or above.`);
