import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { createEnv, request } from './helpers.js';
import { pageQuery } from '../src/utils/validation.js';
import { SettingsService } from '../src/services/SettingsService.js';
import { LinkRepository } from '../src/repositories/LinkRepository.js';
import { VisitRepository } from '../src/repositories/VisitRepository.js';

test('site brand persists, is publicly readable and only authenticated same-origin admins can change it', async () => {
    const env = createEnv();
    const send = (path, method = 'GET', body, cookie = '') => worker.fetch(request(path, { method, headers: { origin: 'http://localhost:8787', 'content-type': 'application/json', cookie }, ...(body ? { body: JSON.stringify(body) } : {}) }), env);
    try {
        const initial = await send('/api/branding'); assert.equal(initial.status, 200);
        assert.equal((await initial.json()).data.brand, 'كونكت لينك');
        assert.equal((await send('/api/settings', 'PATCH', { brand: 'New' })).status, 401);
        const login = await send('/api/auth/login', 'POST', { adminKey: env.ADMIN_KEY }), cookie = login.headers.get('set-cookie').split(';')[0];
        assert.equal((await send('/api/settings', 'PATCH', { brand: 'مختبر الروابط' }, cookie)).status, 200);
        assert.equal((await (await send('/api/branding')).json()).data.brand, 'مختبر الروابط');
        assert.equal((await send('/api/settings', 'PATCH', { brand: ' ' }, cookie)).status, 400);
        assert.equal((await send('/api/settings', 'PATCH', { brand: 'x'.repeat(81) }, cookie)).status, 400);
        const creation = await send('/api/links', 'POST', { title: 'test' }, cookie), link = (await creation.json()).data;
        const html = await (await send(`/v/${link.token}`)).text();
        assert.match(html, /مختبر الروابط/); assert.doesNotMatch(html, /كونكت لينك/);
        const preview = await send('/api/preview', 'POST', { title: 'test' }, cookie);
        assert.match((await preview.json()).data.html, /مختبر الروابط/);
        const productionEnv = { ...env, APP_ENV: 'production', PUBLIC_ORIGIN: 'https://info.example', ADMIN_ORIGIN: 'https://admin.example' };
        assert.match(await (await worker.fetch(new Request('https://info.example/'), productionEnv)).text(), /مختبر الروابط/);
    } finally { env.DB.close(); }
});

test('settings validate defaults, timezone, appearance and shorten retained data without resurrection', async () => {
    const env = createEnv();
    try {
        const service = new SettingsService(env), now = Date.now();
        await env.DB.prepare('INSERT INTO links (id, token, title, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?)').bind('l', 't', 'test', now, now + 100000).run();
        await env.DB.prepare('INSERT INTO visits (id, linkId, createdAt, retainUntil, edgeJson) VALUES (?, ?, ?, ?, ?)').bind('v', 'l', now - 5 * 86400000, now + 25 * 86400000, '{}').run();
        const changed = await service.update({ brand: 'Lab', defaultTemplate: 'promotional', defaultExpiryHours: 12, defaultMaxUses: 5, timezone: 'Asia/Riyadh', retentionDays: 3, theme: 'dark' });
        assert.equal(changed.timezone, 'Asia/Riyadh'); assert.equal(changed.defaultTemplate, 'promotional');
        const shortened = (await env.DB.prepare('SELECT retainUntil FROM visits WHERE id = ?').bind('v').first()).retainUntil;
        assert.ok(shortened < now);
        await service.update({ brand: 'Lab', retentionDays: 30 });
        assert.equal((await env.DB.prepare('SELECT retainUntil FROM visits WHERE id = ?').bind('v').first()).retainUntil, shortened);
        for (const body of [{ timezone: 'Not/AZone' }, { retentionDays: 31 }, { defaultExpiryHours: 0 }, { defaultTemplate: 'fake' }, { theme: 'fake' }, { defaultMaxUses: 0 }]) await assert.rejects(() => service.update(body));
    } finally { env.DB.close(); }
});
test('calendar ranges respect timezone and daylight saving day length', () => {
    const range = (date, timezone) => pageQuery(new URL(`https://example.com?from=${date}&to=${date}`), false, timezone);
    const riyadh = range('2026-10-24', 'Asia/Riyadh');
    assert.equal(riyadh.fromAt, Date.parse('2026-10-23T21:00:00Z'));
    const spring = range('2026-03-08', 'America/New_York'); assert.equal(spring.toAt - spring.fromAt, 23 * 3600000);
    const autumn = range('2026-11-01', 'America/New_York'); assert.equal(autumn.toAt - autumn.fromAt, 25 * 3600000);
});
test('atomic admission clamps stale retention to the currently persisted setting', async () => {
    const env = createEnv();
    try {
        const now = Date.now(), settings = new SettingsService(env);
        await new LinkRepository(env.DB).create({ id: 'l', token: 't', title: 'test', createdAt: now, expiresAt: now + 86400000 });
        await settings.update({ retentionDays: 1 });
        await new VisitRepository(env.DB).record({ id: 'v', linkId: 'l', now, retainUntil: now + 30 * 86400000, edge: { isBot: false } });
        const row = await env.DB.prepare('SELECT retainUntil FROM visits WHERE id = ?').bind('v').first();
        assert.equal(row.retainUntil, now + 86400000);
    } finally { env.DB.close(); }
});
test('concurrent partial setting changes preserve each independent field', async () => {
    const env = createEnv();
    // Queue D1 batches exactly as the production primary serializes writes.
    const batch = env.DB.batch; let queue = Promise.resolve();
    env.DB.batch = statements => { const result = queue.then(() => batch(statements)); queue = result.catch(() => {}); return result; };
    try {
        const settings = new SettingsService(env);
        await settings.update({ brand: 'Original', theme: 'light' });
        await Promise.all([settings.update({ brand: 'Changed' }), settings.update({ theme: 'dark' })]);
        const data = await settings.get(); assert.equal(data.brand, 'Changed'); assert.equal(data.theme, 'dark');
    } finally { env.DB.close(); }
});
test('key rotation requires current key, invalidates sessions and stores no plaintext key', async () => {
    const env = createEnv();
    const send = (path, body, cookie = '') => worker.fetch(request(path, { method: 'POST', headers: { origin: 'http://localhost:8787', 'content-type': 'application/json', cookie }, body: JSON.stringify(body) }), env);
    try {
        const login = await send('/api/auth/login', { adminKey: env.ADMIN_KEY }), cookie = login.headers.get('set-cookie').split(';')[0];
        const nextKey = 'new-test-admin-key-only-for-local-unit-tests-123456';
        assert.equal((await send('/api/auth/rotate-key', { currentKey: 'wrong', newKey: nextKey }, cookie)).status, 401);
        assert.equal((await send('/api/auth/rotate-key', { currentKey: env.ADMIN_KEY, newKey: nextKey }, cookie)).status, 200);
        assert.equal((await worker.fetch(request('/api/auth/session', { headers: { cookie } }), env)).status, 401);
        assert.equal((await send('/api/auth/login', { adminKey: env.ADMIN_KEY })).status, 401);
        assert.equal((await send('/api/auth/login', { adminKey: nextKey })).status, 200);
        const row = await env.DB.prepare('SELECT * FROM adminCredentials').first();
        assert.ok(!JSON.stringify(row).includes(nextKey));
        const branding = await worker.fetch(request('/api/branding'), env);
        assert.deepEqual(Object.keys((await branding.json()).data).sort(), ['brand', 'theme']);
    } finally { env.DB.close(); }
});
