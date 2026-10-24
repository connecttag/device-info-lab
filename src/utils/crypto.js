import { fail } from './http.js';

const encoder = new TextEncoder();
function base64url(bytes) { return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); }
function decode(value) {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) fail(403, 'Forbidden');
    try { return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)); } catch { fail(403, 'Forbidden'); }
}
export function randomToken() { return base64url(crypto.getRandomValues(new Uint8Array(32))); }
export async function sha256(value) { return base64url(await crypto.subtle.digest('SHA-256', encoder.encode(value))); }
export async function safeEqual(a, b) {
    const [left, right] = await Promise.all([crypto.subtle.digest('SHA-256', encoder.encode(a)), crypto.subtle.digest('SHA-256', encoder.encode(b))]);
    const l = new Uint8Array(left), r = new Uint8Array(right);
    let diff = 0;
    for (let i = 0; i < l.length; i++) diff |= l[i] ^ r[i];
    return diff === 0;
}
async function key(secret) { return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']); }
export async function credentialDigest(secret, value) { return base64url(await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(`admin-key:${value}`))); }
export async function signCapability(secret, payload, purpose = 'enrich') {
    const body = base64url(encoder.encode(JSON.stringify({ ...payload, purpose })));
    return `${body}.${base64url(await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(body)))}`;
}
export async function verifyCapability(secret, token, purpose = 'enrich') {
    if (typeof token !== 'string' || token.length > 1500) fail(403, 'Forbidden');
    const parts = token.split('.');
    if (parts.length !== 2) fail(403, 'Forbidden');
    if (!await crypto.subtle.verify('HMAC', await key(secret), decode(parts[1]), encoder.encode(parts[0]))) fail(403, 'Forbidden');
    let payload;
    try { payload = JSON.parse(new TextDecoder().decode(decode(parts[0]))); } catch { fail(403, 'Forbidden'); }
    if (!payload || payload.purpose !== purpose || typeof payload.visitId !== 'string' || typeof payload.linkId !== 'string' || !Number.isSafeInteger(payload.expiresAt) || payload.expiresAt <= Date.now()) fail(403, 'Forbidden');
    return payload;
}
