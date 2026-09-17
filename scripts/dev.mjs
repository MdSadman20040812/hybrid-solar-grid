import { spawn } from 'node:child_process';
import process from 'node:process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const includeSimulator = !process.argv.includes('--no-simulator');
const commands = [
  ['server', ['run', 'dev:server']],
  ['client', ['run', 'dev:client']]
];
if (includeSimulator) commands.push(['simulator', ['run', 'dev:simulator']]);

const children = commands.map(([name, args]) => {
  const child = spawn(npmCommand, args, { stdio: ['inherit', 'pipe', 'pipe'], env: process.env, shell: true });
  child.stdout.on('data', (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
      shutdown(code);
    }
  });
  return child;
});

let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 400).unref();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
