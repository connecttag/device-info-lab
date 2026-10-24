import { AuthController } from './controllers/AuthController.js';
import { LinkController } from './controllers/LinkController.js';
import { VisitController } from './controllers/VisitController.js';
import { AuthService, requireConfiguration } from './services/AuthService.js';
import { origins } from './utils/origins.js';
import { requireSameOrigin, fail, json } from './utils/http.js';
import { landingPage } from './views/visitPage.js';

const ADMIN_ASSETS = new Set(['/', '/index.html', '/app.js', '/api.js', '/ui.js', '/strings.js', '/styles.css']);
const PUBLIC_ASSETS = new Set(['/visit.js', '/strings.js', '/visit.css']);
const privateRoutes = new Map([
    ['GET:/api/auth/session', (req, env) => new AuthController(env).session(req)],
    ['POST:/api/auth/logout', (req, env) => new AuthController(env).logout(req)],
    ['GET:/api/links', (req, env, origin) => new LinkController(env).list(req, origin)],
    ['POST:/api/links', (req, env, origin) => new LinkController(env).create(req, origin)],
    ['GET:/api/visits', (req, env) => new VisitController(env).list(req)],
    ['GET:/api/stats', (req, env) => new VisitController(env).stats()],
    ['GET:/api/export', (req, env) => new VisitController(env).export(req)]
]);
const dynamicRoutes = [
    { method: 'PATCH', pattern: /^\/api\/links\/([A-Za-z0-9-]{1,100})$/, handle: (request, env, id, origin) => new LinkController(env).update(request, id, origin) },
    { method: 'DELETE', pattern: /^\/api\/links\/([A-Za-z0-9-]{1,100})$/, handle: (request, env, id) => new LinkController(env).remove(id) },
    { method: 'GET', pattern: /^\/api\/visits\/([A-Za-z0-9-]{1,100})$/, handle: (request, env, id) => new VisitController(env).details(id) }
];
export async function route(request, env) {
    const url = new URL(request.url), path = url.pathname, method = request.method;
    const context = origins(request, env);
    if (!context.isAdmin && !context.isPublic) fail(404, 'NotFound');
    if (path === '/api/health' && method === 'GET') return json({ status: 'ok', service: 'device-info-lab', configured: Boolean(env.DB && env.ADMIN_KEY?.length >= 32 && env.TOKEN_SECRET?.length >= 32) });
    if ((context.isAdmin && ADMIN_ASSETS.has(path)) || (context.isPublic && PUBLIC_ASSETS.has(path))) {
        if (!['GET', 'HEAD'].includes(method)) fail(405, 'BadRequest');
        return env.ASSETS.fetch(request);
    }
    if (context.isPublic && path === '/' && method === 'GET') return landingPage();
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
