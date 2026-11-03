-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'SHOP', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'BLOCKED', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('REGISTER', 'LOGIN', 'PHONE_VERIFICATION', 'PASSWORD_RESET', 'CHANGE_PHONE');

-- CreateEnum
CREATE TYPE "OtpStatus" AS ENUM ('ACTIVE', 'VERIFIED', 'EXPIRED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PolicyType" AS ENUM ('TERMS', 'PRIVACY', 'PLATFORM_RULES');

-- CreateEnum
CREATE TYPE "PolicyStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MediaAssetStatus" AS ENUM ('UPLOADING', 'QUARANTINED', 'SCANNING', 'PROCESSING', 'READY', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "MediaAssetKind" AS ENUM ('PRODUCT_IMAGE', 'SHOP_LOGO', 'VERIFICATION_DOC', 'MESSAGE_ATTACHMENT', 'REPORT', 'IMPORT', 'PORTFOLIO', 'USER_AVATAR');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'PUSH', 'SMS', 'TELEGRAM', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "ShopStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ShopVerificationStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ShopCreatedSource" AS ENUM ('SELF', 'ADMIN');

-- CreateEnum
CREATE TYPE "ShopMemberRole" AS ENUM ('OWNER', 'MANAGER', 'STAFF');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "account_number" SERIAL NOT NULL,
    "phone" VARCHAR(32),
    "email" VARCHAR(255),
    "google_id" VARCHAR(64),
    "google_email" VARCHAR(255),
    "password_hash" TEXT,
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(100),
    "avatar_url" TEXT,
    "avatar_asset_id" UUID,
    "avatar_updated_at" TIMESTAMP(3),
    "admin_avatar_allowed" BOOLEAN NOT NULL DEFAULT false,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "phone_verified_at" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "preferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
    "admin_permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "can_create_admins" BOOLEAN NOT NULL DEFAULT false,
    "grantable_permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_by_admin_id" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "token" VARCHAR(512) NOT NULL,
    "platform" VARCHAR(16) NOT NULL DEFAULT 'android',
    "panel" VARCHAR(16),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "deviceId" VARCHAR(255) NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "user_agent" VARCHAR(400),
    "ip_address" VARCHAR(64),
    "panel" VARCHAR(16),

    CONSTRAINT "device_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "familyId" UUID NOT NULL,
    "deviceId" VARCHAR(255) NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocked_phones" (
    "id" UUID NOT NULL,
    "phone" VARCHAR(32) NOT NULL,
    "reason" VARCHAR(500),
    "blocked_by_id" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_phones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "phone" VARCHAR(32) NOT NULL,
    "code_hash" VARCHAR(255) NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "status" "OtpStatus" NOT NULL DEFAULT 'ACTIVE',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified_at" TIMESTAMP(3),
    "ip_address" VARCHAR(64),
    "panel" VARCHAR(16),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_versions" (
    "id" UUID NOT NULL,
    "type" "PolicyType" NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "status" "PolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_acceptances" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "policyId" UUID NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(64),

    CONSTRAINT "policy_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "template" VARCHAR(150),
    "data" JSONB,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "uploaderId" UUID NOT NULL,
    "kind" "MediaAssetKind" NOT NULL,
    "status" "MediaAssetStatus" NOT NULL DEFAULT 'UPLOADING',
    "quarantine_key" TEXT,
    "original_key" TEXT,
    "thumbnail_key" TEXT,
    "medium_key" TEXT,
    "original_name" VARCHAR(255) NOT NULL,
    "declared_mime_type" VARCHAR(150) NOT NULL,
    "detected_mime_type" VARCHAR(150),
    "size_bytes" BIGINT NOT NULL,
    "scan_result" VARCHAR(50),
    "rejection_reason" TEXT,
    "linked_resource_type" VARCHAR(50),
    "linked_resource_id" UUID,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "cleaned_up_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "userId" UUID NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "endpoint" VARCHAR(255) NOT NULL,
    "request_hash" VARCHAR(255) NOT NULL,
    "response_status" INTEGER,
    "responseBody" JSONB,
    "resource_type" VARCHAR(100),
    "resource_id" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "event_name" VARCHAR(150) NOT NULL,
    "event_version" INTEGER NOT NULL DEFAULT 1,
    "aggregate_type" VARCHAR(100) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),
    "last_error" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" VARCHAR(150) NOT NULL,
    "target_type" VARCHAR(100),
    "target_id" UUID,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "ip_address" VARCHAR(64),
    "device" TEXT,
    "request_id" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "error_logs" (
    "id" UUID NOT NULL,
    "source" VARCHAR(16) NOT NULL,
    "kind" VARCHAR(32) NOT NULL,
    "severity" VARCHAR(16) NOT NULL,
    "status" INTEGER,
    "code" VARCHAR(100),
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "method" VARCHAR(10),
    "path" VARCHAR(500),
    "page_url" VARCHAR(500),
    "request_id" VARCHAR(100),
    "user_id" UUID,
    "user_role" VARCHAR(20),
    "panel" VARCHAR(20),
    "platform" VARCHAR(20),
    "user_agent" VARCHAR(400),
    "ip_address" VARCHAR(64),
    "app_version" VARCHAR(40),
    "context" JSONB,
    "fingerprint" VARCHAR(64) NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shops" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(10000),
    "logo_asset_id" UUID,
    "cover_asset_id" UUID,
    "stir" VARCHAR(9),
    "phone" VARCHAR(32),
    "email" VARCHAR(255),
    "verification_status" "ShopVerificationStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "status" "ShopStatus" NOT NULL DEFAULT 'DRAFT',
    "created_source" "ShopCreatedSource" NOT NULL DEFAULT 'SELF',
    "created_by_user_id" UUID,
    "suspended_at" TIMESTAMP(3),
    "suspend_reason" VARCHAR(2000),
    "avg_response_minutes" INTEGER,
    "rating_avg" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_members" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "member_role" "ShopMemberRole" NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_account_number_key" ON "users"("account_number");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_avatar_asset_id_key" ON "users"("avatar_asset_id");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_role_key" ON "user_roles"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens"("token");

-- CreateIndex
CREATE INDEX "push_tokens_userId_idx" ON "push_tokens"("userId");

-- CreateIndex
CREATE INDEX "device_sessions_userId_status_idx" ON "device_sessions"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "device_sessions_userId_deviceId_key" ON "device_sessions"("userId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_deviceId_status_idx" ON "refresh_tokens"("userId", "deviceId", "status");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_status_idx" ON "refresh_tokens"("userId", "status");

-- CreateIndex
CREATE INDEX "refresh_tokens_familyId_idx" ON "refresh_tokens"("familyId");

-- CreateIndex
CREATE INDEX "refresh_tokens_familyId_deviceId_status_idx" ON "refresh_tokens"("familyId", "deviceId", "status");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "blocked_phones_phone_key" ON "blocked_phones"("phone");

-- CreateIndex
CREATE INDEX "otp_codes_phone_purpose_status_idx" ON "otp_codes"("phone", "purpose", "status");

-- CreateIndex
CREATE INDEX "otp_codes_ip_address_purpose_createdAt_idx" ON "otp_codes"("ip_address", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "otp_codes_expires_at_idx" ON "otp_codes"("expires_at");

-- CreateIndex
CREATE INDEX "policy_versions_type_status_idx" ON "policy_versions"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "policy_versions_type_version_key" ON "policy_versions"("type", "version");

-- CreateIndex
CREATE INDEX "policy_acceptances_policyId_idx" ON "policy_acceptances"("policyId");

-- CreateIndex
CREATE UNIQUE INDEX "policy_acceptances_userId_policyId_key" ON "policy_acceptances"("userId", "policyId");

-- CreateIndex
CREATE INDEX "notifications_userId_status_createdAt_idx" ON "notifications"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_channel_status_idx" ON "notifications"("channel", "status");

-- CreateIndex
CREATE INDEX "media_assets_uploaderId_status_idx" ON "media_assets"("uploaderId", "status");

-- CreateIndex
CREATE INDEX "media_assets_linked_resource_type_linked_resource_id_idx" ON "media_assets"("linked_resource_type", "linked_resource_id");

-- CreateIndex
CREATE INDEX "media_assets_status_updatedAt_idx" ON "media_assets"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_userId_method_endpoint_key_key" ON "idempotency_keys"("userId", "method", "endpoint", "key");

-- CreateIndex
CREATE INDEX "outbox_events_status_available_at_idx" ON "outbox_events"("status", "available_at");

-- CreateIndex
CREATE INDEX "outbox_events_aggregate_type_aggregate_id_idx" ON "outbox_events"("aggregate_type", "aggregate_id");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_createdAt_idx" ON "audit_logs"("target_type", "target_id", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "error_logs_createdAt_idx" ON "error_logs"("createdAt");

-- CreateIndex
CREATE INDEX "error_logs_fingerprint_createdAt_idx" ON "error_logs"("fingerprint", "createdAt");

-- CreateIndex
CREATE INDEX "error_logs_user_id_createdAt_idx" ON "error_logs"("user_id", "createdAt");

-- CreateIndex
CREATE INDEX "error_logs_source_severity_createdAt_idx" ON "error_logs"("source", "severity", "createdAt");

-- CreateIndex
CREATE INDEX "error_logs_resolved_at_idx" ON "error_logs"("resolved_at");

-- CreateIndex
CREATE UNIQUE INDEX "shops_slug_key" ON "shops"("slug");

-- CreateIndex
CREATE INDEX "shops_status_idx" ON "shops"("status");

-- CreateIndex
CREATE INDEX "shop_members_user_id_idx" ON "shop_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "shop_members_shop_id_user_id_key" ON "shop_members"("shop_id", "user_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_avatar_asset_id_fkey" FOREIGN KEY ("avatar_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_acceptances" ADD CONSTRAINT "policy_acceptances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_acceptances" ADD CONSTRAINT "policy_acceptances_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shops" ADD CONSTRAINT "shops_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_members" ADD CONSTRAINT "shop_members_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_members" ADD CONSTRAINT "shop_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- TZ 2.1 / 7.3: har do‘konda aynan bitta OWNER (egalikning yagona manbai).
CREATE UNIQUE INDEX "shop_members_one_owner_per_shop" ON "shop_members" ("shop_id") WHERE "member_role" = 'OWNER';

-- TZ 7.2: email yoki phone dan kamida bittasi majburiy.
ALTER TABLE "users" ADD CONSTRAINT "users_contact_required" CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL OR "google_id" IS NOT NULL);
