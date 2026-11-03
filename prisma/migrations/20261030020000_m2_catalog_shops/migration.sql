-- CreateEnum
CREATE TYPE "ShopInvitationPurpose" AS ENUM ('INITIAL_OWNER', 'TRANSFER', 'MEMBER');

-- CreateEnum
CREATE TYPE "ShopInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ShopDocType" AS ENUM ('REGISTRATION', 'LICENSE', 'OTHER');

-- CreateEnum
CREATE TYPE "DocReviewStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BranchStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ProductModelStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'MERGED');

-- CreateEnum
CREATE TYPE "ShopProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('UZS', 'USD');

-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('IN_STOCK', 'ON_ORDER', 'OUT_OF_STOCK');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('INSTALLATION', 'SITE_VISIT', 'AUDIT', 'MAINTENANCE', 'DELIVERY');

-- CreateEnum
CREATE TYPE "PricingModel" AS ENUM ('FIXED', 'FROM', 'PER_KW', 'PER_UNIT', 'QUOTE_REQUIRED');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('UPLOADED', 'VALIDATED', 'APPLIED', 'FAILED');

-- CreateTable
CREATE TABLE "shop_invitations" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "invited_by_user_id" UUID NOT NULL,
    "target" VARCHAR(255) NOT NULL,
    "member_role" "ShopMemberRole" NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "purpose" "ShopInvitationPurpose" NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "status" "ShopInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "accepted_user_id" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_verification_documents" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "doc_type" "ShopDocType" NOT NULL,
    "status" "DocReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewer_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "reason" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_verification_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_branches" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "address" VARCHAR(500) NOT NULL,
    "region_code" VARCHAR(16),
    "phone" VARCHAR(32),
    "opening_hours_json" JSONB,
    "holiday_exceptions_json" JSONB,
    "status" "BranchStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "parent_id" UUID,
    "slug" VARCHAR(120) NOT NULL,
    "name_i18n" JSONB NOT NULL,
    "description_i18n" JSONB,
    "attribute_schema_json" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_models" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "brand" VARCHAR(120) NOT NULL,
    "model" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "status" "ProductModelStatus" NOT NULL DEFAULT 'PENDING',
    "merged_into_id" UUID,
    "reject_reason" VARCHAR(2000),
    "nominal_power_w" INTEGER,
    "efficiency_pct" DECIMAL(7,4),
    "width_mm" INTEGER,
    "height_mm" INTEGER,
    "weight_kg" DECIMAL(8,2),
    "temp_coeff_pmax_pct_per_c" DECIMAL(7,4),
    "voc_v" DECIMAL(8,3),
    "vmp_v" DECIMAL(8,3),
    "isc_a" DECIMAL(8,3),
    "imp_a" DECIMAL(8,3),
    "degradation_pct_per_year" DECIMAL(7,4),
    "inverter_ac_kw" DECIMAL(12,4),
    "inverter_max_dc_v" DECIMAL(8,2),
    "mppt_min_v" DECIMAL(8,2),
    "mppt_max_v" DECIMAL(8,2),
    "mppt_max_current_a" DECIMAL(8,2),
    "battery_voltage_v" DECIMAL(8,2),
    "battery_capacity_kwh" DECIMAL(14,4),
    "battery_usable_dod" DECIMAL(7,6),
    "battery_chemistry" VARCHAR(40),
    "battery_cycles" INTEGER,
    "warranty_months" INTEGER,
    "specs_json" JSONB,
    "datasheet_file_id" UUID,
    "proposed_by_shop_id" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_model_images" (
    "id" UUID NOT NULL,
    "product_model_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "alt_text" VARCHAR(255),
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_model_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_products" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "product_model_id" UUID NOT NULL,
    "description" VARCHAR(10000),
    "status" "ShopProductStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_offers" (
    "id" UUID NOT NULL,
    "shop_product_id" UUID NOT NULL,
    "branch_id" UUID,
    "price" DECIMAL(18,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'UZS',
    "vat_included" BOOLEAN NOT NULL DEFAULT true,
    "stock_status" "StockStatus" NOT NULL DEFAULT 'IN_STOCK',
    "quantity" INTEGER,
    "valid_from" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" DATE,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "branch_id" UUID,
    "service_type" "ServiceType" NOT NULL,
    "pricing_model" "PricingModel" NOT NULL,
    "price" DECIMAL(18,2),
    "currency" "Currency" NOT NULL DEFAULT 'UZS',
    "description_i18n" JSONB,
    "warranty_months" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" UUID NOT NULL,
    "currency" "Currency" NOT NULL,
    "rate_to_uzs" DECIMAL(18,6) NOT NULL,
    "rate_date" DATE NOT NULL,
    "source" VARCHAR(255) NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "rows_json" JSONB,
    "errors_json" JSONB,
    "applied_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shop_invitations_token_hash_key" ON "shop_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "shop_invitations_shop_id_status_idx" ON "shop_invitations"("shop_id", "status");

-- CreateIndex
CREATE INDEX "shop_invitations_expires_at_idx" ON "shop_invitations"("expires_at");

-- CreateIndex
CREATE INDEX "shop_verification_documents_shop_id_idx" ON "shop_verification_documents"("shop_id");

-- CreateIndex
CREATE INDEX "shop_branches_shop_id_idx" ON "shop_branches"("shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_models_slug_key" ON "product_models"("slug");

-- CreateIndex
CREATE INDEX "product_models_category_id_status_idx" ON "product_models"("category_id", "status");

-- CreateIndex
CREATE INDEX "product_models_nominal_power_w_idx" ON "product_models"("nominal_power_w");

-- CreateIndex
CREATE INDEX "product_models_battery_capacity_kwh_idx" ON "product_models"("battery_capacity_kwh");

-- CreateIndex
CREATE INDEX "product_models_inverter_ac_kw_idx" ON "product_models"("inverter_ac_kw");

-- CreateIndex
CREATE UNIQUE INDEX "product_models_brand_model_key" ON "product_models"("brand", "model");

-- CreateIndex
CREATE INDEX "product_model_images_product_model_id_idx" ON "product_model_images"("product_model_id");

-- CreateIndex
CREATE INDEX "shop_products_shop_id_status_idx" ON "shop_products"("shop_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "shop_products_shop_id_product_model_id_key" ON "shop_products"("shop_id", "product_model_id");

-- CreateIndex
CREATE INDEX "product_offers_shop_product_id_branch_id_stock_status_idx" ON "product_offers"("shop_product_id", "branch_id", "stock_status");

-- CreateIndex
CREATE INDEX "services_shop_id_service_type_active_idx" ON "services"("shop_id", "service_type", "active");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_currency_rate_date_key" ON "exchange_rates"("currency", "rate_date");

-- CreateIndex
CREATE INDEX "import_jobs_shop_id_createdAt_idx" ON "import_jobs"("shop_id", "createdAt");

-- AddForeignKey
ALTER TABLE "shop_invitations" ADD CONSTRAINT "shop_invitations_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_invitations" ADD CONSTRAINT "shop_invitations_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_verification_documents" ADD CONSTRAINT "shop_verification_documents_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_branches" ADD CONSTRAINT "shop_branches_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_models" ADD CONSTRAINT "product_models_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_models" ADD CONSTRAINT "product_models_merged_into_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "product_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_models" ADD CONSTRAINT "product_models_proposed_by_shop_id_fkey" FOREIGN KEY ("proposed_by_shop_id") REFERENCES "shops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_model_images" ADD CONSTRAINT "product_model_images_product_model_id_fkey" FOREIGN KEY ("product_model_id") REFERENCES "product_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_products" ADD CONSTRAINT "shop_products_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_products" ADD CONSTRAINT "shop_products_product_model_id_fkey" FOREIGN KEY ("product_model_id") REFERENCES "product_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_offers" ADD CONSTRAINT "product_offers_shop_product_id_fkey" FOREIGN KEY ("shop_product_id") REFERENCES "shop_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_offers" ADD CONSTRAINT "product_offers_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "shop_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "shop_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- TZ 3.7.2: bir do‘konda bir vaqtda bitta faol (PENDING) OWNER taklifi.
CREATE UNIQUE INDEX "shop_invitations_one_pending_owner" ON "shop_invitations" ("shop_id") WHERE "status" = 'PENDING' AND "member_role" = 'OWNER';

-- TZ 10.1: narx ≥ 0, sanalar oralig‘i to‘g‘ri; STIR 9 raqam.
ALTER TABLE "product_offers" ADD CONSTRAINT "product_offers_price_nonneg" CHECK ("price" >= 0);
ALTER TABLE "product_offers" ADD CONSTRAINT "product_offers_valid_range" CHECK ("valid_until" IS NULL OR "valid_until" >= "valid_from");
ALTER TABLE "services" ADD CONSTRAINT "services_price_nonneg" CHECK ("price" IS NULL OR "price" >= 0);
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_positive" CHECK ("rate_to_uzs" > 0);
ALTER TABLE "shops" ADD CONSTRAINT "shops_stir_format" CHECK ("stir" IS NULL OR "stir" ~ '^[0-9]{9}$');

-- TZ 7.4: specsJson uchun GIN; qidiruv uchun brend/model trigram.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "product_models_specs_gin" ON "product_models" USING GIN ("specs_json");
CREATE INDEX "product_models_search_trgm" ON "product_models" USING GIN ((lower("brand" || ' ' || "model")) gin_trgm_ops);
