import { CONFIG, SECURITY_HEADERS } from '../config/constants.js';
import { ERRORS } from '../../public/strings.js';

export class HttpError extends Error {
    constructor(status, code) { super(ERRORS[code] ?? ERRORS.BadRequest); this.status = status; this.code = code; }
}
export function fail(status, code) { throw new HttpError(status, code); }
export function json(data, status = 200, headers = {}) {
    return new Response(JSON.stringify({ success: true, data }), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });
}
export function errorResponse(error) {
    const known = error instanceof HttpError;
    return new Response(JSON.stringify({ success: false, error: { code: known ? error.code : 'InternalError', message: known ? error.message : ERRORS.InternalError } }), {
        status: known ? error.status : 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...(known && error.status === 429 ? { 'Retry-After': '60' } : {}) }
    });
}
export function secure(response, request) {
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) headers.set(key, value);
    if (new URL(request.url).protocol === 'https:') headers.set('Strict-Transport-Security', 'max-age=31536000');
    return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, statusText: response.statusText, headers });
}
export function requireSameOrigin(request) {
    if (request.headers.get('Origin') !== new URL(request.url).origin) fail(403, 'Forbidden');
}
export async function parseJson(request) {
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') fail(415, 'UnsupportedMediaType');
    const length = Number(request.headers.get('content-length') || 0);
    if (length > CONFIG.maxBodyBytes) fail(413, 'PayloadTooLarge');
    if (!request.body) fail(400, 'InvalidJson');
    const reader = request.body.getReader();
    const chunks = [];
    let size = 0;
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > CONFIG.maxBodyBytes) { await reader.cancel(); fail(413, 'PayloadTooLarge'); }
            chunks.push(value);
        }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let value;
    try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { fail(400, 'InvalidJson'); }
    if (!value || Array.isArray(value) || typeof value !== 'object') fail(400, 'InvalidJson');
    return value;
}
export function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
