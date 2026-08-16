-- Seed demo SECRETARY and MANAGER accounts.
-- Non-destructive: INSERT OR IGNORE by fixed id, so existing rows are preserved.
-- The demo password for both accounts is: Trainify2026!
-- Requires the profiles.check/role widening from add_roles_commission.sql.

BEGIN TRANSACTION;

INSERT OR IGNORE INTO auth_users (id, email, password_hash, created_at) VALUES
  ('00000000-0000-0000-0000-0000000000sc', 'secretary@trainify.com', NULL, strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  ('00000000-0000-0000-0000-0000000000mg', 'manager@trainify.com',  NULL, strftime('%Y-%m-%dT%H:%M:%SZ','now'));

-- bcrypt hash of "Trainify2026!" (see lib/auth.ts hashPassword)
INSERT OR IGNORE INTO profiles (id, email, password, role, firstName, lastName, createdAt) VALUES
  ('00000000-0000-0000-0000-0000000000sc', 'secretary@trainify.com', '$2b$10$pLHuboSGtY9TQDDH7G.bX.Vty6PKY6hyNMHUCPHYntIiUzgx2GBRy', 'SECRETARY', 'Demo', 'Secretary', strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  ('00000000-0000-0000-0000-0000000000mg', 'manager@trainify.com',  '$2b$10$pLHuboSGtY9TQDDH7G.bX.Vty6PKY6hyNMHUCPHYntIiUzgx2GBRy', 'MANAGER',  'Demo', 'Manager',  strftime('%Y-%m-%dT%H:%M:%SZ','now'));

COMMIT;
