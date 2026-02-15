#!/usr/bin/env node
/**
 * Genera hashes PBKDF2 100% compatibles con worker.js
 * Usa Web Crypto API (mismo que Cloudflare Workers)
 */

// Simular Web Crypto API con Node.js crypto
const crypto = require('crypto').webcrypto;

// Función EXACTA del worker.js
async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt), // IMPORTANTE: salt se codifica como UTF-8
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );

  return Buffer.from(hashBuffer).toString('base64');
}

// Función EXACTA del worker.js
function generateSalt() {
  const array = new Uint8Array(16); // 16 bytes, no 32
  crypto.getRandomValues(array);
  return Buffer.from(array).toString('base64');
}

// Usuarios con passwords de desarrollo
const users = [
  { username: 'admin', password: 'Admin123!' },
  { username: 'coord.cs001', password: 'Coord123!' }, // Password corregido
  { username: 'reg.cs001.1', password: 'Reg123!' },   // Password corregido
  { username: 'aplica.cs001.1', password: 'Aplica123!' }
];

async function generateAll() {
  console.log('-- ============================================================================');
  console.log('-- UPDATE HASHES - Compatible con worker.js');
  console.log('-- ============================================================================\n');

  for (const user of users) {
    const salt = generateSalt();
    const hash = await hashPassword(user.password, salt);

    console.log(`-- ${user.username} / ${user.password}`);
    console.log(`UPDATE usuarios SET`);
    console.log(`  password_hash = '${hash}',`);
    console.log(`  salt = '${salt}'`);
    console.log(`WHERE username = '${user.username}';`);
    console.log('');
  }

  console.log('-- ============================================================================\n');
  console.log('-- Para aplicar:');
  console.log('-- npx wrangler d1 execute turno-pvu-db-dev --config=wrangler.dev.toml --remote --file=update-hashes-fixed.sql');
}

generateAll().catch(console.error);
