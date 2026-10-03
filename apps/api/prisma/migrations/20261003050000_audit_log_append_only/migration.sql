-- The audit trail is append-only, enforced by the database rather than by
-- convention.
--
-- Nothing in the application updates or deletes these rows today — the model
-- has no updatedAt or deletedAt, and the only route is a GET. But "no endpoint
-- exists" is a property of the current code, not a guarantee. For a practice
-- that may have to show a regulator who did what and when, the record needs to
-- be unalterable even from a direct database connection or a future careless
-- endpoint.
--
-- TRUNCATE deliberately still works: row-level triggers do not fire for it, so
-- the test suite can still reset the schema between runs.

CREATE OR REPLACE FUNCTION prevent_user_action_log_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    'user_action_log is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_action_log_no_update
  BEFORE UPDATE ON "user_action_log"
  FOR EACH ROW EXECUTE FUNCTION prevent_user_action_log_mutation();

CREATE TRIGGER user_action_log_no_delete
  BEFORE DELETE ON "user_action_log"
  FOR EACH ROW EXECUTE FUNCTION prevent_user_action_log_mutation();
