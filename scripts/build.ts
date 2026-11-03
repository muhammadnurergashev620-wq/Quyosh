import { execSync } from 'node:child_process';

const steps = ['pnpm db:generate', 'pnpm typecheck', 'pnpm lint', 'pnpm build'];

for (const step of steps) {
  console.log(`\n> ${step}`);
  execSync(step, { stdio: 'inherit' });
}

console.log('\nBuild muvaffaqiyatli yakunlandi');
