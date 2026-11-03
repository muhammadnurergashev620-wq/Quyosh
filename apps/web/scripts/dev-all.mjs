import { spawn } from 'node:child_process';

const apps = [
  { script: 'dev:site', label: 'sayt  ' },
  { script: 'dev:customer', label: 'mijoz ' },
  { script: 'dev:shop', label: 'dokon ' },
  { script: 'dev:admin', label: 'admin ' },
];

console.log('\n  Quyosh frontend panellari:');
console.log('    Asosiy sayt   → http://localhost:5170  (quyosh.uz: mijoz va do'kon shu yerdan kiradi)');
console.log('    Mijoz paneli  → http://localhost:5173');
console.log('    Do'kon paneli → http://localhost:5174');
console.log('    Admin paneli  → http://localhost:5175\n');

const children = apps.map(({ script, label }) => {
  const child = spawn('npm', ['run', script], { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
  const prefix = (stream) => stream.on('data', (chunk) => {
    for (const line of String(chunk).split('\n')) if (line.trim()) console.log(`[${label}] ${line}`);
  });
  prefix(child.stdout);
  prefix(child.stderr);
  child.on('exit', (code) => {
    console.log(`[${label}] to‘xtadi (kod ${code})`);
    shutdown();
  });
  return child;
});

function shutdown() {
  for (const child of children) if (!child.killed) child.kill('SIGTERM');
}
process.on('SIGINT', () => { shutdown(); process.exit(0); });
process.on('SIGTERM', () => { shutdown(); process.exit(0); });
