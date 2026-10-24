import { S } from './strings.js';
export class ApiError extends Error {
    constructor(message, status) { super(message); this.status = status; }
}
export async function api(path, { method = 'GET', body, signal } = {}) {
    let response;
    try {
        response = await fetch(path, { method, credentials: 'same-origin', headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal });
    } catch (error) { if (error.name === 'AbortError') throw error; throw new ApiError(S.connectionError, 0); }
    let payload;
    try { payload = await response.json(); } catch { throw new ApiError(S.genericError, response.status); }
    if (!response.ok || !payload.success) throw new ApiError(payload.error?.message || S.genericError, response.status);
    return payload.data;
}
export function query(values) {
    return new URLSearchParams(Object.entries(values).filter(([, value]) => value !== '' && value !== undefined)).toString();
}
