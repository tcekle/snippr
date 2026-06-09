#!/usr/bin/env node
// MinVer-style version derivation from git tags + commit height.
//
//   HEAD exactly on tag vX.Y.Z   ->  X.Y.Z              (a release)
//   N commits past tag vX.Y.Z    ->  X.Y.(Z+1)-alpha.N  (next patch, pre-release)
//   no vX.Y.Z tag reachable      ->  0.0.0-alpha.<commit-count>
//
// The stamped string stays MSI-safe: WiX/NSIS only consume the numeric
// major.minor.patch core, and SemVer build-metadata (+gSHA) can trip the MSI
// ProductVersion — so the short sha is reported as a separate output, never
// baked into the version. Patch is the auto-incremented part (MinVer default).
//
// Usage:
//   node scripts/compute-version.mjs            # print the version to stdout
//   node scripts/compute-version.mjs --write    # also stamp the three manifests
//
// stdout = the version only (one line). Diagnostics go to stderr. In CI, the
// version/full/sha/height are also appended to $GITHUB_OUTPUT.

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// stderr ignored so the expected "No names found" from describe stays quiet.
const git = (cmd) => execSync(`git ${cmd}`, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

function compute() {
  // --long always prints "-<height>-g<sha>", even with height 0 (on the tag).
  // --match keeps us to numeric vX.Y.Z tags; anything else falls through.
  let described = '';
  try {
    described = git('describe --tags --long --abbrev=7 --match "v[0-9]*"');
  } catch {
    described = ''; // no matching tag reachable
  }

  const m = described.match(/^v(\d+)\.(\d+)\.(\d+)-(\d+)-g([0-9a-f]+)$/);
  let version, height, sha;

  if (m) {
    const [maj, min, pat] = [Number(m[1]), Number(m[2]), Number(m[3])];
    height = Number(m[4]);
    sha = m[5];
    version = height === 0 ? `${maj}.${min}.${pat}` : `${maj}.${min}.${pat + 1}-alpha.${height}`;
  } else {
    height = Number(git('rev-list --count HEAD'));
    try { sha = git('rev-parse --short=7 HEAD'); } catch { sha = '0000000'; }
    version = `0.0.0-alpha.${height}`;
  }

  return { version, full: `${version}+g${sha}`, height, sha };
}

// ── manifest stampers ────────────────────────────────────────────────────────
// Files are stamped only in CI and never committed, so reserializing JSON (which
// may reflow formatting) is harmless.
function stampJson(rel, version) {
  const path = join(ROOT, rel);
  const obj = JSON.parse(readFileSync(path, 'utf8'));
  obj.version = version;
  writeFileSync(path, JSON.stringify(obj, null, 2) + '\n');
}

function stampCargo(rel, version) {
  const path = join(ROOT, rel);
  // Replace the version line within the [package] table only. [^\[]*? stays
  // inside the table (stops before the next [section]); it spans newlines.
  const txt = readFileSync(path, 'utf8').replace(
    /(\[package\][^[]*?\nversion\s*=\s*)"[^"]*"/,
    `$1"${version}"`,
  );
  writeFileSync(path, txt);
}

// ── main ─────────────────────────────────────────────────────────────────────
const { version, full, height, sha } = compute();

if (process.argv.includes('--write')) {
  stampJson('package.json', version);
  stampJson('src-tauri/tauri.conf.json', version);
  stampCargo('src-tauri/Cargo.toml', version);
  process.stderr.write(`stamped ${version} into package.json, tauri.conf.json, Cargo.toml\n`);
}

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\nfull=${full}\nsha=${sha}\nheight=${height}\n`);
}

process.stderr.write(`version=${version} full=${full} height=${height} sha=${sha}\n`);
process.stdout.write(version + '\n'); // stdout = clean version only
