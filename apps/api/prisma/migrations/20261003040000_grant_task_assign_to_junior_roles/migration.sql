-- Junior CAs and Articles may now hand a task to a colleague.
--
-- Work moves sideways in a small practice — an article passing a half-finished
-- reconciliation to whoever is free is normal, and blocking it just means the
-- task sits with the wrong person. Clients and engagements stay senior-only:
-- opening or closing a client relationship is a different kind of decision.
--
-- PermissionService reads firm_role_permissions first and only falls back to
-- the shared defaults, so firms seeded before this change need the row written
-- explicitly or they would keep the old denial.

INSERT INTO "firm_role_permissions" ("id", "firm_id", "role", "resource", "action", "scope")
SELECT gen_random_uuid(), f."id", r.role::"UserRole", 'task', 'assign', 'all'
FROM "firms" f
CROSS JOIN (VALUES ('JUNIOR_CA'), ('ARTICLE')) AS r(role)
WHERE f."deleted_at" IS NULL
ON CONFLICT ("firm_id", "role", "resource", "action")
DO UPDATE SET "scope" = 'all', "updated_at" = CURRENT_TIMESTAMP;
