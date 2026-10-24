import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from './helpers.js';
import { LinkRepository } from '../src/repositories/LinkRepository.js';
import { VisitRepository } from '../src/repositories/VisitRepository.js';
import { RateLimitRepository } from '../src/repositories/RateLimitRepository.js';

test('visit insertion, one-time enrichment and cascade deletion use real SQLite', async () => {
    const db = createDatabase();
    try {
        const links = new LinkRepository(db);
        const visits = new VisitRepository(db);
        const now = Date.now();
        await links.create({ id: 'l1', token: 'token', title: "quote ' and <script>", createdAt: now, expiresAt: now + 100000 });
        const saved = await visits.record({ id: 'v1', linkId: 'l1', now, retainUntil: now + 100000, edge: { ip: '192.0.2.1', country: 'SA', isBot: false } });
        assert.equal(saved, true);
        assert.equal(await visits.enrich('v1', 'l1', { language: 'ar' }, now), true);
        assert.equal(await visits.enrich('v1', 'l1', { language: 'en' }, now), false);
        assert.equal((await visits.findById('v1', now)).browser.language, 'ar');
        await links.remove('l1');
        assert.equal(await visits.findById('v1', now), null);
    } finally { db.close(); }
});
test('disabled, expired and retention-expired rows cannot be recorded or enriched', async () => {
    const db = createDatabase();
    try {
        const links = new LinkRepository(db), visits = new VisitRepository(db), now = Date.now();
        await links.create({ id: 'l1', token: 'token', title: 'test', createdAt: now, expiresAt: now + 10000 });
        await visits.record({ id: 'v1', linkId: 'l1', now, retainUntil: now + 10000, edge: { isBot: false } });
        await links.update('l1', { isActive: false });
        assert.equal(await visits.record({ id: 'v2', linkId: 'l1', now, retainUntil: now + 1000, edge: { isBot: false } }), false);
        assert.equal(await visits.enrich('v1', 'l1', {}, now), false);
        await links.update('l1', { isActive: true });
        assert.equal(await visits.record({ id: 'v2', linkId: 'l1', now: now + 20000, retainUntil: now + 30000, edge: { isBot: false } }), false);
        assert.equal(await visits.findById('v1', now + 20000), null);
    } finally { db.close(); }
});
test('rate limiting is persisted and counters do not reset per repository instance', async () => {
    const db = createDatabase();
    try {
        const now = Date.now();
        assert.equal(await new RateLimitRepository(db).admit('hashed-key', 2, 60000, now), true);
        assert.equal(await new RateLimitRepository(db).admit('hashed-key', 2, 60000, now), true);
        assert.equal(await new RateLimitRepository(db).admit('hashed-key', 2, 60000, now), false);
    } finally { db.close(); }
});
