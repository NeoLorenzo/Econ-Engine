import { closeSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const logDir = join(repoRoot, '.agent-logs');
mkdirSync(logDir, { recursive: true });

const stages = [
  ['Typecheck', 'typecheck.log', 'typecheck'],
  ['Tests', 'tests.log', 'test:run'],
  ['Build', 'build.log', 'build'],
];

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const stripAnsi = (text) => text.replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, '');
const useful = /(FAIL|failed|error|AssertionError|TS\d{4}|test failed|vitest)/i;

function excerpt(logPath) {
  const text = stripAnsi(readFileSync(logPath, 'utf8'));
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const matches = lines.filter((line) => useful.test(line)).slice(-3);
  const selected = matches.length ? matches : lines.slice(-3);
  return selected.map((line) => {
    const limit = 180;
    return `  ${line.length > limit ? `${line.slice(0, limit - 1)}…` : line}`;
  });
}

console.log('Agent validation');
for (const [label, logName, script] of stages) {
  const logPath = join(logDir, logName);
  const stdoutFd = openSync(logPath, 'w');
  const stderrFd = openSync(logPath, 'a');
  const started = performance.now();
  let result;
  try {
    result = spawnSync(npmCommand, ['run', script], {
      cwd: repoRoot,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      stdio: ['ignore', stdoutFd, stderrFd],
      shell: process.platform === 'win32',
      windowsHide: true,
    });
  } finally {
    closeSync(stdoutFd);
    closeSync(stderrFd);
  }

  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  const failed = result.error || result.status !== 0;
  console.log(`${label.padEnd(10)} ${failed ? 'FAIL' : 'PASS'} (${seconds}s)`);
  if (failed) {
    if (result.error) console.log(`  ${result.error.message}`);
    else console.log(...excerpt(logPath));
    console.log(`  Log: ${relative(repoRoot, logPath)}`);
    console.log('Result     FAIL');
    process.exitCode = result.error ? 1 : (result.status || 1);
    break;
  }
}

if (!process.exitCode) console.log('Result     PASS');
