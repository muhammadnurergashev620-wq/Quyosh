-- TZ 7.2: interfeys tili, hisob turi va yuridik shaxs (Organization).
CREATE TYPE "UserLocale" AS ENUM ('uz', 'oz', 'ru');
CREATE TYPE "AccountType" AS ENUM ('INDIVIDUAL', 'BUSINESS');

ALTER TABLE "users"
  ADD COLUMN "locale" "UserLocale" NOT NULL DEFAULT 'uz',
  ADD COLUMN "account_type" "AccountType" NOT NULL DEFAULT 'INDIVIDUAL';

CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "stir" VARCHAR(9) NOT NULL,
    "address" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id"),
    -- STIR — 9 raqam (TZ 7.2)
    CONSTRAINT "organizations_stir_format" CHECK ("stir" ~ '^[0-9]{9}$')
);
CREATE UNIQUE INDEX "organizations_user_id_key" ON "organizations"("user_id");
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
