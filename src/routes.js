import { AuthController } from './controllers/AuthController.js';
import { LinkController } from './controllers/LinkController.js';
import { VisitController } from './controllers/VisitController.js';
import { AuthService, requireConfiguration } from './services/AuthService.js';
import { origins } from './utils/origins.js';
import { requireSameOrigin, fail, json } from './utils/http.js';
import { landingPage } from './views/visitPage.js';
import { themeStyles } from './views/theme.js';
import { GroupController } from './controllers/GroupController.js';
import { SettingsController } from './controllers/SettingsController.js';
import { SettingsService } from './services/SettingsService.js';

const ADMIN_ASSETS = new Set(['/', '/index.html', '/app.js', '/api.js', '/ui.js', '/strings.js', '/styles.css', '/visit.css', '/link-editor.js', '/analytics.js', '/groups.js', '/settings.js']);
const PUBLIC_ASSETS = new Set(['/visit.js', '/strings.js', '/visit.css']);
const FONT_ASSETS = new Set(['/fonts.css', '/fonts/Tajawal-Regular.ttf', '/fonts/Tajawal-Medium.ttf', '/fonts/Tajawal-Bold.ttf', '/fonts/OFL.txt', '/icons.js', '/icons-LICENSE.txt']);
const privateRoutes = new Map([
    ['GET:/api/auth/session', (req, env) => new AuthController(env).session(req)],
    ['POST:/api/auth/logout', (req, env) => new AuthController(env).logout(req)],
    ['GET:/api/links', (req, env, origin) => new LinkController(env).list(req, origin)],
    ['POST:/api/links', (req, env, origin) => new LinkController(env).create(req, origin)],
    ['GET:/api/visits', (req, env) => new VisitController(env).list(req)],
    ['GET:/api/stats', (req, env) => new VisitController(env).stats(req)],
    ['POST:/api/preview', (req, env) => new LinkController(env).preview(req)],
    ['GET:/api/groups', (req, env) => new GroupController(env).list()],
    ['POST:/api/groups', (req, env) => new GroupController(env).create(req)],
    ['PATCH:/api/settings', (req, env) => new SettingsController(env).update(req)],
    ['GET:/api/settings', (req, env) => new SettingsController(env).get()],
    ['POST:/api/auth/rotate-key', async (req, env) => json({ saved: true }, 200, { 'Set-Cookie': await new AuthService(env).rotate(req, await new AuthController(env).body(req)) })],
    ['POST:/api/auth/revoke-sessions', async (req, env) => json({ saved: true }, 200, { 'Set-Cookie': await new AuthService(env).revoke(req) })],
    ['GET:/api/export', (req, env) => new VisitController(env).export(req)]
]);
const dynamicRoutes = [
    { method: 'GET', pattern: /^\/api\/links\/([A-Za-z0-9-]{1,100})$/, handle: (request, env, id, origin) => new LinkController(env).details(id, origin) },
    { method: 'GET', pattern: /^\/api\/links\/([A-Za-z0-9-]{1,100})\/qr$/, handle: (request, env, id, origin) => new LinkController(env).qr(id, origin) },
    { method: 'PATCH', pattern: /^\/api\/groups\/([A-Za-z0-9-]{1,100})$/, handle: (request, env, id) => new GroupController(env).rename(request, id) },
    { method: 'DELETE', pattern: /^\/api\/groups\/([A-Za-z0-9-]{1,100})$/, handle: (request, env, id) => new GroupController(env).remove(id) },
    { method: 'DELETE', pattern: /^\/api\/groups\/([A-Za-z0-9-]{1,100})\/visits$/, handle: (request, env, id) => new GroupController(env).purge(id) },
    { method: 'PATCH', pattern: /^\/api\/links\/([A-Za-z0-9-]{1,100})$/, handle: (request, env, id, origin) => new LinkController(env).update(request, id, origin) },
    { method: 'DELETE', pattern: /^\/api\/links\/([A-Za-z0-9-]{1,100})$/, handle: (request, env, id) => new LinkController(env).remove(id) },
    { method: 'GET', pattern: /^\/api\/visits\/([A-Za-z0-9-]{1,100})$/, handle: (request, env, id) => new VisitController(env).details(id) }
];
export async function route(request, env) {
    const url = new URL(request.url), path = url.pathname, method = request.method;
    const context = origins(request, env);
    if (!context.isAdmin && !context.isPublic) fail(404, 'NotFound');
    if (path === '/theme.css' && method === 'GET') return themeStyles(url);
    if (path === '/api/branding' && method === 'GET') return new SettingsController(env).branding();
    if (path === '/api/health' && method === 'GET') return json({ status: 'ok', service: 'device-info-lab', configured: Boolean(env.DB && env.ADMIN_KEY?.length >= 32 && env.TOKEN_SECRET?.length >= 32) });
    if (FONT_ASSETS.has(path) || (context.isAdmin && ADMIN_ASSETS.has(path)) || (context.isPublic && PUBLIC_ASSETS.has(path))) {
        if (!['GET', 'HEAD'].includes(method)) fail(405, 'BadRequest');
        return env.ASSETS.fetch(request);
    }
    if (context.isPublic && path === '/' && method === 'GET') return landingPage((await new SettingsService(env).get()).brand);
    const visit = path.match(/^\/v\/([A-Za-z0-9_-]{1,100})$/);
    if (context.isPublic && visit && ['GET', 'HEAD'].includes(method)) {
        requireConfiguration(env);
        return new VisitController(env).open(request, visit[1]);
    }
    if (context.isPublic && method === 'POST' && ['/api/visits/enrich', '/api/training/submit'].includes(path)) {
        requireConfiguration(env);
        requireSameOrigin(request);
        const controller = new VisitController(env);
        return path === '/api/visits/enrich' ? controller.enrich(request) : controller.training(request);
    }
    // Public and admin origins are not interchangeable, and credentials never cross origins.
    if (!context.isAdmin) fail(404, 'NotFound');
    requireConfiguration(env);
    if (!['GET', 'HEAD'].includes(method)) requireSameOrigin(request);
    if (path === '/api/auth/login' && method === 'POST') return new AuthController(env).login(request);
    const exact = privateRoutes.get(`${method}:${path}`);
    const dynamic = dynamicRoutes.find(item => item.method === method && item.pattern.test(path));
    if (!exact && !dynamic) fail(404, 'NotFound');
    await new AuthService(env).require(request);
    if (exact) return exact(request, env, context.publicOrigin);
    return dynamic.handle(request, env, path.match(dynamic.pattern)[1], context.publicOrigin);
}
