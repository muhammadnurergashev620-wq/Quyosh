-- M4: hisoblash ma’lumotlari (TZ 7.5). Tarif/eksport qoidalari versiyalanadi; PUBLISHED davrlar kesishmaydi.
-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('HOUSEHOLD', 'LEGAL');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TouPeriodType" AS ENUM ('ALL', 'DAY', 'NIGHT');

-- CreateEnum
CREATE TYPE "CompensationType" AS ENUM ('NONE', 'NET_METERING', 'NET_BILLING', 'FEED_IN');

-- CreateEnum
CREATE TYPE "SettlementPeriod" AS ENUM ('MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "FinancingType" AS ENUM ('BANK_LOAN', 'INSTALLMENT', 'LEASING');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('ANNUITY', 'DIFFERENTIATED');

-- CreateEnum
CREATE TYPE "SolarProvider" AS ENUM ('PVGIS', 'NASA_POWER', 'DEFAULT');

-- CreateEnum
CREATE TYPE "DatasetStatus" AS ENUM ('FRESH', 'STALE', 'FAILED');

-- CreateEnum
CREATE TYPE "SystemType" AS ENUM ('ON_GRID', 'HYBRID', 'OFF_GRID');

-- CreateEnum
CREATE TYPE "CalcMode" AS ENUM ('QUICK', 'DETAILED');

-- CreateEnum
CREATE TYPE "ProductionMethod" AS ENUM ('A_PV_YIELD', 'B_IRRADIANCE', 'DEFAULT');

-- CreateTable
CREATE TABLE "tariff_schedules" (
    "id" UUID NOT NULL,
    "region_code" VARCHAR(32) NOT NULL,
    "customer_type" "CustomerType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "billing_period" VARCHAR(16) NOT NULL DEFAULT 'MONTH',
    "fixed_charge_monthly" DECIMAL(18,2),
    "tou_enabled" BOOLEAN NOT NULL DEFAULT false,
    "source_url" VARCHAR(1000),
    "verified_at" TIMESTAMP(3),
    "verified_by_id" UUID,
    "effective_from" DATE NOT NULL,
    "effective_until" DATE,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tariff_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tariff_tiers" (
    "id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "season_months" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "tou_period" "TouPeriodType" NOT NULL DEFAULT 'ALL',
    "min_kwh" DECIMAL(14,3) NOT NULL,
    "max_kwh" DECIMAL(14,3),
    "rate_per_kwh" DECIMAL(18,6) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'UZS',
    "notes" VARCHAR(500),

    CONSTRAINT "tariff_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tariff_tou_periods" (
    "id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "tou_period" "TouPeriodType" NOT NULL,
    "start_hour" INTEGER NOT NULL,
    "end_hour" INTEGER NOT NULL,

    CONSTRAINT "tariff_tou_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_rules" (
    "id" UUID NOT NULL,
    "region_code" VARCHAR(32) NOT NULL,
    "customer_type" "CustomerType" NOT NULL,
    "compensation_type" "CompensationType" NOT NULL,
    "rate_per_kwh" DECIMAL(18,6),
    "settlement_period" "SettlementPeriod" NOT NULL DEFAULT 'MONTH',
    "max_system_kw" DECIMAL(12,3),
    "eligibility_json" JSONB,
    "currency" "Currency" NOT NULL DEFAULT 'UZS',
    "source_url" VARCHAR(1000),
    "verified_at" TIMESTAMP(3),
    "effective_from" DATE NOT NULL,
    "effective_until" DATE,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "export_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grid_connection_limits" (
    "id" UUID NOT NULL,
    "region_code" VARCHAR(32) NOT NULL,
    "customer_type" "CustomerType" NOT NULL,
    "max_kw" DECIMAL(12,3) NOT NULL,
    "source_url" VARCHAR(1000),
    "verified_at" TIMESTAMP(3),
    "effective_from" DATE NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grid_connection_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "load_profiles" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name_i18n" JSONB NOT NULL,
    "monthly_factors" DECIMAL(8,5)[],
    "hourly_factors_json" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "load_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appliance_types" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name_i18n" JSONB NOT NULL,
    "default_power_w" INTEGER NOT NULL,
    "default_hours_per_day" DECIMAL(5,2) NOT NULL,
    "default_months" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "surge_factor" DECIMAL(5,2) NOT NULL DEFAULT 1,
    "hourly_usage_template" DECIMAL(8,5)[],
    "is_motor_load" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "appliance_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appliance_templates" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name_i18n" JSONB NOT NULL,
    "items_json" JSONB NOT NULL,
    "customer_type" "CustomerType" NOT NULL DEFAULT 'HOUSEHOLD',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "appliance_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financing_products" (
    "id" UUID NOT NULL,
    "provider_name" VARCHAR(200) NOT NULL,
    "financing_type" "FinancingType" NOT NULL,
    "annual_rate" DECIMAL(18,6) NOT NULL,
    "min_term_months" INTEGER NOT NULL,
    "max_term_months" INTEGER NOT NULL,
    "allowed_terms" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "min_down_payment_pct" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "max_amount" DECIMAL(18,2),
    "one_time_fee_pct" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "monthly_fee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "payment_type" "PaymentType" NOT NULL DEFAULT 'ANNUITY',
    "customer_types" "CustomerType"[],
    "source_url" VARCHAR(1000),
    "verified_at" TIMESTAMP(3),
    "effective_from" DATE NOT NULL,
    "effective_until" DATE,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financing_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculation_settings" (
    "id" UUID NOT NULL,
    "model_version" VARCHAR(40) NOT NULL,
    "parameters_json" JSONB NOT NULL,
    "source_notes" VARCHAR(4000),
    "effective_from" DATE NOT NULL,
    "effective_until" DATE,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calculation_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solar_datasets" (
    "id" UUID NOT NULL,
    "provider" "SolarProvider" NOT NULL,
    "cell_key" VARCHAR(40) NOT NULL,
    "tilt_bucket" INTEGER NOT NULL,
    "azimuth_bucket" INTEGER NOT NULL,
    "database" VARCHAR(40) NOT NULL DEFAULT '',
    "dataset_version" VARCHAR(40) NOT NULL DEFAULT '',
    "object_key" VARCHAR(300),
    "annual_yield_kwh_per_kwp" DECIMAL(10,2) NOT NULL,
    "monthly_yield_json" JSONB NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "status" "DatasetStatus" NOT NULL DEFAULT 'FRESH',

    CONSTRAINT "solar_datasets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regional_yields" (
    "id" UUID NOT NULL,
    "region_code" VARCHAR(32) NOT NULL,
    "monthly_yield_json" JSONB NOT NULL,
    "source_note" VARCHAR(1000),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regional_yields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "site_id" UUID,
    "title" VARCHAR(200),
    "mode" "CalcMode" NOT NULL,
    "system_type" "SystemType" NOT NULL,
    "input_snapshot_json" JSONB NOT NULL,
    "output_summary_json" JSONB NOT NULL,
    "hourly_series_object_key" VARCHAR(300),
    "model_version" VARCHAR(40) NOT NULL,
    "calculation_settings_id" UUID,
    "tariff_schedule_id" UUID,
    "export_rule_id" UUID,
    "financing_product_id" UUID,
    "solar_dataset_id" UUID,
    "exchange_rate_id" UUID,
    "production_method" "ProductionMethod" NOT NULL,
    "archived_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calculations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tariff_schedules_region_code_customer_type_status_effective_idx" ON "tariff_schedules"("region_code", "customer_type", "status", "effective_from");

-- CreateIndex
CREATE INDEX "tariff_tiers_schedule_id_idx" ON "tariff_tiers"("schedule_id");

-- CreateIndex
CREATE INDEX "tariff_tou_periods_schedule_id_idx" ON "tariff_tou_periods"("schedule_id");

-- CreateIndex
CREATE INDEX "export_rules_region_code_customer_type_status_effective_fro_idx" ON "export_rules"("region_code", "customer_type", "status", "effective_from");

-- CreateIndex
CREATE INDEX "grid_connection_limits_region_code_customer_type_status_idx" ON "grid_connection_limits"("region_code", "customer_type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "load_profiles_code_key" ON "load_profiles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "appliance_types_code_key" ON "appliance_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "appliance_templates_code_key" ON "appliance_templates"("code");

-- CreateIndex
CREATE INDEX "financing_products_status_effective_from_idx" ON "financing_products"("status", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "calculation_settings_model_version_key" ON "calculation_settings"("model_version");

-- CreateIndex
CREATE INDEX "calculation_settings_status_effective_from_idx" ON "calculation_settings"("status", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "solar_datasets_provider_cell_key_tilt_bucket_azimuth_bucket_key" ON "solar_datasets"("provider", "cell_key", "tilt_bucket", "azimuth_bucket", "database");

-- CreateIndex
CREATE UNIQUE INDEX "regional_yields_region_code_key" ON "regional_yields"("region_code");

-- CreateIndex
CREATE INDEX "calculations_user_id_createdAt_idx" ON "calculations"("user_id", "createdAt");

-- AddForeignKey
ALTER TABLE "tariff_tiers" ADD CONSTRAINT "tariff_tiers_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "tariff_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tariff_tou_periods" ADD CONSTRAINT "tariff_tou_periods_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "tariff_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculations" ADD CONSTRAINT "calculations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- TZ 7.5: bir hudud + iste’molchi turi uchun PUBLISHED tarif davrlari kesishmaydi.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "tariff_schedules" ADD CONSTRAINT "tariff_schedules_no_overlap"
  EXCLUDE USING gist ("region_code" WITH =, "customer_type" WITH =, daterange("effective_from", "effective_until", '[)') WITH &&)
  WHERE ("status" = 'PUBLISHED');
ALTER TABLE "export_rules" ADD CONSTRAINT "export_rules_no_overlap"
  EXCLUDE USING gist ("region_code" WITH =, "customer_type" WITH =, daterange("effective_from", "effective_until", '[)') WITH &&)
  WHERE ("status" = 'PUBLISHED');

-- TZ 10.1: sana oralig‘i; manfiy bo‘lmagan stavka va pog‘ona chegaralari.
ALTER TABLE "tariff_schedules" ADD CONSTRAINT "tariff_schedules_dates" CHECK ("effective_until" IS NULL OR "effective_until" >= "effective_from");
ALTER TABLE "export_rules" ADD CONSTRAINT "export_rules_dates" CHECK ("effective_until" IS NULL OR "effective_until" >= "effective_from");
ALTER TABLE "financing_products" ADD CONSTRAINT "financing_products_dates" CHECK ("effective_until" IS NULL OR "effective_until" >= "effective_from");
ALTER TABLE "calculation_settings" ADD CONSTRAINT "calculation_settings_dates" CHECK ("effective_until" IS NULL OR "effective_until" >= "effective_from");
ALTER TABLE "tariff_tiers" ADD CONSTRAINT "tariff_tiers_range" CHECK ("min_kwh" >= 0 AND ("max_kwh" IS NULL OR "max_kwh" > "min_kwh") AND "rate_per_kwh" >= 0);
ALTER TABLE "tariff_tou_periods" ADD CONSTRAINT "tariff_tou_hours" CHECK ("start_hour" BETWEEN 0 AND 23 AND "end_hour" BETWEEN 0 AND 24);
ALTER TABLE "financing_products" ADD CONSTRAINT "financing_products_terms" CHECK ("annual_rate" >= 0 AND "min_term_months" >= 1 AND "max_term_months" >= "min_term_months");
