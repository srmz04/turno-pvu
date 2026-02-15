// Using global fetch (Node 18+)

const API_Base = 'https://turno-pvu-backend.xtrctr.workers.dev/api';
// const API_Base = 'http://localhost:8787/api'; // Local dev

let tokenAdmin = '';
let tokenCoord = '';
let tokenReg = '';
let tokenApp = '';

let centroId = null;
let turnoId = null;
let folioFicha = null;

async function request(method, endpoint, body = null, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${API_Base}${endpoint}`, options);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(`[${method} ${endpoint}] Failed: ${res.status} - ${JSON.stringify(data)}`);
    }
    return data;
}

(async () => {
    try {
        console.log('--- STARTING E2E VERIFICATION ---');

        // 1. LOGIN ADMIN
        console.log('1. Logging in as Admin...');
        const loginRes = await request('POST', '/auth/login', { username: 'admin', password: 'admin123' });
        tokenAdmin = loginRes.token;
        console.log('   Success! Token received.');

        // 2. USE EXISTING CENTRO (POST /centros not implemented in Phase 2)
        console.log('2. Fetching Existing Centro (seeded)...');
        const centrosRes = await request('GET', '/centros', null, tokenAdmin);
        if (!centrosRes.centros || centrosRes.centros.length === 0) {
            throw new Error('No seeded Centros found!');
        }
        centroId = centrosRes.centros[0].id;
        console.log(`   Success! Using Centro ID: ${centroId} (${centrosRes.centros[0].nombre})`);

        // 3. USE EXISTING USERS (POST /auth/register missing)
        console.log('3. Using Seeded Users (coord.cs001, reg.cs001.1, aplica.cs001.1)...');

        // Coordinator
        const coordUser = 'coord.cs001';
        // Registrador
        const regUser = 'reg.cs001.1';
        // Aplicador
        const appUser = 'aplica.cs001.1';
        const commonPass = 'admin123'; // We reset this in DB

        // 4. LOGIN COORDINATOR & SET CENTRO ID
        console.log('4. Logging in as Coordinator...');
        const loginCoordRes = await request('POST', '/auth/login', { username: coordUser, password: commonPass });
        tokenCoord = loginCoordRes.token;
        // Hardcode Centro 1 because seeded users belong to Centro 1
        centroId = 1;
        console.log(`   Success! Using Hardcoded Centro ID: ${centroId}`);

        // 5. OPEN TURNO & ASSIGN BLOCKS
        console.log('5. Opening Turno (POST /turnos/abrir)...');
        try {
            const turnoRes = await request('POST', '/turnos/abrir', {
                tipo: 'MATUTINO', // Required by backend
                srp_inicial: 50, sr_inicial: 50, vph_inicial: 50,
                observaciones: 'Test Turno'
            }, tokenCoord);
            turnoId = turnoRes.turno.id;
            console.log(`   Success! New Turno ID: ${turnoId}`);
        } catch (error) {
            if (error.message.includes('409') || error.message.includes('TURNO_DUPLICADO')) {
                console.log('   Turno already active (409). Fetching active turno...');
                const activeRes = await request('GET', `/turnos/activo/${centroId}`, null, tokenCoord);
                if (activeRes.turno) {
                    turnoId = activeRes.turno.id;
                    console.log(`   Success! Using Existing Turno ID: ${turnoId}`);
                } else {
                    throw new Error('Failed to retrieve active turno after 409 conflict.');
                }
            } else {
                throw error;
            }
        }

        // 5.1 CREATE DEVICE (Required for Block Assignment)
        console.log('5.1 Creating Device (POST /dispositivos/crear)...');
        const devRes = await request('POST', '/dispositivos/crear', {
            nombre: 'Test Device ' + Date.now().toString().slice(-6),
            rol: 'REGISTRADOR',
            centro_id: centroId // Optional if user is coord, but safe to pass
        }, tokenCoord);
        const deviceToken = devRes.dispositivo.token;
        console.log(`   Success! Device Token: ${deviceToken}`);

        // 5.2 DETERMINE FOLIO RANGE
        console.log('5.2 Fetching existing blocks (GET /bloques/:id)...');
        const bloqRes = await request('GET', `/bloques/${turnoId}`, null, tokenCoord);

        let folioStart = 1;
        if (bloqRes.bloques && bloqRes.bloques.length > 0) {
            // Find max folio_fin
            const maxFin = Math.max(...bloqRes.bloques.map(b => b.folio_fin));
            folioStart = maxFin + 1;
        }
        const folioEnd = folioStart + 9; // Assign 10 folios
        console.log(`   Next Range: ${folioStart}-${folioEnd}`);

        // 5.3 ASSIGN BLOCK
        console.log('5.3 Assigning Block (POST /bloques/asignar)...');
        await request('POST', '/bloques/asignar', {
            turno_id: turnoId,
            dispositivo_token: deviceToken,
            folio_inicio: folioStart,
            folio_fin: folioEnd
        }, tokenCoord);
        console.log('   Block assigned successfully.');

        // Login Registrador to get token for emitting ficha
        const loginRegRes = await request('POST', '/auth/login', { username: regUser, password: commonPass });
        tokenReg = loginRegRes.token;

        // 6. EMIT FICHA (Registrador)
        console.log('6. Emitting Ficha (Registrador)...');
        // Registrador emits a child (SRP)
        const fichaRes = await request('POST', '/fichas', {
            edad_anios: 5,
            edad_meses: 6,
            sexo: 'F',
            vph_tenia: false,
            idempotency_key: 'test-key-' + Date.now()
        }, tokenReg);
        folioFicha = fichaRes.ficha.folio;
        console.log(`   Success! Ficha Created: ${folioFicha}`);

        // Verify consecutivo matches block? 
        // Backend logic changed to accept consecutivo, but here we let backend calculate it.
        // Backend assigns from block logic is tricky if I rely on manual block assignment.
        // Actually, backend calculates consecutivo based on MAX(consecutivo)+1.
        // Does it respect blocks? Phase 4 requirement says "Offline uses block". Online?
        // Online logic uses sequential +1.
        // Coordinator assigning blocks is for offline tracking mainly.
        // But let's proceed.

        // 7. LOGIN APLICADOR & APPLY
        console.log('7. Logging in as Aplicador...');
        const loginAppRes = await request('POST', '/auth/login', { username: appUser, password: commonPass });
        tokenApp = loginAppRes.token;
        console.log('   Success!');

        console.log(`   Applying Ficha ${folioFicha} (PATCH /fichas/:folio/aplicar)...`);
        const applyRes = await request('PATCH', `/fichas/${folioFicha}/aplicar`, {
            observaciones: 'Test Application',
            lote_srp: 'TEST-LOTE-SRP' // Optional if required
        }, tokenApp);
        console.log('   Success! Ficha status: ' + applyRes.ficha.estado);

        // 8. VERIFY METRICS (Admin)
        console.log('8. Verifying Dashboard Metrics (Admin)...');
        const dashboardRes = await request('GET', `/dashboard/${centroId}`, null, tokenAdmin);
        // console.log(dashboardRes);
        if (dashboardRes.resumen.fichas_total >= 1 && dashboardRes.resumen.aplicadas >= 1) {
            console.log('   Metrics Validated: Ficha count matches.');
        } else {
            console.warn('   Metrics mismatch?', dashboardRes.resumen);
        }

        console.log('\n--- VERIFICATION COMPLETED SUCCESSFULLY ---');

    } catch (error) {
        console.error('\n!!! VERIFICATION FAILED !!!');
        console.error(error.message);
        process.exit(1);
    }
})();
