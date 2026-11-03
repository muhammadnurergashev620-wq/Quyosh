-- CreateEnum
CREATE TYPE "QuoteRequestStatus" AS ENUM ('OPEN', 'CLOSED_SELECTED', 'CLOSED_NO_SELECTION', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RequestShopStatus" AS ENUM ('SENT', 'VIEWED', 'CLARIFICATION_REQUESTED', 'QUOTED', 'DECLINED', 'SELECTED', 'NOT_SELECTED');

-- CreateEnum
CREATE TYPE "PipelineStage" AS ENUM ('NEW', 'CONTACTED', 'SITE_VISIT', 'PROPOSAL', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "MessageSide" AS ENUM ('CUSTOMER', 'SHOP', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SiteVisitStatus" AS ENUM ('PROPOSED', 'CONFIRMED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "QuoteItemType" AS ENUM ('EQUIPMENT', 'INSTALLATION', 'DELIVERY', 'OTHER');

-- CreateEnum
CREATE TYPE "InstallationStatus" AS ENUM ('AGREED', 'SITE_VISIT_SCHEDULED', 'INSTALLATION_SCHEDULED', 'INSTALLED', 'CONFIRMED', 'DISPUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'PUBLISHED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ComplaintTargetType" AS ENUM ('REVIEW', 'SHOP', 'PRODUCT_MODEL', 'MESSAGE', 'USER');

-- CreateEnum
CREATE TYPE "ComplaintReason" AS ENUM ('SPAM', 'FAKE', 'ABUSE', 'WRONG_INFO', 'OTHER');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'RESOLVED', 'REJECTED');

-- CreateTable
CREATE TABLE "quote_requests" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "site_id" UUID,
    "calculation_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "system_type" "SystemType" NOT NULL,
    "required_capacity_kw" DECIMAL(10,2),
    "battery_needed" BOOLEAN NOT NULL DEFAULT false,
    "installation_needed" BOOLEAN NOT NULL DEFAULT true,
    "financing_interest" BOOLEAN NOT NULL DEFAULT false,
    "notes" VARCHAR(2000),
    "region_code" VARCHAR(32),
    "district_code" VARCHAR(32),
    "status" "QuoteRequestStatus" NOT NULL DEFAULT 'OPEN',
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_request_shops" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "status" "RequestShopStatus" NOT NULL DEFAULT 'SENT',
    "contact_revealed_at" TIMESTAMP(3),
    "assigned_member_id" UUID,
    "pipeline_stage" "PipelineStage" NOT NULL DEFAULT 'NEW',
    "decline_reason" VARCHAR(1000),
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewed_at" TIMESTAMP(3),
    "first_response_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_request_shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_lead_notes" (
    "id" UUID NOT NULL,
    "request_shop_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" VARCHAR(4000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_lead_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_messages" (
    "id" UUID NOT NULL,
    "request_shop_id" UUID NOT NULL,
    "sender_user_id" UUID,
    "sender_side" "MessageSide" NOT NULL,
    "body" VARCHAR(4000) NOT NULL,
    "system_kind" VARCHAR(40),
    "attachment_file_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "client_id" VARCHAR(64),
    "read_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_visits" (
    "id" UUID NOT NULL,
    "request_shop_id" UUID NOT NULL,
    "proposed_slots_json" JSONB NOT NULL,
    "confirmed_start" TIMESTAMP(3),
    "confirmed_end" TIMESTAMP(3),
    "status" "SiteVisitStatus" NOT NULL DEFAULT 'PROPOSED',
    "notes" VARCHAR(2000),
    "cancel_reason" VARCHAR(1000),
    "proposed_by_id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "current_revision" INTEGER NOT NULL DEFAULT 0,
    "equipment_subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "installation_subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "delivery_cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "other_costs" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "vat_included" BOOLEAN NOT NULL DEFAULT true,
    "vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 12,
    "vat_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'UZS',
    "exchange_rate_usd" DECIMAL(18,6),
    "exchange_rate_date" DATE,
    "system_power_kw" DECIMAL(10,2),
    "system_type" "SystemType",
    "warranty_equipment_months" INTEGER,
    "warranty_installation_months" INTEGER,
    "warranty_text" VARCHAR(4000),
    "duration_days" INTEGER,
    "included_scope" VARCHAR(4000),
    "excluded_scope" VARCHAR(4000),
    "valid_until" DATE,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "viewed_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "decided_at" TIMESTAMP(3),
    "reject_reason" VARCHAR(1000),
    "expiring_notified_at" TIMESTAMP(3),
    "created_by_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_revisions" (
    "id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "snapshot_json" JSONB NOT NULL,
    "created_by" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_items" (
    "id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "product_model_id" UUID,
    "service_id" UUID,
    "title_snapshot" VARCHAR(300) NOT NULL,
    "specs_snapshot_json" JSONB,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit_price" DECIMAL(18,2) NOT NULL,
    "line_total" DECIMAL(18,2) NOT NULL,
    "item_type" "QuoteItemType" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quote_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_financing_options" (
    "id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "financing_type" "FinancingType" NOT NULL,
    "provider_name" VARCHAR(200) NOT NULL,
    "annual_rate" DECIMAL(9,6) NOT NULL,
    "term_months" INTEGER NOT NULL,
    "down_payment_pct" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "payment_type" "PaymentType" NOT NULL DEFAULT 'ANNUITY',
    "notes" VARCHAR(1000),

    CONSTRAINT "quote_financing_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installations" (
    "id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "status" "InstallationStatus" NOT NULL DEFAULT 'AGREED',
    "scheduled_date" DATE,
    "installed_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "cancel_reason" VARCHAR(1000),
    "dispute_reason" VARCHAR(2000),
    "checklist_template_id" UUID,
    "checklist_result_json" JSONB,
    "checklist_completed_at" TIMESTAMP(3),
    "history_json" JSONB NOT NULL DEFAULT '[]',
    "reminders_sent" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acceptance_checklist_templates" (
    "id" UUID NOT NULL,
    "system_type" "SystemType" NOT NULL,
    "version" INTEGER NOT NULL,
    "items_json" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acceptance_checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installed_systems" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "site_id" UUID,
    "installation_id" UUID,
    "system_power_kw" DECIMAL(10,2) NOT NULL,
    "system_type" "SystemType" NOT NULL,
    "components_json" JSONB NOT NULL,
    "checklist_json" JSONB,
    "installed_at" TIMESTAMP(3) NOT NULL,
    "expected_monthly_kwh_json" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "installed_systems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warranty_items" (
    "id" UUID NOT NULL,
    "installed_system_id" UUID NOT NULL,
    "component" VARCHAR(200) NOT NULL,
    "months" INTEGER NOT NULL,
    "starts_at" DATE NOT NULL,
    "ends_at" DATE NOT NULL,

    CONSTRAINT "warranty_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "installation_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" VARCHAR(2000),
    "moderation_status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "moderated_at" TIMESTAMP(3),
    "moderated_by_id" UUID,
    "risk_flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "risk_score" INTEGER NOT NULL DEFAULT 0,
    "ip_hash" VARCHAR(64),
    "device_hash" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_replies" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "moderation_status" "ModerationStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaints" (
    "id" UUID NOT NULL,
    "reporter_id" UUID,
    "target_type" "ComplaintTargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "reason" "ComplaintReason" NOT NULL,
    "details" VARCHAR(2000),
    "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "resolved_by" UUID,
    "resolved_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "shop_id" UUID,
    "product_model_id" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_settings" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "rules_json" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quote_requests_number_key" ON "quote_requests"("number");

-- CreateIndex
CREATE INDEX "quote_requests_user_id_status_createdAt_idx" ON "quote_requests"("user_id", "status", "createdAt");

-- CreateIndex
CREATE INDEX "quote_requests_status_last_activity_at_idx" ON "quote_requests"("status", "last_activity_at");

-- CreateIndex
CREATE INDEX "quote_request_shops_shop_id_status_idx" ON "quote_request_shops"("shop_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "quote_request_shops_request_id_shop_id_key" ON "quote_request_shops"("request_id", "shop_id");

-- CreateIndex
CREATE INDEX "shop_lead_notes_request_shop_id_idx" ON "shop_lead_notes"("request_shop_id");

-- CreateIndex
CREATE INDEX "conversation_messages_request_shop_id_createdAt_idx" ON "conversation_messages"("request_shop_id", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_messages_request_shop_id_client_id_key" ON "conversation_messages"("request_shop_id", "client_id");

-- CreateIndex
CREATE INDEX "site_visits_request_shop_id_idx" ON "site_visits"("request_shop_id");

-- CreateIndex
CREATE INDEX "quotes_request_id_shop_id_status_idx" ON "quotes"("request_id", "shop_id", "status");

-- CreateIndex
CREATE INDEX "quotes_status_valid_until_idx" ON "quotes"("status", "valid_until");

-- CreateIndex
CREATE UNIQUE INDEX "quote_revisions_quote_id_revision_key" ON "quote_revisions"("quote_id", "revision");

-- CreateIndex
CREATE INDEX "quote_items_quote_id_idx" ON "quote_items"("quote_id");

-- CreateIndex
CREATE INDEX "quote_financing_options_quote_id_idx" ON "quote_financing_options"("quote_id");

-- CreateIndex
CREATE UNIQUE INDEX "installations_quote_id_key" ON "installations"("quote_id");

-- CreateIndex
CREATE INDEX "installations_user_id_status_idx" ON "installations"("user_id", "status");

-- CreateIndex
CREATE INDEX "installations_shop_id_status_idx" ON "installations"("shop_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "acceptance_checklist_templates_system_type_version_key" ON "acceptance_checklist_templates"("system_type", "version");

-- CreateIndex
CREATE UNIQUE INDEX "installed_systems_installation_id_key" ON "installed_systems"("installation_id");

-- CreateIndex
CREATE INDEX "installed_systems_user_id_idx" ON "installed_systems"("user_id");

-- CreateIndex
CREATE INDEX "warranty_items_installed_system_id_ends_at_idx" ON "warranty_items"("installed_system_id", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_installation_id_key" ON "reviews"("installation_id");

-- CreateIndex
CREATE INDEX "reviews_shop_id_moderation_status_idx" ON "reviews"("shop_id", "moderation_status");

-- CreateIndex
CREATE INDEX "reviews_ip_hash_createdAt_idx" ON "reviews"("ip_hash", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "review_replies_review_id_key" ON "review_replies"("review_id");

-- CreateIndex
CREATE INDEX "complaints_target_type_target_id_idx" ON "complaints"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "complaints_status_idx" ON "complaints"("status");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_shop_id_key" ON "favorites"("user_id", "shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_product_model_id_key" ON "favorites"("user_id", "product_model_id");

-- CreateIndex
CREATE UNIQUE INDEX "moderation_settings_version_key" ON "moderation_settings"("version");

-- AddForeignKey
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_request_shops" ADD CONSTRAINT "quote_request_shops_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "quote_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_request_shops" ADD CONSTRAINT "quote_request_shops_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_request_shops" ADD CONSTRAINT "quote_request_shops_assigned_member_id_fkey" FOREIGN KEY ("assigned_member_id") REFERENCES "shop_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_lead_notes" ADD CONSTRAINT "shop_lead_notes_request_shop_id_fkey" FOREIGN KEY ("request_shop_id") REFERENCES "quote_request_shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_request_shop_id_fkey" FOREIGN KEY ("request_shop_id") REFERENCES "quote_request_shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_request_shop_id_fkey" FOREIGN KEY ("request_shop_id") REFERENCES "quote_request_shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "quote_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_revisions" ADD CONSTRAINT "quote_revisions_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_financing_options" ADD CONSTRAINT "quote_financing_options_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installations" ADD CONSTRAINT "installations_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installations" ADD CONSTRAINT "installations_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installations" ADD CONSTRAINT "installations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installed_systems" ADD CONSTRAINT "installed_systems_installation_id_fkey" FOREIGN KEY ("installation_id") REFERENCES "installations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_items" ADD CONSTRAINT "warranty_items_installed_system_id_fkey" FOREIGN KEY ("installed_system_id") REFERENCES "installed_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_installation_id_fkey" FOREIGN KEY ("installation_id") REFERENCES "installations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_replies" ADD CONSTRAINT "review_replies_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_product_model_id_fkey" FOREIGN KEY ("product_model_id") REFERENCES "product_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- TZ 7.6: bitta so‘rovga bitta do‘kondan bitta faol taklif (WITHDRAWN tashqari).
CREATE UNIQUE INDEX "quotes_one_active_per_shop" ON "quotes" ("request_id", "shop_id") WHERE "status" <> 'WITHDRAWN';

-- TZ 13.3: summalar manfiy emas.
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_total_nonneg" CHECK ("total" >= 0 AND "discount_amount" >= 0 AND "vat_amount" >= 0);
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_qty_pos" CHECK ("quantity" > 0 AND "unit_price" >= 0);

-- TZ 7.7: reyting 1..5; sevimlida aynan bittasi.
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_exactly_one" CHECK (num_nonnulls("shop_id", "product_model_id") = 1);

-- Faqat bitta faol moderatsiya sozlamasi.
CREATE UNIQUE INDEX "moderation_settings_one_active" ON "moderation_settings" ("active") WHERE "active";

-- DUPLICATE_TEXT (13.4) — trigram o‘xshashligi.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
