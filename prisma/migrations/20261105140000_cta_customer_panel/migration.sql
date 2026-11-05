-- Bosh sayt tugmasi: "Hisoblab ko‘rish" → "Mijoz paneliga o‘tish" (faqat standart matn o‘zgartirilmagan bo‘lsa; nashr va qoralama).
UPDATE "site_blocks"
SET "content_i18n" = jsonb_set(jsonb_set("content_i18n", '{uz,ctaPrimary}', '"Mijoz paneliga o‘tish"'), '{ru,ctaPrimary}', '"Перейти в панель клиента"')
WHERE "block_type" IN ('HERO', 'FINALE') AND "content_i18n" #>> '{uz,ctaPrimary}' = 'Hisoblab ko‘rish' AND "content_i18n" #> '{ru}' IS NOT NULL;

UPDATE "site_blocks"
SET "draft_i18n" = jsonb_set(jsonb_set("draft_i18n", '{uz,ctaPrimary}', '"Mijoz paneliga o‘tish"'), '{ru,ctaPrimary}', '"Перейти в панель клиента"')
WHERE "block_type" IN ('HERO', 'FINALE') AND "draft_i18n" #>> '{uz,ctaPrimary}' = 'Hisoblab ko‘rish' AND "draft_i18n" #> '{ru}' IS NOT NULL;
