# Zaxira nusxa va tiklash

Skriptlar: `infrastructure/backup/`. Ma'lumotlar bazasi — Postgres 16.

## Zaxira olish
```bash
PG_DOCKER_CONTAINER=getmaster-postgres-1 infrastructure/backup/backup.sh /srv/backups   # docker'dagi baza
DATABASE_URL=postgresql://… infrastructure/backup/backup.sh /srv/backups                # oddiy baza
```
Natija: `getmaster-<UTC vaqt>.dump` (pg_dump, custom format) va `.sha256` nazorat summasi. Fayl bo'sh bo'lsa skript xato bilan to'xtaydi.

Tavsiya: cron'da har kuni (masalan, 03:00) + `retention-cleanup.sh` (oxirgi 14 kun har kuni, 6 oy davomida har oyning 1-kuni). Zaxirani **boshqa serverga** ham ko'chiring (rclone/scp) — bitta diskda saqlash zaxira emas.
Media fayllar (MinIO) alohida: `mc mirror` bilan bucket'ni zaxiralang.

## Tiklashni tekshirish (haftasiga kamida 1 marta)
```bash
ADMIN_DATABASE_URL=postgresql://user:pass@host:5432/postgres infrastructure/backup/restore-drill.sh /srv/backups/getmaster-….dump
```
Skript vaqtinchalik baza yaratadi, tiklaydi, jadvallar va asosiy jadvallardagi qatorlarni sanaydi va bazani o'chiradi. Jonli bazaga tegmaydi.

## Haqiqiy tiklash (falokatdan keyin)
1. Ilovani to'xtating (API, worker) — yangi yozuvlar kelmasin.
2. Joriy buzilgan bazani nomini o'zgartirib saqlab qo'ying (`ALTER DATABASE getmaster RENAME TO getmaster_broken`).
3. `createdb getmaster` → `pg_restore --no-owner -d getmaster <fayl.dump>` (yangi pg_restore xato bersa — drill skriptidagi `pg_restore -f - | sed '/^SET transaction_timeout/d' | psql` usulidan foydalaning).
4. `pnpm db:migrate:deploy` — zaxiradan keyingi migratsiyalarni qo'llang.
5. Ilovani ishga tushirib, `/api/v1/health` va bir nechta buyurtmani tekshiring.
