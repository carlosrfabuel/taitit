// Runs the database test script against the linked Supabase project and reports pass/fail.
// The script always ends with an exception so Postgres rolls back all test data;
// this runner reads the RESULT line from that exception.
import { spawnSync } from 'node:child_process';

// Relative to the mvp folder (the path contains a space, which breaks shell quoting).
const file = 'supabase/tests/rls_and_constraints.sql';
const res = spawnSync('npx', ['--yes', 'supabase@2.121.0', 'db', 'query', '--linked', '-f', file], {
  encoding: 'utf8',
  shell: true,
  cwd: new URL('../..', import.meta.url),
});
const output = `${res.stdout}\n${res.stderr}`;
// The message arrives JSON-escaped and is followed by Postgres' CONTEXT line.
const match = output.match(/RESULT: (PASS|FAIL)[\s\S]*?(?=(\\n)?CONTEXT|$)/);

if (!match) {
  console.error('Could not read a test result. Raw output:\n' + output);
  process.exit(2);
}

const report = match[0]
  .replace(/\\n/g, '\n')
  .replace(/\\"/g, '"')
  .split('\n')
  .map((line) => line.replace(/\\+$/, ''))
  .join('\n')
  .trim();
console.log(report);
process.exit(match[1] === 'PASS' ? 0 : 1);
