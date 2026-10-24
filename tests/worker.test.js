import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { createEnv, request } from './helpers.js';
import { signCapability } from '../src/utils/crypto.js';

async function login(env) {
    const response = await worker.fetch(request('/api/auth/login', {
        method: 'POST', headers: { origin: 'http://localhost:8787', 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.10' },
        body: JSON.stringify({ adminKey: env.ADMIN_KEY })
    }), env);
    assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    return cookie.split(';')[0];
}
async function createLink(env, cookie) {
    const response = await worker.fetch(request('/api/links', {
        method: 'POST', headers: { cookie, origin: 'http://localhost:8787', 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'classroom', expiresInDays: 7 })
    }), env);
    assert.equal(response.status, 201);
    return (await response.json()).data;
}
test('all private route shapes reject missing sessions and secrets fail closed', async () => {
    const env = createEnv();
    try {
        for (const path of ['/api/links', '/api/visits', '/api/visits/id', '/api/stats', '/api/export']) {
            assert.equal((await worker.fetch(request(path), env)).status, 401);
        }
        assert.equal((await worker.fetch(request('/api/links'), { ...env, ADMIN_KEY: '' })).status, 503);
    } finally { env.DB.close(); }
});
test('GET saves automatically, signed enrichment updates one row, replay is rejected', async () => {
    const env = createEnv();
    try {
        const cookie = await login(env), link = await createLink(env, cookie);
        const response = await worker.fetch(request(`/v/${link.token}`, {
            headers: { 'cf-connecting-ip': '192.0.2.15', 'user-agent': 'Mozilla/5.0 (Linux; Android 14) Chrome/130.0', 'accept-language': 'ar' },
            cf: { country: 'SA', city: 'Riyadh', asn: 64500 }
        }), env);
        assert.equal(response.status, 200);
        const html = await response.text();
        assert.doesNotMatch(html, /type="password"/);
        const capability = html.match(/data-capability="([A-Za-z0-9_.-]+)"/)[1];
        const enrich = () => worker.fetch(request('/api/visits/enrich', {
            method: 'POST', headers: { origin: 'http://localhost:8787', 'content-type': 'application/json' },
            body: JSON.stringify({ capability, browser: { screenWidth: 1080, language: 'ar' } })
        }), env);
        assert.equal((await enrich()).status, 200);
        assert.equal((await enrich()).status, 409);
        const list = await worker.fetch(request('/api/visits', { headers: { cookie } }), env);
        const payload = await list.json();
        assert.equal(payload.data.items.length, 1);
        assert.equal(payload.data.items[0].edge.ip, '192.0.2.15');
        assert.equal(payload.data.items[0].browser.screenWidth, 1080);
        await env.DB.prepare('UPDATE links SET isActive = 0 WHERE id = ?').bind(link.id).run();
        assert.equal((await worker.fetch(request(`/v/${link.token}`), env)).status, 410);
    } finally { env.DB.close(); }
});
test('HEAD and known prefetch do not create visitor records', async () => {
    const env = createEnv();
    try {
        const cookie = await login(env), link = await createLink(env, cookie);
        await worker.fetch(request(`/v/${link.token}`, { method: 'HEAD' }), env);
        await worker.fetch(request(`/v/${link.token}`, { headers: { purpose: 'prefetch' } }), env);
        const list = await worker.fetch(request('/api/visits', { headers: { cookie } }), env);
        assert.equal((await list.json()).data.total, 0);
    } finally { env.DB.close(); }
});
test('forged capability and admin cross-origin requests cannot mutate data', async () => {
    const env = createEnv();
    try {
        const cookie = await login(env);
        const response = await worker.fetch(request('/api/links', { method: 'POST', headers: { cookie, origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{}' }), env);
        assert.equal(response.status, 403);
        const forged = await signCapability('wrong-signing-secret-at-least-32-characters', { visitId: 'v1', linkId: 'l1', expiresAt: Date.now() + 100000 });
        const enrich = await worker.fetch(request('/api/visits/enrich', { method: 'POST', headers: { origin: 'http://localhost:8787', 'content-type': 'application/json' }, body: JSON.stringify({ capability: forged, browser: {} }) }), env);
        assert.equal(enrich.status, 403);
    } finally { env.DB.close(); }
});
