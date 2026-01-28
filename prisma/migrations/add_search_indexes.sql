-- Add indexes for search performance
-- These indexes will improve the performance of the artisan search functionality

-- Full-text search index for artisan names and descriptions
CREATE INDEX IF NOT EXISTS idx_artisan_name_fts ON "Artisan" USING gin(to_tsvector('english', "name"));
CREATE INDEX IF NOT EXISTS idx_artisan_description_fts ON "Artisan" USING gin(to_tsvector('english', "description"));

-- Composite indexes for common search combinations
CREATE INDEX IF NOT EXISTS idx_artisan_active_verified ON "Artisan"("isActive", "isVerified");
CREATE INDEX IF NOT EXISTS idx_artisan_category_active ON "Artisan"("categoryId", "isActive");
CREATE INDEX IF NOT EXISTS idx_artisan_location_active ON "Artisan"("locationId", "isActive");

-- Price range indexes
CREATE INDEX IF NOT EXISTS idx_artisan_price_range ON "Artisan"("price");
CREATE INDEX IF NOT EXISTS idx_artisan_price_gin ON "Artisan" USING gin("priceRange");

-- Location-based search indexes
CREATE INDEX IF NOT EXISTS idx_location_coords ON "Location"("latitude", "longitude");
CREATE INDEX IF NOT EXISTS idx_location_city_state ON "Location"("city", "state");
CREATE INDEX IF NOT EXISTS idx_location_country ON "Location"("country");

-- Category and subcategory indexes
CREATE INDEX IF NOT EXISTS idx_category_name ON "Category"("name");
CREATE INDEX IF NOT EXISTS idx_subcategory_name_category ON "Subcategory"("name", "categoryId");

-- Review indexes for rating-based sorting
CREATE INDEX IF NOT EXISTS idx_review_artisan_rating ON "Review"("artisanId", "rating");
CREATE INDEX IF NOT EXISTS idx_review_rating ON "Review"("rating");

-- Created at index for time-based sorting
CREATE INDEX IF NOT EXISTS idx_artisan_created_at ON "Artisan"("createdAt" DESC);

-- Enable the pg_trgm extension for fuzzy string matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add trigram indexes for better text search performance
CREATE INDEX IF NOT EXISTS idx_artisan_name_trgm ON "Artisan" USING gin("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_artisan_description_trgm ON "Artisan" USING gin("description" gin_trgm_ops);
