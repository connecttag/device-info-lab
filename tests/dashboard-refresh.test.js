import test from 'node:test';
import assert from 'node:assert/strict';
import { initSettings } from '../public/settings.js';
test('actual settings refresh retains the newest brand, timezone and retention response', async () => {
    const original = { document: globalThis.document, fetch: globalThis.fetch };
    const nodes = new Map(), pending = [];
    globalThis.document = {
        documentElement: { dataset: {} }, title: '', querySelectorAll: () => [],
        querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, { textContent: '', addEventListener() {} }); return nodes.get(selector); }
    };
    globalThis.fetch = () => new Promise(resolve => pending.push(resolve));
    const data = (brand, timezone) => new Response(JSON.stringify({ success: true, data: { brand, timezone, retentionDays: 1, theme: 'light' } }), { headers: { 'content-type': 'application/json' } });
    try {
        const settings = initSettings({ onChanged() {}, onLogout() {}, onError() {} });
        const old = settings.refresh(), current = settings.refresh();
        pending[1](data('new', 'Asia/Riyadh')); await current;
        pending[0](data('old', 'UTC')); await old;
        assert.equal(settings.get().brand, 'new'); assert.equal(settings.get().timezone, 'Asia/Riyadh'); assert.equal(document.title, 'new');
    } finally { globalThis.document = original.document; globalThis.fetch = original.fetch; }
});
