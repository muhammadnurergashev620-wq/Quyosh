-- v3.1: do‘konni faqat admin yaratadi — ShopInvitation (taklif havolasi) olib tashlanadi, User.must_password_change qo‘shiladi,
-- bosh sayt bloklaridan do‘konga oid maydonlar o‘chiriladi (bosh sayt faqat mijoz uchun).
-- DropForeignKey
ALTER TABLE "shop_invitations" DROP CONSTRAINT "shop_invitations_invited_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "shop_invitations" DROP CONSTRAINT "shop_invitations_shop_id_fkey";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "must_password_change" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "shop_invitations";

-- DropEnum
DROP TYPE "ShopInvitationPurpose";

-- DropEnum
DROP TYPE "ShopInvitationStatus";

-- Bosh sayt (SiteBlock): do‘konga oid maydonlar va FAQ savoli (nashr va qoralama; uz/ru/oz).
CREATE FUNCTION pg_temp.strip_shop_content(block text, content jsonb) RETURNS jsonb LANGUAGE sql AS $$
  SELECT coalesce(jsonb_object_agg(l.key,
    CASE
      WHEN jsonb_typeof(l.value) <> 'object' THEN l.value
      WHEN block IN ('HERO', 'FINALE') THEN l.value - 'ctaSecondary'
      WHEN block = 'PATHS' THEN l.value - 'shopTitle' - 'shopPoints' - 'shopCta'
      WHEN block = 'FAQ' AND jsonb_typeof(l.value -> 'items') = 'array' THEN jsonb_set(
        l.value, '{items}',
        coalesce((SELECT jsonb_agg(e) FROM jsonb_array_elements(l.value -> 'items') e
                  WHERE coalesce(e ->> 'title', '') !~* '(do.konni qanday ochaman|открыть магазин)'), '[]'::jsonb))
      ELSE l.value
    END), '{}'::jsonb)
  FROM jsonb_each(content) l
$$;

UPDATE "site_blocks"
SET "content_i18n" = pg_temp.strip_shop_content("block_type", "content_i18n"),
    "draft_i18n" = CASE WHEN "draft_i18n" IS NULL THEN NULL ELSE pg_temp.strip_shop_content("block_type", "draft_i18n") END;
