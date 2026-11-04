/**
 * pm2 bilan mahalliy ishga tushirish: `pm2 start ecosystem.config.cjs` (to‘xtatish: `pm2 delete ecosystem.config.cjs`).
 * Oldindan kerak: PostgreSQL (`scripts/quyosh-db.sh start`) va Redis; API uchun `pnpm build`.
 *
 *   quyosh-s3        — s3rver (MinIO o‘rniga), :59100
 *   quyosh-api       — NestJS (dist/main.js), :3100 (`.env` dan o‘qiydi)
 *   quyosh-portal    — asosiy sayt, :5180
 *   quyosh-customer  — mijoz paneli, :5183
 *   quyosh-shop      — do‘kon paneli, :5184
 *   quyosh-admin     — admin paneli, :5185
 */
const path = require('node:path');
const fs = require('node:fs');

const root = __dirname;
const web = path.join(root, 'apps/web');
const vite = path.join(web, 'node_modules/vite/bin/vite.js');
const s3rver = fs
  .readdirSync(path.join(root, 'node_modules/.pnpm'))
  .filter((name) => name.startsWith('s3rver@'))
  .map((name) => path.join(root, 'node_modules/.pnpm', name, 'node_modules/s3rver/bin/s3rver.js'))[0];
const s3Home = path.join(process.env.HOME || '', '.local/share/quyosh/s3');

const common = { autorestart: true, max_restarts: 10, min_uptime: '10s', time: true };
const panel = (name, port, mode) => ({
  ...common,
  name,
  cwd: web,
  script: vite,
  args: `${mode ? `--mode ${mode} ` : ''}--port ${port} --strictPort`,
  interpreter: 'node',
});

module.exports = {
  apps: [
    { ...common, name: 'quyosh-s3', cwd: root, script: s3rver, args: `-d ${s3Home} -a 127.0.0.1 -p 59100 --configure-bucket quyosh-media --configure-bucket quyosh-test`, interpreter: 'node' },
    { ...common, name: 'quyosh-api', cwd: root, script: 'dist/main.js', interpreter: 'node', kill_timeout: 8000 },
    panel('quyosh-portal', 5180),
    panel('quyosh-customer', 5183, 'customer'),
    panel('quyosh-shop', 5184, 'shop'),
    panel('quyosh-admin', 5185, 'admin'),
  ],
};
