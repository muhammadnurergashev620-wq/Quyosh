-- CreateTable
CREATE TABLE "telegram_links" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "chat_id" VARCHAR(32) NOT NULL,
    "username" VARCHAR(64),
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "telegram_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_callback_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "payload_json" JSONB NOT NULL DEFAULT '{}',
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_callback_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_links_user_id_key" ON "telegram_links"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_links_chat_id_key" ON "telegram_links"("chat_id");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_callback_tokens_token_hash_key" ON "telegram_callback_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "telegram_callback_tokens_expires_at_idx" ON "telegram_callback_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "telegram_links" ADD CONSTRAINT "telegram_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

