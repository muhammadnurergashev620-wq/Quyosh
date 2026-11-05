-- Do‘kon va admin panellariga kirish nomi (login). Mijoz telefon bilan kiradi.
ALTER TABLE "users" ADD COLUMN "login" VARCHAR(64);
CREATE UNIQUE INDEX "users_login_key" ON "users"("login");

-- Mavjud admin va do‘kon akkauntlari uchun boshlang‘ich login: telefon raqamining raqamlari (masalan 998901234501).
UPDATE "users" u SET "login" = regexp_replace(u."phone", '\D', '', 'g')
WHERE u."phone" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "user_roles" r WHERE r."userId" = u."id" AND r."role" IN ('ADMIN', 'SHOP'));
