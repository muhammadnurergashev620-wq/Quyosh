-- v3.1: do‘kon belgisini admin qo‘yadi — hujjat fayli shart emas.
ALTER TABLE "shop_certifications" ALTER COLUMN "file_id" DROP NOT NULL;
