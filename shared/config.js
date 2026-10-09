/**
 * srmz04/turno-pvu
 * Configuracion compartida para frontend
 */

// Detectar ambiente basado en hostname
function detectEnvironment() {
    const hostname = window.location.hostname;
    if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
        return 'local';
    }
    // Cloudflare Pages preview deployments (hash.project.pages.dev)
    if (hostname.match(/^[a-f0-9]+\.turno-pvu\.pages\.dev$/)) {
        return 'dev';
    }
    // Branches en Pages (branch.project.pages.dev)
    if (hostname.includes('develop.turno-pvu.pages.dev') || hostname.includes('master.turno-pvu.pages.dev')) {
        return 'dev';
    }
    if (hostname.includes('staging.turno-pvu.pages.dev')) {
        return 'staging';
    }
    // Dominio principal de producción
    if (hostname === 'turno-pvu.pages.dev') {
        return 'prod';
    }
    // Default: dev para cualquier deployment de Pages
    return 'dev';
}

function getApiUrl(env) {
    switch (env) {
        case 'local':
            return 'http://localhost:8787/api';
        case 'dev':
            return 'https://turno-pvu-backend-dev.xtrctr.workers.dev/api';
        case 'staging':
            return 'https://turno-pvu-backend-staging.xtrctr.workers.dev/api';
        case 'prod':
            return 'https://turno-pvu-backend.xtrctr.workers.dev/api';
        default:
            return 'https://turno-pvu-backend-dev.xtrctr.workers.dev/api';
    }
}

const ENV = detectEnvironment();

export const CONFIG = {
    APP_NAME: 'TURNO-PVU',
    VERSION: '1.0.0',
    ENV: ENV,

    // API Endpoints
    API_BASE_URL: getApiUrl(ENV),

    // Tiempos y Retries
    REQUEST_TIMEOUT_MS: 10000,
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 1000,
    // Cache TTLs (ms)
    CACHE_TTL: {
        CENTROS: 60 * 60 * 1000, // 1 hora
        PUBLIC_AVAILABILITY: 60 * 1000, // 1 minuto
    },

    // Umbrales de Alerta
    ALERTS: {
        INVENTORY_LOW_PCT: 20, // 20%
        INVENTORY_CRITICAL_PCT: 5, // 5%
        MAX_WAIT_TIME_MIN: 60,
        BATTERY_LOW_PCT: 20,
    },

    // Reglas de Negocio de Vacunacion (PRD 7.1, 7.2)
    VACCINATION_RULES: {
        MIN_AGE_MONTHS: 6,
        MAX_AGE_YEARS: 19,

        // SRP: 6 meses a 10 anos (inclusive 10 anos, 11 meses, 29 dias)
        // SR:  11 y 12 anos
        SRP_CUTOFF_YEARS: 10,

        // VPH Rules
        VPH_FEMALE_MIN_YEARS: 11,
        VPH_FEMALE_MAX_YEARS: 12,
        VPH_MALE_MIN_YEARS: 11,
        VPH_MALE_MAX_YEARS: 11, // Solo a los 11 (PRD 7.2)
    },

    ROLES: {
        ADMIN: 'ADMIN',
        COORDINADOR: 'COORDINADOR',
        REGISTRADOR: 'REGISTRADOR',
        APLICADOR: 'APLICADOR'
    }
};

/**
 * Determina elegibilidad y biologicos basados en edad y sexo.
 * Retorna objeto con: { eligible: boolean, reason?: string, biologics: string[] }
 * 
 * @param {number} ageYears 
 * @param {number} ageMonths (0-11)
 * @param {string} sex 'M' | 'F'
 */
export function determineEligibility(ageYears, ageMonths, sex) {
    const totalMonths = (ageYears * 12) + ageMonths;
    const minMonths = CONFIG.VACCINATION_RULES.MIN_AGE_MONTHS;
    const maxMonths = (CONFIG.VACCINATION_RULES.MAX_AGE_YEARS * 12) + 11; // Hasta 12 anos 11 meses

    // 1. Validar Rango General
    if (totalMonths < minMonths) {
        return { eligible: false, reason: 'Menor de 6 meses (edad minima)' };
    }
    if (ageYears > CONFIG.VACCINATION_RULES.MAX_AGE_YEARS) {
        return { eligible: false, reason: 'Mayor de 12 anos (edad maxima)' };
    }

    const biologics = [];

    // 2. Determinar SRP o SR
    // SRP: < 11 anos (hasta 10 anos 11 meses)
    // SR: >= 11 anos
    if (ageYears < 11) {
        biologics.push('SRP');
    } else {
        biologics.push('SR');
    }

    // 3. Determinar VPH
    let vphEligible = false;
    if (sex === 'F') {
        // Mujeres 11-12
        if (ageYears >= CONFIG.VACCINATION_RULES.VPH_FEMALE_MIN_YEARS &&
            ageYears <= CONFIG.VACCINATION_RULES.VPH_FEMALE_MAX_YEARS) {
            vphEligible = true;
        }
    } else if (sex === 'M') {
        // Hombres 11 solamente
        if (ageYears === CONFIG.VACCINATION_RULES.VPH_MALE_MIN_YEARS) {
            vphEligible = true;
        }
    }

    if (vphEligible) {
        biologics.push('VPH');
    }

    return { eligible: true, biologics };
}
