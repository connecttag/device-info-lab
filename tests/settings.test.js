import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { createEnv, request } from './helpers.js';

test('site brand persists, is publicly readable and only authenticated same-origin admins can change it', async () => {
    const env = createEnv();
    const send = (path, method = 'GET', body, cookie = '') => worker.fetch(request(path, { method, headers: { origin: 'http://localhost:8787', 'content-type': 'application/json', cookie }, ...(body ? { body: JSON.stringify(body) } : {}) }), env);
    try {
        const initial = await send('/api/branding'); assert.equal(initial.status, 200);
        assert.equal((await initial.json()).data.brand, 'مريم لينك');
        assert.equal((await send('/api/settings', 'PATCH', { brand: 'New' })).status, 401);
        const login = await send('/api/auth/login', 'POST', { adminKey: env.ADMIN_KEY }), cookie = login.headers.get('set-cookie').split(';')[0];
        assert.equal((await send('/api/settings', 'PATCH', { brand: 'مختبر الروابط' }, cookie)).status, 200);
        assert.equal((await (await send('/api/branding')).json()).data.brand, 'مختبر الروابط');
        assert.equal((await send('/api/settings', 'PATCH', { brand: ' ' }, cookie)).status, 400);
        assert.equal((await send('/api/settings', 'PATCH', { brand: 'x'.repeat(81) }, cookie)).status, 400);
        const creation = await send('/api/links', 'POST', { title: 'test' }, cookie), link = (await creation.json()).data;
        const html = await (await send(`/v/${link.token}`)).text();
        assert.match(html, /مختبر الروابط/); assert.doesNotMatch(html, /مريم لينك/);
        const preview = await send('/api/preview', 'POST', { title: 'test' }, cookie);
        assert.match((await preview.json()).data.html, /مختبر الروابط/);
        const productionEnv = { ...env, APP_ENV: 'production', PUBLIC_ORIGIN: 'https://info.example', ADMIN_ORIGIN: 'https://admin.example' };
        assert.match(await (await worker.fetch(new Request('https://info.example/'), productionEnv)).text(), /مختبر الروابط/);
    } finally { env.DB.close(); }
});
