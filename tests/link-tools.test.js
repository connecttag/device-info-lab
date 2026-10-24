import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { createEnv, request } from './helpers.js';
import { LinkRepository } from '../src/repositories/LinkRepository.js';
import { VisitRepository } from '../src/repositories/VisitRepository.js';
import { pageQuery, validateLink } from '../src/utils/validation.js';

async function client(env) {
    let cookie = '';
    const send = (path, method = 'GET', body) => worker.fetch(request(path, { method, headers: { cookie, origin: 'http://localhost:8787', 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env);
    const response = await send('/api/auth/login', 'POST', { adminKey: env.ADMIN_KEY });
    cookie = response.headers.get('set-cookie').split(';')[0];
    return send;
}
const payload = async response => (await response.json()).data;

test('hours, maxUses, logo and colors are bounded; legacy days remains supported', () => {
    const value = validateLink({ title: 'Demo', expiresInHours: 2, maxUses: 3, accentColor: '#345678', backgroundColor: '#fafafa' });
    assert.equal(value.expiresInHours, 2); assert.equal(value.maxUses, 3);
    assert.equal(validateLink({ title: 'Old', expiresInDays: 2 }).expiresInHours, 48);
    for (const extra of [{ expiresInHours: 0 }, { expiresInHours: 2161 }, { expiresInHours: 1.5 }, { maxUses: 0 }, { maxUses: '2' }, { accentColor: 'red;display:none' }, { logoData: 'data:image/svg+xml;base64,PHN2Zz4=' }]) {
        assert.throws(() => validateLink({ title: 'Demo', ...extra }));
    }
});
test('quota admits exact maximum under competing opens and survives retained-row cleanup', async () => {
    const env = createEnv();
    try {
        const links = new LinkRepository(env.DB), visits = new VisitRepository(env.DB), now = Date.now();
        await links.create({ id: 'quota', token: 'token', title: 'quota', maxUses: 2, createdAt: now, expiresAt: now + 100000 });
        const results = await Promise.all(Array.from({ length: 12 }, (_, i) => visits.record({ id: `v${i}`, linkId: 'quota', now, retainUntil: now + 10000, edge: { isBot: false } })));
        assert.equal(results.filter(Boolean).length, 2);
        assert.equal((await links.findById('quota')).useCount, 2);
        assert.equal(await visits.enrich('v0', 'quota', { language: 'ar' }, now), true);
        await env.DB.prepare('DELETE FROM visits WHERE linkId = ?').bind('quota').run();
        assert.equal(await visits.record({ id: 'again', linkId: 'quota', now, retainUntil: now + 10000, edge: { isBot: false } }), false);
    } finally { env.DB.close(); }
});
test('groups can be created, renamed, assigned and deleted without deleting links; QR remains private', async () => {
    const env = createEnv();
    try {
        const send = await client(env);
        const response = await send('/api/groups', 'POST', { name: 'Class A' }); assert.equal(response.status, 201);
        const group = await payload(response);
        assert.equal((await send('/api/groups', 'POST', { name: 'class a' })).status, 409);
        const link = await payload(await send('/api/links', 'POST', { title: 'first', expiresInHours: 2, maxUses: 1, groupId: group.id }));
        assert.equal(link.groupId, group.id); assert.equal(link.expiresAt - link.createdAt, 7200000);
        assert.equal((await payload(await send(`/api/links/${link.id}`))).token, link.token);
        assert.equal((await payload(await send(`/api/links?groupId=${group.id}`))).total, 1);
        assert.equal((await send(`/api/groups/${group.id}`, 'PATCH', { name: 'Class B' })).status, 200);
        const qr = await send(`/api/links/${link.id}/qr`); assert.equal(qr.status, 200); assert.match(await qr.text(), /<svg/);
        assert.equal((await worker.fetch(request(`/api/links/${link.id}/qr`), env)).status, 401);
        await send(`/api/groups/${group.id}`, 'DELETE');
        assert.equal((await payload(await send(`/api/links/${link.id}`))).groupId, null);
        assert.equal((await payload(await send('/api/links'))).total, 1);
        assert.equal((await send('/api/links', 'POST', { title: 'bad', groupId: group.id })).status, 400);
    } finally { env.DB.close(); }
});
test('UTC range and dimensions agree across visits, statistics and export including demo count', async () => {
    const env = createEnv();
    try {
        const send = await client(env), now = Date.now(), day = Math.floor(now / 86400000) * 86400000;
        const link = await payload(await send('/api/links', 'POST', { title: 'training', template: 'training' }));
        const repo = new VisitRepository(env.DB);
        for (const [id, time, country] of [['before', day - 1, 'SA'], ['start', day, 'YE'], ['end', day + 86399999, 'YE'], ['after', day + 86400000, 'SA']]) {
            await repo.record({ id, linkId: link.id, now: time, retainUntil: now + 86400000, edge: { country, browserName: 'Chrome', osName: 'Android', isBot: false } });
        }
        await repo.saveTraining('start', link.id, { username: 'student.demo' }, now);
        const date = new Date(day).toISOString().slice(0, 10), filter = `from=${date}&to=${date}&template=training&browser=Chrome&os=Android&country=YE`;
        assert.equal((await payload(await send(`/api/visits?${filter}`))).total, 2);
        const stats = await payload(await send(`/api/stats?${filter}`));
        assert.equal(stats.totalVisits, 2); assert.equal(stats.trainingSubmissions, 1);
        assert.deepEqual(stats.distributions.country, [{ label: 'YE', count: 2 }]);
        assert.deepEqual(stats.distributions.template, [{ label: 'training', count: 2 }]);
        assert.equal((await payload(await send(`/api/export?${filter}`))).total, 2);
        const empty = await payload(await send('/api/stats?country=ZZ'));
        assert.equal(empty.totalVisits, 0); assert.deepEqual(empty.distributions.browser, []);
        for (const query of ['from=2026-02-30', 'from=2026-10-25&to=2026-10-24', 'template=bad', 'country=BAD']) assert.throws(() => pageQuery(new URL(`https://example.com?${query}`)));
    } finally { env.DB.close(); }
});
test('preview uses actual theme but cannot create visits, capabilities or executable user content', async () => {
    const env = createEnv();
    try {
        const send = await client(env);
        const response = await send('/api/preview', 'POST', { title: 'preview', template: 'promotional', pageTitle: '<script>alert(1)</script>', accentColor: '#123456', backgroundColor: '#fafafa' });
        assert.equal(response.status, 200);
        const { html } = await payload(response);
        assert.match(html, /&lt;script&gt;/); assert.match(html, /theme.css\?/);
        assert.doesNotMatch(html, /<script|data-capability="[^"]+"/);
        assert.equal((await payload(await send('/api/visits'))).total, 0);
        assert.equal((await payload(await send('/api/links'))).total, 0);
        assert.equal((await worker.fetch(request('/api/preview', { method: 'POST', headers: { origin: 'http://localhost:8787', 'content-type': 'application/json' }, body: '{}' }), env)).status, 401);
        assert.equal((await worker.fetch(request('/theme.css?accent=evil'), env)).status, 400);
    } finally { env.DB.close(); }
});
