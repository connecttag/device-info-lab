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
const createdGroups = new Set();
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
        const create = await admin('/api/links', { method: 'POST', body: { title: `Deployment verification / ${template}`, expiresInDays: 1, template, maxUses: null } });
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
    const branding = await fetch(`${publicOrigin}/api/branding`);
    check(branding.status === 200 && typeof (await branding.json()).data.brand === 'string', 'Public branding unavailable');
    const settings = (await (await admin('/api/settings')).json()).data;
    check(settings.retentionDays >= 1 && settings.retentionDays <= 30 && settings.timezone, 'Site settings unavailable');
    const groupResponse = await admin('/api/groups', { method: 'POST', body: { name: `Smoke ${crypto.randomUUID()}` } });
    check(groupResponse.status === 201, 'Group create failed');
    const group = (await groupResponse.json()).data; createdGroups.add(group.id);
    const content = { title: 'Deployment verification / tools', template: 'training', expiresInHours: 2, maxUses: 2, groupId: group.id, accentColor: '#1d7d74', backgroundColor: '#eaf5f1' };
    const preview = await admin('/api/preview', { method: 'POST', body: content });
    check(preview.status === 200 && !(await preview.json()).data.html.includes('<script'), 'Preview must remain inert');
    check((await (await admin(`/api/visits?groupId=${group.id}`)).json()).data.total === 0, 'Preview created a visit');
    const create = await admin('/api/links', { method: 'POST', body: content }); check(create.status === 201, 'Hour/quota link create failed');
    const link = (await create.json()).data; createdIds.add(link.id);
    check(link.expiresAt - link.createdAt === 7200000, 'Hour duration mismatch');
    const source = (await (await admin(`/api/links/${link.id}`)).json()).data;
    const cloneResponse = await admin('/api/links', { method: 'POST', body: { ...content, title: `${source.title} copy` } });
    check(cloneResponse.status === 201, 'Copy creation failed'); const clone = (await cloneResponse.json()).data; createdIds.add(clone.id);
    check(clone.token !== link.token && clone.useCount === 0, 'Copy reused token or quota');
    const qr = await admin(`/api/links/${link.id}/qr`); check(qr.status === 200 && (await qr.text()).includes('<svg'), 'QR failed');
    check((await fetch(link.url, { method: 'HEAD' })).status === 204, 'HEAD should not consume quota');
    await fetch(link.url, { headers: { 'User-Agent': 'TelegramBot (like TwitterBot)' } });
    const opens = await Promise.all(Array.from({ length: 8 }, () => fetch(link.url, { headers: { 'User-Agent': 'DeviceInfoLabCheck/1.0' } })));
    check(opens.filter(response => response.status === 200).length === 2 && opens.filter(response => response.status === 410).length === 6, 'Concurrent opens exceeded quota');
    const html = await opens.find(response => response.status === 200).text();
    check((await publicWrite('/api/visits/enrich', { capability: html.match(/data-capability="([A-Za-z0-9_.-]+)"/)[1], browser: { language: 'ar' } })).status === 200, 'Final admitted visit cannot enrich');
    check((await publicWrite('/api/training/submit', { capability: html.match(/data-training-capability="([A-Za-z0-9_.-]+)"/)[1], username: CONFIG.demoUsername, password: CONFIG.demoPassword })).status === 200, 'Final admitted visit cannot submit demo');
    const filter = `groupId=${group.id}&template=training`;
    const stats = (await (await admin(`/api/stats?${filter}`)).json()).data;
    check(stats.totalVisits === 2 && stats.trainingSubmissions === 1, 'Filtered aggregate mismatch');
    check(stats.distributions.template[0].count === 2, 'Distribution mismatch');
    check((await (await admin(`/api/export?${filter}`)).json()).data.total === 2, 'Export filter mismatch');
    check((await admin(`/api/groups/${group.id}/visits`, { method: 'DELETE' })).status === 200, 'Group purge failed');
    check((await fetch(link.url)).status === 410, 'Purging records reopened exhausted link');
    check((await admin(`/api/groups/${group.id}`, { method: 'DELETE' })).status === 200, 'Group deletion failed'); createdGroups.delete(group.id);
    check((await (await admin(`/api/links/${clone.id}`)).json()).data.groupId === null, 'Group deletion did not preserve/unassign links');
    console.log(`Smoke verification passed: ${checks} checks across six templates, preview, groups, quotas, copy, QR, settings and analytics.`);
} finally {
    for (const id of createdIds) {
        try { await admin(`/api/links/${id}`, { method: 'DELETE' }); } catch { console.error(`Could not clean up test link ${id}`); }
    }
    for (const id of createdGroups) { try { await admin(`/api/groups/${id}`, { method: 'DELETE' }); } catch { console.error(`Could not clean up test group ${id}`); } }
    if (cookie) await admin('/api/auth/logout', { method: 'POST' });
}
