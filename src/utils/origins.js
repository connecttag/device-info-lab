import { fail } from './http.js';

export function origins(request, env) {
    const url = new URL(request.url);
    const local = env.APP_ENV === 'development' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (local) {
        // Wrangler can strip the port while rewriting requests to --host.
        const localOrigin = env.LOCAL_ORIGIN || 'http://127.0.0.1:8787';
        const configured = new URL(localOrigin);
        if (!['localhost', '127.0.0.1', '[::1]'].includes(configured.hostname) || !['http:', 'https:'].includes(configured.protocol)) fail(503, 'NotConfigured');
        return { publicOrigin: configured.origin, adminOrigin: configured.origin, isAdmin: true, isPublic: true, local: true };
    }
    const publicOrigin = env.PUBLIC_ORIGIN;
    const adminOrigin = env.ADMIN_ORIGIN;
    if (!publicOrigin?.startsWith('https://') || !adminOrigin?.startsWith('https://')) fail(503, 'NotConfigured');
    return { publicOrigin, adminOrigin, isAdmin: url.origin === adminOrigin, isPublic: url.origin === publicOrigin, local: false };
}
