-- Login bilan kiradigan (do‘kon/admin) akkauntda telefon yoki email bo‘lmasligi mumkin: login ham «aloqa» hisoblanadi.
ALTER TABLE "users" DROP CONSTRAINT "users_contact_required";
ALTER TABLE "users" ADD CONSTRAINT "users_contact_required" CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL OR "google_id" IS NOT NULL OR "login" IS NOT NULL);
