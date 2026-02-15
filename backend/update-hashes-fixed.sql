-- ============================================================================
-- UPDATE HASHES - Compatible con worker.js
-- ============================================================================

-- admin / Admin123!
UPDATE usuarios SET
  password_hash = 'nz7AJW3ScSZ8l3Y4iaA1EaZIfVN0rcezZpwZtI6ORQQ=',
  salt = 'JLP8YPOteRAaszYYzI505A=='
WHERE username = 'admin';

-- coord.cs001 / Coord123!
UPDATE usuarios SET
  password_hash = 'ddZ0r81rOrbRKFHtoJ6GN+b3ub4y/mHD+qhXm3b4TN4=',
  salt = 'YrbTp/NlFPy+9Q4GyMn7jQ=='
WHERE username = 'coord.cs001';

-- reg.cs001.1 / Reg123!
UPDATE usuarios SET
  password_hash = 'Hfq6EWrODDRMOEGM/Mfdy8a8dV/83j3K/SeA5/y2jwE=',
  salt = 'qAo4TMDcyF1fmlOPzz53Zw=='
WHERE username = 'reg.cs001.1';

-- aplica.cs001.1 / Aplica123!
UPDATE usuarios SET
  password_hash = 'FxII3ZDzp9DqQhBuH0zHNh5goeVExKHDydJrX+DmPQs=',
  salt = 'ZxxCfb7zoI8kht2wAjNdLg=='
WHERE username = 'aplica.cs001.1';

-- ============================================================================

-- Para aplicar:
-- npx wrangler d1 execute turno-pvu-db-dev --config=wrangler.dev.toml --remote --file=update-hashes-fixed.sql
