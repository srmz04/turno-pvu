#!/usr/bin/env node
/**
 * Script para generar hashes PBKDF2 para usuarios de desarrollo
 * Usa la misma lógica que worker.js para compatibilidad
 */

const crypto = require('crypto');

// Función para generar salt aleatorio
function generateSalt(length = 32) {
  return crypto.randomBytes(length).toString('base64');
}

// Función para generar hash PBKDF2 usando Node.js crypto
function generateHash(password, salt) {
  const iterations = 100000;
  const keylen = 32;
  const digest = 'sha256';

  const hash = crypto.pbkdf2Sync(
    password,
    salt,
    iterations,
    keylen,
    digest
  );

  return hash.toString('base64');
}

// Usuarios con sus passwords de desarrollo
const users = [
  { username: 'admin', password: 'Admin123!' },
  { username: 'coord.cs001', password: 'Coord001!' },
  { username: 'coord.cs002', password: 'Coord002!' },
  { username: 'coord.cs003', password: 'Coord003!' },
  { username: 'reg.cs001.1', password: 'Reg001!' },
  { username: 'reg.cs001.2', password: 'Reg002!' },
  { username: 'enf.cs001.1', password: 'Enf001!' },
  { username: 'enf.cs001.2', password: 'Enf002!' },
];

console.log('-- Hashes generados para usuarios de desarrollo\n');
console.log('-- COPIAR Y PEGAR EN seed.sql\n');

users.forEach(user => {
  const salt = generateSalt();
  const hash = generateHash(user.password, salt);

  console.log(`-- Usuario: ${user.username} | Password: ${user.password}`);
  console.log(`--   Salt: ${salt}`);
  console.log(`--   Hash: ${hash}`);
  console.log(`UPDATE usuarios SET password_hash = '${hash}', salt = '${salt}' WHERE username = '${user.username}';`);
  console.log('');
});

console.log('\n-- Para ejecutar estos comandos:');
console.log('-- 1. Copiar los UPDATE statements de arriba');
console.log('-- 2. Guardarlos en un archivo temporal (ej: update-hashes.sql)');
console.log('-- 3. Ejecutar: npx wrangler d1 execute turno-pvu-db-dev --file=update-hashes.sql --local');
