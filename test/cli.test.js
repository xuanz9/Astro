import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

test('session save persists locally and later recommendations use its evidence', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'astro-test-'));
  const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));
  const fixture = fileURLToPath(new URL('../examples/session.json', import.meta.url));
  try {
    const saved = spawnSync(process.execPath, [cli,'save',fixture], {cwd, encoding:'utf8'});
    assert.equal(saved.status,0,saved.stderr);
    assert.equal(JSON.parse(saved.stdout).advice.matchingSuccessfulSessions,0);
    const records = JSON.parse(readFileSync(join(cwd,'local-data/sessions.json')));
    assert.equal(records.length,1);
    const advice = spawnSync(process.execPath, [cli,'recommend',fixture], {cwd, encoding:'utf8'});
    assert.equal(advice.status,0,advice.stderr);
    assert.equal(JSON.parse(advice.stdout).matchingSuccessfulSessions,1);
  } finally { rmSync(cwd,{recursive:true,force:true}); }
});
