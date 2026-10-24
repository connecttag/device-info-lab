export const CONFIG = Object.freeze({
    retentionMs: 30 * 86400000,
    sessionMs: 8 * 3600000,
    capabilityMs: 10 * 60000,
    maxBodyBytes: 8192,
    maxPageSize: 100,
    defaultPageSize: 20,
    maxExport: 250,
    cookieName: 'deviceLabSession',
    maxLinks: 1000,
    loginLimit: 10,
    loginWindowMs: 15 * 60000,
    visitLimit: 120,
    visitWindowMs: 60000,
    templates: ['welcome', 'deviceInfo', 'promotional', 'notFound', 'training', 'custom'],
    demoUsername: 'student.demo',
    demoPassword: 'Demo-Only-2026!'
});

export const SECURITY_HEADERS = Object.freeze({
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Cache-Control': 'no-store'
});
