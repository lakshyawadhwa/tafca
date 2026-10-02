-- Uniqueness for identity and statutory fields.
--
-- All partial (WHERE deleted_at IS NULL) because every table here is
-- soft-deleted: a deleted record must not keep reserving an identifier.
-- All lower()-based because the API accepts either case and humans treat
-- "Sharma & Co" and "sharma & co" as the same name.
--
-- The services raise a clear 409 before reaching these; the indexes exist so a
-- concurrent request cannot slip between the check and the insert.

-- Email is the login key and login resolves it across all firms, so it must be
-- globally unique rather than per-firm.
CREATE UNIQUE INDEX "users_email_unique_active"
  ON "users" (lower("email"))
  WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "firms_name_unique_active"
  ON "firms" (lower("name"))
  WHERE "deleted_at" IS NULL;

-- Statutory identifiers are unique per firm, not globally: two firms can
-- legitimately both act for the same taxpayer.
CREATE UNIQUE INDEX "clients_firm_pan_unique_active"
  ON "clients" ("firm_id", lower("pan"))
  WHERE "deleted_at" IS NULL AND "pan" IS NOT NULL;

CREATE UNIQUE INDEX "clients_firm_tan_unique_active"
  ON "clients" ("firm_id", lower("tan"))
  WHERE "deleted_at" IS NULL AND "tan" IS NOT NULL;

CREATE UNIQUE INDEX "clients_firm_cin_unique_active"
  ON "clients" ("firm_id", lower("cin"))
  WHERE "deleted_at" IS NULL AND "cin" IS NOT NULL;

CREATE UNIQUE INDEX "client_gst_numbers_firm_gstin_unique_active"
  ON "client_gst_numbers" ("firm_id", lower("gstin"))
  WHERE "deleted_at" IS NULL;
