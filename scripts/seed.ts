import { execSync } from 'node:child_process';

console.log('> Migratsiyalar qo‘llanmoqda');
execSync('pnpm db:migrate:deploy', { stdio: 'inherit' });

console.log('> Boshlang‘ich ma’lumotlar yozilmoqda');
execSync('pnpm db:seed', { stdio: 'inherit' });

console.log('Seed muvaffaqiyatli yakunlandi');
