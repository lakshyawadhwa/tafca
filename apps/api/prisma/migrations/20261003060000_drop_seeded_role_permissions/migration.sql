-- Make the code matrix the single source of truth for permissions.
--
-- firm_role_permissions was seeded from DEFAULT_ROLE_PERMISSIONS, and
-- PermissionService reads the table first and only falls back to the defaults.
-- That left two sources of truth: firms seeded early held rows, firms created
-- afterwards ran on the defaults. They agreed only by coincidence — editing
-- role-permissions.ts would have silently had no effect on the seeded firms,
-- which is a bad way to discover a permission change did not take.
--
-- Per-firm overrides are out of scope for now, so the rows go and the defaults
-- govern every firm uniformly. The table and the lookup in PermissionService
-- stay exactly as they are: the day per-firm permissions are built, writing a
-- row starts overriding again with no code change. Note that the in-memory
-- scope cache has no invalidation hook, so that feature will need one.

DELETE FROM "firm_role_permissions";
