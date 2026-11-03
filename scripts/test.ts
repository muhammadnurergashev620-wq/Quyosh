import { execSync } from 'node:child_process';

const target = process.argv[2];
const command = target ? `pnpm vitest run ${target}` : 'pnpm vitest run';

console.log(`> ${command}`);
execSync(command, { stdio: 'inherit' });
