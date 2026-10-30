import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { createEnv, request } from './helpers.js';
import { LinkRepository } from '../src/repositories/LinkRepository.js';
import { randomToken } from '../src/utils/crypto.js';
import { safeHeaders } from '../src/utils/metadata.js';
import { CONFIG } from '../src/config/constants.js';

test('all six templates record visits including real 404; custom HTML remains escaped', async () => {
    const env = createEnv(), now = Date.now();
    try {
        for (const template of CONFIG.templates) {
            const token = randomToken();
            await new LinkRepository(env.DB).create({ id: template, token, title: template, template, pageTitle: '<script>alert(1)</script>', createdAt: now, expiresAt: now + 100000 });
            const response = await worker.fetch(request(`/v/${token}`), env);
            assert.equal(response.status, template === 'notFound' ? 404 : 200);
            const html = await response.text();
            assert.ok(html.includes('&lt;script&gt;'));
            assert.equal(html.includes('<script>alert(1)</script>'), false);
            assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
        }
        assert.equal((await env.DB.prepare('SELECT COUNT(*) AS total FROM visits').first()).total, 6);
    } finally { env.DB.close(); }
});
test('public host cannot serve administration routes or assets and admin host cannot record visits', async () => {
    const env = createEnv();
    Object.assign(env, { APP_ENV: 'production', PUBLIC_ORIGIN: 'https://connecttg.net', ADMIN_ORIGIN: 'https://panel.connecttg.net' });
    try {
        for (const path of ['/api/links', '/api/visits', '/api/auth/session', '/index.html', '/app.js']) {
            assert.equal((await worker.fetch(new Request(`https://connecttg.net${path}`), env)).status, 404);
        }
        assert.equal((await worker.fetch(new Request('https://panel.connecttg.net/v/abc'), env)).status, 404);
        assert.equal((await worker.fetch(new Request('https://unknown.example/api/health'), env)).status, 404);
        assert.equal((await worker.fetch(new Request('https://panel.connecttg.net/api/links'), env)).status, 401);
    } finally { env.DB.close(); }
});
test('credential headers are removed and referrer query/fragment never persist', () => {
    const headers = safeHeaders(new Headers({ cookie: 'session=secret', authorization: 'Bearer secret', 'x-api-key': 'secret', 'cf-access-jwt-assertion': 'secret', 'x-password': 'secret', 'x-auth': 'Bearer secret', 'x-original-url': '/private?access_token=secret', 'user-agent': 'demo', referer: 'https://example.com/lesson?token=secret#private' }));
    assert.deepEqual(headers, { referer: 'https://example.com', 'user-agent': 'demo' });
});
test('training HTML is inert before its JavaScript guard is installed', async () => {
    const env = createEnv(), now = Date.now(), token = randomToken();
    try {
        await new LinkRepository(env.DB).create({ id: 'training', token, title: 'Demo', template: 'training', createdAt: now, expiresAt: now + 100000 });
        const html = await (await worker.fetch(request(`/v/${token}`), env)).text();
        assert.match(html, /id="training-form"[^>]*method="post"/);
        assert.match(html, /name="username"[^>]*disabled/);
        assert.match(html, /name="password"[^>]*disabled/);
        assert.match(html, /type="submit"[^>]*disabled/);
    } finally { env.DB.close(); }
});
