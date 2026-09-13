import {spawn} from 'node:child_process';

export function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const current = values[index];
    if (current.startsWith('--')) parsed[current.slice(2)] = values[++index];
  }
  return parsed;
}

export function exitCodeFor(error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  return 1;
}

export function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let captured = '';
    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      captured = trimCaptured(captured + chunk.toString());
    });
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      captured = trimCaptured(captured + chunk.toString());
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`${command} exited with ${code}\n${captured}`));
    });
  });
}

function trimCaptured(value) {
  return value.length > 8192 ? value.slice(value.length - 8192) : value;
}
