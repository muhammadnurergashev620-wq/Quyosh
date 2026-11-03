-- CreateEnum
CREATE TYPE "ReadingSource" AS ENUM ('MANUAL');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('CLEANING', 'INSPECTION', 'WARRANTY_EXPIRY');

-- CreateEnum
CREATE TYPE "CertType" AS ENUM ('OFFICIAL_DEALER', 'CERTIFIED_INSTALLER', 'LICENSE');

-- CreateEnum
CREATE TYPE "CertStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SupportPriority" AS ENUM ('URGENT', 'HIGH', 'NORMAL');

-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportSide" AS ENUM ('USER', 'AGENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ArticleType" AS ENUM ('GUIDE', 'ARTICLE', 'FAQ', 'VIDEO', 'GLOSSARY');

-- CreateEnum
CREATE TYPE "CtaType" AS ENUM ('CALCULATOR', 'OUTAGE', 'FINANCING', 'SHOPS', 'NONE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MediaAssetKind" ADD VALUE 'CERTIFICATE';
ALTER TYPE "MediaAssetKind" ADD VALUE 'SUPPORT_ATTACHMENT';
ALTER TYPE "MediaAssetKind" ADD VALUE 'ARTICLE_COVER';

-- AlterTable
ALTER TABLE "installed_systems" ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "title" VARCHAR(200);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "anonymized_at" TIMESTAMP(3),
ADD COLUMN     "deletion_requested_at" TIMESTAMP(3),
ADD COLUMN     "deletion_scheduled_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "production_readings" (
    "id" UUID NOT NULL,
    "installed_system_id" UUID NOT NULL,
    "period_month" DATE NOT NULL,
    "generated_kwh" DECIMAL(12,2) NOT NULL,
    "meter_reading" DECIMAL(14,2),
    "source" "ReadingSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_reminders" (
    "id" UUID NOT NULL,
    "installed_system_id" UUID NOT NULL,
    "type" "ReminderType" NOT NULL,
    "interval_days" INTEGER,
    "warranty_item_id" UUID,
    "next_at" TIMESTAMP(3) NOT NULL,
    "last_sent_at" TIMESTAMP(3),
    "last_done_at" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_certifications" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "cert_type" "CertType" NOT NULL,
    "brand" VARCHAR(120),
    "issuer" VARCHAR(200) NOT NULL,
    "cert_number" VARCHAR(120),
    "file_id" UUID NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_until" DATE,
    "status" "CertStatus" NOT NULL DEFAULT 'PENDING',
    "reviewer_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "reason" VARCHAR(1000),
    "expiring_notified_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_projects" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "city" VARCHAR(120),
    "system_power_kw" DECIMAL(10,2),
    "system_type" "SystemType",
    "completed_at" DATE,
    "installation_id" UUID,
    "description" VARCHAR(4000),
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_project_images" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "shop_project_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "widget_configs" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "public_key" VARCHAR(40) NOT NULL,
    "allowed_domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "theme_json" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "widget_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" UUID NOT NULL,
    "event_type" VARCHAR(60) NOT NULL,
    "user_id" UUID,
    "anonymous_id" VARCHAR(64),
    "shop_id" UUID,
    "entity_id" UUID,
    "region_code" VARCHAR(32),
    "properties_json" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "requester_user_id" UUID,
    "guest_contact" VARCHAR(64),
    "shop_id" UUID,
    "category" VARCHAR(40) NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "priority" "SupportPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "SupportStatus" NOT NULL DEFAULT 'OPEN',
    "related_type" VARCHAR(40),
    "related_id" UUID,
    "request_id_ref" VARCHAR(100),
    "assignee_id" UUID,
    "first_response_due_at" TIMESTAMP(3) NOT NULL,
    "first_responded_at" TIMESTAMP(3),
    "sla_warned_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "satisfaction" INTEGER,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "sender_user_id" UUID,
    "sender_side" "SupportSide" NOT NULL,
    "body" VARCHAR(8000) NOT NULL,
    "attachment_file_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_reply_templates" (
    "id" UUID NOT NULL,
    "title_i18n" JSONB NOT NULL,
    "body_i18n" JSONB NOT NULL,
    "category" VARCHAR(40),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_reply_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_categories" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name_i18n" JSONB NOT NULL,
    "icon" VARCHAR(40),
    "parent_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "knowledge_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guide_articles" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "article_type" "ArticleType" NOT NULL,
    "category_id" UUID NOT NULL,
    "title_i18n" JSONB NOT NULL,
    "summary_i18n" JSONB NOT NULL,
    "body_i18n" JSONB NOT NULL,
    "search_text" TEXT NOT NULL DEFAULT '',
    "video_url" VARCHAR(500),
    "cover_file_id" UUID,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "seo_title_i18n" JSONB,
    "seo_description_i18n" JSONB,
    "cta_type" "CtaType" NOT NULL DEFAULT 'NONE',
    "author_id" UUID,
    "reading_minutes" INTEGER NOT NULL DEFAULT 3,
    "source_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "beginner_order" INTEGER,
    "verified_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "helpful_yes" INTEGER NOT NULL DEFAULT 0,
    "helpful_no" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guide_articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "production_readings_installed_system_id_period_month_key" ON "production_readings"("installed_system_id", "period_month");

-- CreateIndex
CREATE INDEX "maintenance_reminders_next_at_active_idx" ON "maintenance_reminders"("next_at", "active");

-- CreateIndex
CREATE INDEX "maintenance_reminders_installed_system_id_idx" ON "maintenance_reminders"("installed_system_id");

-- CreateIndex
CREATE INDEX "shop_certifications_shop_id_status_idx" ON "shop_certifications"("shop_id", "status");

-- CreateIndex
CREATE INDEX "shop_certifications_valid_until_idx" ON "shop_certifications"("valid_until");

-- CreateIndex
CREATE INDEX "shop_projects_shop_id_idx" ON "shop_projects"("shop_id");

-- CreateIndex
CREATE INDEX "shop_project_images_project_id_idx" ON "shop_project_images"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "widget_configs_shop_id_key" ON "widget_configs"("shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "widget_configs_public_key_key" ON "widget_configs"("public_key");

-- CreateIndex
CREATE INDEX "analytics_events_event_type_occurred_at_idx" ON "analytics_events"("event_type", "occurred_at");

-- CreateIndex
CREATE INDEX "analytics_events_shop_id_occurred_at_idx" ON "analytics_events"("shop_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_number_key" ON "support_tickets"("number");

-- CreateIndex
CREATE INDEX "support_tickets_status_priority_first_response_due_at_idx" ON "support_tickets"("status", "priority", "first_response_due_at");

-- CreateIndex
CREATE INDEX "support_tickets_requester_user_id_idx" ON "support_tickets"("requester_user_id");

-- CreateIndex
CREATE INDEX "support_messages_ticket_id_createdAt_idx" ON "support_messages"("ticket_id", "createdAt");

-- CreateIndex
CREATE INDEX "support_reply_templates_category_idx" ON "support_reply_templates"("category");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_categories_slug_key" ON "knowledge_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "guide_articles_slug_key" ON "guide_articles"("slug");

-- CreateIndex
CREATE INDEX "guide_articles_category_id_status_published_at_idx" ON "guide_articles"("category_id", "status", "published_at");

-- AddForeignKey
ALTER TABLE "production_readings" ADD CONSTRAINT "production_readings_installed_system_id_fkey" FOREIGN KEY ("installed_system_id") REFERENCES "installed_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_reminders" ADD CONSTRAINT "maintenance_reminders_installed_system_id_fkey" FOREIGN KEY ("installed_system_id") REFERENCES "installed_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_certifications" ADD CONSTRAINT "shop_certifications_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_projects" ADD CONSTRAINT "shop_projects_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_project_images" ADD CONSTRAINT "shop_project_images_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "shop_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "widget_configs" ADD CONSTRAINT "widget_configs_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_articles" ADD CONSTRAINT "guide_articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "knowledge_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Bilimlar markazi qidiruvi (TZ 7.7): trigram GIN.
CREATE INDEX "guide_articles_search_trgm" ON "guide_articles" USING GIN ("search_text" gin_trgm_ops);
-- Ishlab chiqarish manfiy emas; baho 1..5.
ALTER TABLE "production_readings" ADD CONSTRAINT "production_readings_kwh_nonneg" CHECK ("generated_kwh" >= 0);
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_satisfaction_range" CHECK ("satisfaction" IS NULL OR "satisfaction" BETWEEN 1 AND 5);
-- Rasmiy diler sertifikatida brend majburiy (TZ 7.3).
ALTER TABLE "shop_certifications" ADD CONSTRAINT "shop_certifications_dealer_brand" CHECK ("cert_type" <> 'OFFICIAL_DEALER' OR "brand" IS NOT NULL);
