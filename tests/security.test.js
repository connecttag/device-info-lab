import test from 'node:test';
import assert from 'node:assert/strict';
import { randomToken, safeEqual, signCapability, verifyCapability } from '../src/utils/crypto.js';
import { parseJson, requireSameOrigin } from '../src/utils/http.js';
import { validateLink, parseBrowser } from '../src/utils/validation.js';
import { collectEdgeMetadata, shouldSkipVisit } from '../src/utils/metadata.js';
import { request } from './helpers.js';

const secret = 'test-secret-for-hmac-verification-only-123456789';
test('random tokens are URL safe and secret comparison rejects unequal values', async () => {
    assert.match(randomToken(), /^[A-Za-z0-9_-]{43}$/);
    assert.equal(await safeEqual('same', 'same'), true);
    assert.equal(await safeEqual('same', 'different'), false);
});
test('capability signature binds visit, link, purpose and expiration', async () => {
    const token = await signCapability(secret, { visitId: 'v1', linkId: 'l1', expiresAt: Date.now() + 5000 });
    assert.equal((await verifyCapability(secret, token)).visitId, 'v1');
    const [payload, signature] = token.split('.');
    await assert.rejects(verifyCapability(secret, `${payload}.${signature[0] === 'a' ? 'b' : 'a'}${signature.slice(1)}`));
    await assert.rejects(verifyCapability(secret, await signCapability(secret, { visitId: 'v1', linkId: 'l1', expiresAt: Date.now() - 1 })));
    await assert.rejects(verifyCapability('other-secret-that-is-at-least-32-characters', token));
});
test('JSON parsing bounds actual stream bytes even without Content-Length', async () => {
    await assert.rejects(parseJson(request('/api/links', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'x'.repeat(9000) }) })), { status: 413 });
    await assert.rejects(parseJson(request('/api/links', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '[]' })), { status: 400 });
});
test('administrative writes require a matching Origin', () => {
    assert.throws(() => requireSameOrigin(request('/api/links', { method: 'POST' })), { status: 403 });
    assert.throws(() => requireSameOrigin(request('/api/links', { method: 'POST', headers: { origin: 'https://evil.example' } })), { status: 403 });
    requireSameOrigin(request('/api/links', { method: 'POST', headers: { origin: 'http://localhost:8787' } }));
});
test('link and browser validation reject unbounded or foreign fields', () => {
    assert.throws(() => validateLink({ title: 'x', expiresInDays: -1 }), { status: 400 });
    assert.throws(() => validateLink({ title: 'x', redirectUrl: 'https://example.com' }), { status: 400 });
    assert.throws(() => parseBrowser({ screenWidth: 1e8 }), { status: 400 });
    assert.throws(() => parseBrowser({ ip: '1.2.3.4' }), { status: 400 });
    assert.equal(parseBrowser({ screenWidth: 1920, language: 'ar' }).screenWidth, 1920);
});
test('edge data never trusts arbitrary forwarded IP and absent values remain null', () => {
    const value = collectEdgeMetadata(request('/v/x', { headers: { 'x-forwarded-for': '1.2.3.4', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0' } }));
    assert.equal(value.ip, null);
    assert.equal(value.country, null);
    assert.equal(value.osName, 'Windows');
    assert.equal(shouldSkipVisit(request('/v/x', { method: 'HEAD' })), true);
    assert.equal(shouldSkipVisit(request('/v/x', { headers: { 'sec-purpose': 'prefetch' } })), true);
});
