import { BaseService } from '../core/base/BaseService.js';
import { SessionRepository } from '../repositories/SessionRepository.js';
import { RateLimitService } from './RateLimitService.js';
import { randomToken, safeEqual, sha256, credentialDigest } from '../utils/crypto.js';
import { onlyKeys } from '../utils/validation.js';
import { fail } from '../utils/http.js';
import { CONFIG } from '../config/constants.js';

export function requireConfiguration(env) {
    if (!env.DB || typeof env.ADMIN_KEY !== 'string' || env.ADMIN_KEY.length < 32 || typeof env.TOKEN_SECRET !== 'string' || env.TOKEN_SECRET.length < 32) fail(503, 'NotConfigured');
}
export class AuthService extends BaseService {
    constructor(env) { super(env); this.sessions = new SessionRepository(env.DB); }
    token(request) {
        const cookie = request.headers.get('cookie') ?? '';
        return cookie.split(';').map(part => part.trim()).find(part => part.startsWith(`${CONFIG.cookieName}=`))?.slice(CONFIG.cookieName.length + 1) ?? '';
    }
    async currentDigest() { return (await this.sessions.credential())?.keyDigest || credentialDigest(this.env.TOKEN_SECRET, this.env.ADMIN_KEY); }
    async hash(token, digest) { return sha256(`${digest || await this.currentDigest()}:${token}`); }
    cookie(request, token, clear = false) {
        const secure = new URL(request.url).protocol === 'https:';
        return `${CONFIG.cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : CONFIG.sessionMs / 1000}${secure ? '; Secure' : ''}`;
    }
    async login(request, adminKey) {
        await new RateLimitService(this.env).check(request, 'login', CONFIG.loginLimit, CONFIG.loginWindowMs);
        const digest = await this.currentDigest();
        if (typeof adminKey !== 'string' || adminKey.length > 512 || !await safeEqual(await credentialDigest(this.env.TOKEN_SECRET, adminKey), digest)) fail(401, 'Unauthorized');
        const token = randomToken();
        await this.sessions.create(await this.hash(token, digest), Date.now() + CONFIG.sessionMs);
        return this.cookie(request, token);
    }
    async require(request) {
        const token = this.token(request);
        if (!/^[A-Za-z0-9_-]{43}$/.test(token)) fail(401, 'Unauthorized');
        const session = await this.sessions.find(await this.hash(token), Date.now());
        if (!session) fail(401, 'Unauthorized');
        return session;
    }
    async logout(request) {
        const token = this.token(request);
        if (token) await this.sessions.remove(await this.hash(token));
        return this.cookie(request, '', true);
    }
    async rotate(request, body) {
        onlyKeys(body, ['currentKey', 'newKey']);
        await new RateLimitService(this.env).check(request, 'login', CONFIG.loginLimit, CONFIG.loginWindowMs);
        const digest = await this.currentDigest();
        if (typeof body.currentKey !== 'string' || body.currentKey.length > 512 || !await safeEqual(await credentialDigest(this.env.TOKEN_SECRET, body.currentKey), digest)) fail(401, 'Unauthorized');
        if (typeof body.newKey !== 'string' || body.newKey.length < 32 || body.newKey.length > 512 || body.newKey.trim() !== body.newKey) fail(400, 'BadRequest');
        const next = await credentialDigest(this.env.TOKEN_SECRET, body.newKey);
        if (!await this.sessions.rotate(digest, next)) fail(409, 'AlreadySubmitted');
        return this.cookie(request, '', true);
    }
    async revoke(request) { await this.sessions.revokeAll(); return this.cookie(request, '', true); }
}
