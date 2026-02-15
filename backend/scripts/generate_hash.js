const { webcrypto } = require('crypto');
const crypto = webcrypto;

async function generateSalt() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Buffer.from(array).toString('base64');
}

async function hashPassword(password, saltStr) {
    // worker.js behavior: salt: encoder.encode(salt)
    // saltStr is stored in DB. We encode it to bytes (utf8).
    const salt = Buffer.from(saltStr, 'utf8');

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
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        256
    );

    return Buffer.from(hashBuffer).toString('base64');
}

(async () => {
    try {
        const password = process.argv[2] || 'admin123';
        const salt = await generateSalt();
        const hash = await hashPassword(password, salt);
        // Output JSON for easy parsing
        console.log(JSON.stringify({ salt, hash }));
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
