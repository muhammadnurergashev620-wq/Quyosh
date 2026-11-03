-- SiteBlock: admin qoralamasi (nashr qilinmaguncha saytda ko‘rinmaydi) va sahifada har tur bitta blok.
ALTER TABLE "site_blocks" ADD COLUMN     "draft_i18n" JSONB;

CREATE UNIQUE INDEX "site_blocks_page_block_type_key" ON "site_blocks"("page", "block_type");
