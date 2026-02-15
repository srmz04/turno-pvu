const crypto = require('crypto').webcrypto;

async function generateSalt() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array));
}

async function hashPassword(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );

    let normalizedSalt = salt;
    while (normalizedSalt.length % 4 !== 0) {
        normalizedSalt += '=';
    }

    const saltBytes = Uint8Array.from(atob(normalizedSalt), c => c.charCodeAt(0));

    const hashBuffer = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: saltBytes,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        256
    );

    return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
}

async function main() {
    const users = [
        { role: 'ADMIN', pass: 'Admin123!' },
        { role: 'COORDINADOR', pass: 'Coord123!' },
        { role: 'REGISTRADOR', pass: 'Reg123!' },
        { role: 'APLICADOR', pass: 'Aplica123!' }
    ];

    console.log('-- SQL Updates to fix passwords');
    for (const u of users) {
        const salt = await generateSalt();
        const hash = await hashPassword(u.pass, salt);
        console.log(`-- ${u.role} (${u.pass})`);
        console.log(`UPDATE usuarios SET password_hash = '${hash}', salt = '${salt}' WHERE rol = '${u.role}';`);
    }
}

main();
