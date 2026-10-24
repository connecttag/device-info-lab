import { SettingsRepository } from '../repositories/SettingsRepository.js';
import { S } from '../../public/strings.js';
import { onlyKeys } from '../utils/validation.js';
import { fail } from '../utils/http.js';
export class SettingsService {
    constructor(env) { this.settings = new SettingsRepository(env.DB); }
    async get() { return await this.settings.get() || { brand: S.brand }; }
    async update(body) {
        onlyKeys(body, ['brand']);
        if (typeof body.brand !== 'string' || !body.brand.trim() || body.brand.trim().length > 80) fail(400, 'BadRequest');
        const brand = body.brand.trim();
        await this.settings.set(brand);
        return { brand };
    }
}
