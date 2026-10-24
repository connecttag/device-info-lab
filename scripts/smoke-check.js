import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG } from '../src/config/constants.js';

const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const local = process.argv.includes('--local');
const adminOrigin = local ? 'http://127.0.0.1:8787' : config.vars.ADMIN_ORIGIN;
const publicOrigin = local ? adminOrigin : config.vars.PUBLIC_ORIGIN;
const key = process.env.DEVICE_LAB_ADMIN_KEY;
if (!key) throw new Error('Set DEVICE_LAB_ADMIN_KEY in the process environment before running the smoke check.');
const createdIds = new Set();
let cookie;
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }
async function admin(path, { method = 'GET', body } = {}) {
    const response = await fetch(`${adminOrigin}${path}`, {
        method, headers: { ...(cookie ? { cookie } : {}), ...(method !== 'GET' ? { Origin: adminOrigin } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000)
    });
    return response;
}
async function publicWrite(path, body) {
    return fetch(`${publicOrigin}${path}`, { method: 'POST', headers: { Origin: publicOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
}
try {
    for (const origin of new Set([publicOrigin, adminOrigin])) {
        const health = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(20000) });
        check(health.status === 200 && (await health.json()).data.configured, 'Health/configuration check failed');
    }
    check((await admin('/api/visits')).status === 401, 'Private visits must require a session');
    if (!local) check((await fetch(`${publicOrigin}/api/links`)).status === 404, 'Public host must not expose administration');
    const login = await admin('/api/auth/login', { method: 'POST', body: { adminKey: key } });
    check(login.status === 200, 'Administrative login failed');
    const setCookie = login.headers.get('set-cookie');
    check(setCookie.includes('HttpOnly') && setCookie.includes('SameSite=Strict') && (local || setCookie.includes('Secure')), 'Session cookie protections missing');
    cookie = setCookie.split(';')[0];
    for (const template of CONFIG.templates) {
        const create = await admin('/api/links', { method: 'POST', body: { title: `Deployment verification / ${template}`, expiresInDays: 1, template } });
        check(create.status === 201, `Create failed for ${template}`);
        const link = (await create.json()).data;
        createdIds.add(link.id);
        check(link.url.startsWith(`${publicOrigin}/v/`), 'Generated URL used an incorrect origin');
        const page = await fetch(link.url, { headers: { 'User-Agent': 'DeviceInfoLabCheck/1.0', Cookie: 'testOnly=not-a-real-cookie', 'X-Auth': 'testOnly-not-a-real-token' }, signal: AbortSignal.timeout(20000) });
        check(page.status === (template === 'notFound' ? 404 : 200), `Unexpected template status: ${template}`);
        const html = await page.text();
        const capability = html.match(/data-capability="([A-Za-z0-9_.-]+)"/)?.[1];
        check(Boolean(capability), `Missing enrichment capability: ${template}`);
        const enrich = () => publicWrite('/api/visits/enrich', { capability, browser: { language: 'ar', screenWidth: 390, screenHeight: 844, online: true } });
        check((await enrich()).status === 200, 'Enrichment failed');
        check((await enrich()).status === 409, 'Enrichment replay was not rejected');
        if (template === 'training') {
            const trainingCapability = html.match(/data-training-capability="([A-Za-z0-9_.-]+)"/)?.[1];
            const result = await publicWrite('/api/training/submit', { capability: trainingCapability, username: CONFIG.demoUsername, password: CONFIG.demoPassword });
            check(result.status === 200, 'Fixed demo account could not be saved');
        }
        const list = await admin(`/api/visits?linkId=${encodeURIComponent(link.id)}`);
        const visits = (await list.json()).data;
        check(visits.total === 1 && visits.items[0].browser.language === 'ar', 'Visit and browser fields did not persist to D1');
        const headers = visits.items[0].edge.requestHeaders;
        check(!('cookie' in headers) && !('x-auth' in headers), 'Sensitive headers were retained');
        if (template === 'training') check(visits.items[0].training.password === CONFIG.demoPassword, 'Training data was not persisted');
        check((await admin(`/api/links/${link.id}`, { method: 'PATCH', body: { isActive: false } })).status === 200, 'Disable failed');
        check((await fetch(link.url)).status === 410, 'Disabled link accepted a visit');
        check((await admin(`/api/links/${link.id}`, { method: 'DELETE' })).status === 200, 'Cleanup delete failed');
        createdIds.delete(link.id);
        const after = (await (await admin(`/api/visits?linkId=${encodeURIComponent(link.id)}`)).json()).data;
        check(after.total === 0, 'Link deletion did not cascade to its visit');
    }
    console.log(`Smoke verification passed: ${checks} checks across all six templates. Created test links and visits were removed.`);
} finally {
    for (const id of createdIds) {
        try { await admin(`/api/links/${id}`, { method: 'DELETE' }); } catch { console.error(`Could not clean up test link ${id}`); }
    }
    if (cookie) await admin('/api/auth/logout', { method: 'POST' });
}
