-- DropForeignKey
ALTER TABLE "telegram_links" DROP CONSTRAINT "telegram_links_user_id_fkey";

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "scheduled_for" TIMESTAMP(3);

-- DropTable
DROP TABLE "telegram_callback_tokens";

-- DropTable
DROP TABLE "telegram_links";

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(60) NOT NULL,
    "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_templates" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "items_json" JSONB NOT NULL,
    "defaults_json" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_blocks" (
    "id" UUID NOT NULL,
    "page" VARCHAR(40) NOT NULL DEFAULT 'HOME',
    "block_type" VARCHAR(40) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "content_i18n" JSONB NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "published_at" TIMESTAMP(3),
    "updated_by_id" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_quota_snapshots" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(30) NOT NULL,
    "metric" VARCHAR(40) NOT NULL,
    "used" INTEGER NOT NULL,
    "limit" INTEGER,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "period_start" TIMESTAMP(3) NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_quota_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_deployments" (
    "id" UUID NOT NULL,
    "service" VARCHAR(20) NOT NULL,
    "environment" VARCHAR(20) NOT NULL,
    "version" VARCHAR(60) NOT NULL,
    "git_sha" VARCHAR(64),
    "status" VARCHAR(20) NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "triggered_by" VARCHAR(120),
    "changelog_url" VARCHAR(500),

    CONSTRAINT "ops_deployments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_alert_events" (
    "id" UUID NOT NULL,
    "fingerprint" VARCHAR(120) NOT NULL,
    "alert_name" VARCHAR(120) NOT NULL,
    "severity" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "summary" VARCHAR(1000) NOT NULL,
    "labels_json" JSONB NOT NULL DEFAULT '{}',
    "acknowledged_by" UUID,
    "acknowledged_at" TIMESTAMP(3),

    CONSTRAINT "ops_alert_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_type_key" ON "notification_preferences"("user_id", "type");

-- CreateIndex
CREATE INDEX "quote_templates_shop_id_idx" ON "quote_templates"("shop_id");

-- CreateIndex
CREATE INDEX "site_blocks_page_status_sort_order_idx" ON "site_blocks"("page", "status", "sort_order");

-- CreateIndex
CREATE INDEX "provider_quota_snapshots_provider_captured_at_idx" ON "provider_quota_snapshots"("provider", "captured_at");

-- CreateIndex
CREATE INDEX "ops_deployments_service_environment_started_at_idx" ON "ops_deployments"("service", "environment", "started_at");

-- CreateIndex
CREATE INDEX "ops_alert_events_status_severity_idx" ON "ops_alert_events"("status", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "ops_alert_events_fingerprint_starts_at_key" ON "ops_alert_events"("fingerprint", "starts_at");

-- CreateIndex
CREATE INDEX "notifications_status_scheduled_for_idx" ON "notifications"("status", "scheduled_for");

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_templates" ADD CONSTRAINT "quote_templates_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;


