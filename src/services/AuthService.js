import { BaseService } from '../core/base/BaseService.js';
import { SessionRepository } from '../repositories/SessionRepository.js';
import { RateLimitService } from './RateLimitService.js';
import { randomToken, safeEqual, sha256 } from '../utils/crypto.js';
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
    hash(token) { return sha256(`${this.env.ADMIN_KEY}:${token}`); }
    cookie(request, token, clear = false) {
        const secure = new URL(request.url).protocol === 'https:';
        return `${CONFIG.cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : CONFIG.sessionMs / 1000}${secure ? '; Secure' : ''}`;
    }
    async login(request, adminKey) {
        await new RateLimitService(this.env).check(request, 'login', CONFIG.loginLimit, CONFIG.loginWindowMs);
        if (typeof adminKey !== 'string' || adminKey.length > 512 || !await safeEqual(adminKey, this.env.ADMIN_KEY)) fail(401, 'Unauthorized');
        const token = randomToken();
        await this.sessions.create(await this.hash(token), Date.now() + CONFIG.sessionMs);
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
}
