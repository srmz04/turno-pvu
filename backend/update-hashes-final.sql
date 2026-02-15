-- ============================================================================
-- UPDATE HASHES - 100% Compatible con worker.js ARREGLADO
-- ============================================================================
-- Generados con el endpoint /api/test-hash del worker en producción
-- Passwords: Admin123! / Coord123! / Reg123! / Aplica123!
-- ============================================================================

UPDATE usuarios SET
  password_hash = 'pi0cD/0tFCuW5StrLJYA3LHgiLnPEirNz7Tbt7eR1Zk=',
  salt = 'YWRtaW4tc2FsdC0yMDI2'
WHERE username = 'admin';

UPDATE usuarios SET
  password_hash = 'R0fn+rivCSDm51OLfooW00lMMgTeCpeICAhendICGzE=',
  salt = 'Y29vcmQuY3MwMDEtc2FsdC0yMDI2'
WHERE username = 'coord.cs001';

UPDATE usuarios SET
  password_hash = 'Oll9WwOMllHowxr6+4xvxiP50RPMrFh1Mp3SIDPUyyM=',
  salt = 'cmVnLmNzMDAxLjEtc2FsdC0yMDI2'
WHERE username = 'reg.cs001.1';

UPDATE usuarios SET
  password_hash = 'VhYSgg8lIREHJDcCtLpNFN+tuGkwetT0kiEjeRQBxbA=',
  salt = 'YXBsaWNhLmNzMDAxLjEtc2FsdC0yMDI2'
WHERE username = 'aplica.cs001.1';

-- ============================================================================
