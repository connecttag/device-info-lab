import { BaseService } from '../core/base/BaseService.js';
import { RateLimitRepository } from '../repositories/RateLimitRepository.js';
import { sha256 } from '../utils/crypto.js';
import { fail } from '../utils/http.js';
export class RateLimitService extends BaseService {
    async check(request, scope, limit, windowMs) {
        const ip = request.headers.get('cf-connecting-ip') ?? 'local-or-unknown';
        const key = await sha256(`${this.env.TOKEN_SECRET}:${scope}:${ip}`);
        if (!await new RateLimitRepository(this.env.DB).admit(key, limit, windowMs)) fail(429, 'RateLimited');
    }
}
