-- Case-insensitive unique index on clients(firm_id, lower(display_name))
-- Excludes soft-deleted rows. This is the DB-level belt-and-braces for AC-3.
-- Service layer does a pre-check with mode:'insensitive' for nicer 409 body.

CREATE UNIQUE INDEX clients_firm_display_name_lower_unique
  ON clients(firm_id, LOWER(display_name))
  WHERE deleted_at IS NULL;
