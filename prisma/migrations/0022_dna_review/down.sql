-- Rollback for 0022_dna_review. Drops in dependency order.
DROP TABLE IF EXISTS "dna_review_findings";
DROP TABLE IF EXISTS "dna_reviews";
DROP TABLE IF EXISTS "dna_review_rules";
