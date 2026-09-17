import { spawn } from 'node:child_process';
import process from 'node:process';

const node = process.execPath;
const server = spawn(node, ['dist/server/server/src/index.js'], { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' } });
let simulator;

const startSimulator = () => {
  simulator = spawn(node, ['dist/simulator/simulator/src/index.js'], { stdio: 'inherit', env: process.env });
};
setTimeout(startSimulator, 700);

function shutdown() {
  server.kill('SIGTERM');
  simulator?.kill('SIGTERM');
  setTimeout(() => process.exit(0), 300).unref();
}

server.on('exit', (code) => {
  if (code && code !== 0) process.exit(code);
});
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
