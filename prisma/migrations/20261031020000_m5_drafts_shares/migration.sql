-- M5: hisob draftlari va ulashish havolalari (TZ 7.5, 9.9).
-- CreateTable
CREATE TABLE "calculation_drafts" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "cookie_token_hash" VARCHAR(128) NOT NULL,
    "input_json" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calculation_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculation_shares" (
    "id" UUID NOT NULL,
    "calculation_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calculation_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "calculation_drafts_cookie_token_hash_key" ON "calculation_drafts"("cookie_token_hash");

-- CreateIndex
CREATE INDEX "calculation_drafts_expires_at_idx" ON "calculation_drafts"("expires_at");

-- CreateIndex
CREATE INDEX "calculation_drafts_user_id_idx" ON "calculation_drafts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "calculation_shares_token_hash_key" ON "calculation_shares"("token_hash");

-- CreateIndex
CREATE INDEX "calculation_shares_calculation_id_idx" ON "calculation_shares"("calculation_id");


ALTER TABLE "calculation_shares" ADD CONSTRAINT "calculation_shares_calculation_fkey" FOREIGN KEY ("calculation_id") REFERENCES "calculations"("id") ON DELETE CASCADE;
