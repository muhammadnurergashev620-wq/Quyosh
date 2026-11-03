-- M3: xarita va obyektlar (TZ 7.4, 7.5, 12). PostGIS kerak.
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE "SiteType" AS ENUM ('HOUSE', 'BUSINESS', 'WAREHOUSE', 'GARAGE', 'OTHER');
CREATE TYPE "AreaType" AS ENUM ('ROOF', 'GROUND', 'CARPORT');
CREATE TYPE "RoofShape" AS ENUM ('FLAT', 'PITCHED');
CREATE TYPE "ShadingLevel" AS ENUM ('NONE', 'LIGHT', 'HEAVY');

ALTER TABLE "shop_branches" ADD COLUMN "location" geography(Point,4326);
CREATE INDEX "shop_branches_location_gist" ON "shop_branches" USING GIST ("location");

CREATE TABLE "service_areas" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "geom" geography(MultiPolygon,4326) NOT NULL,
    "area_km2" DECIMAL(12,3) NOT NULL,
    "service_types" "ServiceType"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "service_areas_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "service_areas_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "shop_branches"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "service_areas_area_limit" CHECK ("area_km2" > 0 AND "area_km2" <= 20000)
);
CREATE INDEX "service_areas_branch_id_idx" ON "service_areas"("branch_id");
CREATE INDEX "service_areas_geom_gist" ON "service_areas" USING GIST ("geom");

CREATE TABLE "customer_sites" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "site_type" "SiteType" NOT NULL DEFAULT 'HOUSE',
    "address" VARCHAR(500),
    "location" geography(Point,4326) NOT NULL,
    "region_code" VARCHAR(32),
    "district_code" VARCHAR(32),
    "notes" VARCHAR(2000),
    "archived_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "customer_sites_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "customer_sites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "customer_sites_user_id_idx" ON "customer_sites"("user_id");
CREATE INDEX "customer_sites_location_gist" ON "customer_sites" USING GIST ("location");

CREATE TABLE "site_areas" (
    "id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "area_type" "AreaType" NOT NULL DEFAULT 'ROOF',
    "roof_shape" "RoofShape" NOT NULL DEFAULT 'FLAT',
    "polygon" geometry(Polygon,4326) NOT NULL,
    "projected_area_m2" DECIMAL(12,2) NOT NULL,
    "surface_area_m2" DECIMAL(12,2) NOT NULL,
    "usable_factor" DECIMAL(4,3) NOT NULL,
    "usable_area_m2" DECIMAL(12,2) NOT NULL,
    "azimuth_deg" INTEGER,
    "tilt_deg" DECIMAL(5,2),
    "shading_level" "ShadingLevel" NOT NULL DEFAULT 'NONE',
    "obstacle_info_json" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "site_areas_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "site_areas_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "customer_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "site_areas_polygon_valid" CHECK (ST_IsValid("polygon")),
    CONSTRAINT "site_areas_area_limit" CHECK ("projected_area_m2" > 0 AND "projected_area_m2" <= 50000),
    CONSTRAINT "site_areas_usable_factor" CHECK ("usable_factor" > 0 AND "usable_factor" <= 1),
    CONSTRAINT "site_areas_azimuth" CHECK ("azimuth_deg" IS NULL OR ("azimuth_deg" >= 0 AND "azimuth_deg" <= 359)),
    CONSTRAINT "site_areas_tilt" CHECK ("tilt_deg" IS NULL OR ("tilt_deg" >= 0 AND "tilt_deg" <= 90))
);
CREATE INDEX "site_areas_site_id_idx" ON "site_areas"("site_id");
CREATE INDEX "site_areas_polygon_gist" ON "site_areas" USING GIST ("polygon");
