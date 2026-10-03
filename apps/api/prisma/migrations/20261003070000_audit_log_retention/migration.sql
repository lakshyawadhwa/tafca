-- Audit retention: 8 years, enforced in the database.
--
-- The previous trigger blocked every DELETE, which made the log unalterable but
-- also unexpirable — it would have grown forever. At ~890 bytes a row, a
-- twenty-person firm writes roughly 650 MB a year, so "forever" is a cost
-- problem as well as a data-protection one: these rows carry names, IP
-- addresses and user agents, and DPDP 2023 expects personal data to have a
-- purpose-bound life.
--
-- Eight years matches the longest statutory period the product touches
-- (Companies Act s.128, eight financial years; CGST s.36 is 72 months), so the
-- trail always outlives the filing it describes.
--
-- UPDATE stays blocked unconditionally — history is never rewritten. DELETE is
-- permitted only for rows that have already aged past the window, so a purge
-- cannot reach anything recent even if it is pointed at the whole table.

DROP TRIGGER IF EXISTS user_action_log_no_update ON "user_action_log";
DROP TRIGGER IF EXISTS user_action_log_no_delete ON "user_action_log";

CREATE OR REPLACE FUNCTION prevent_user_action_log_mutation()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'user_action_log is append-only: UPDATE is never permitted'
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- DELETE: only rows past the retention window may go.
  IF OLD."occurred_at" > now() - interval '8 years' THEN
    RAISE EXCEPTION
      'user_action_log entry from % is inside the 8 year retention window and cannot be deleted',
      OLD."occurred_at"
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_action_log_no_update
  BEFORE UPDATE ON "user_action_log"
  FOR EACH ROW EXECUTE FUNCTION prevent_user_action_log_mutation();

CREATE TRIGGER user_action_log_retention
  BEFORE DELETE ON "user_action_log"
  FOR EACH ROW EXECUTE FUNCTION prevent_user_action_log_mutation();
