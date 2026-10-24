import { SettingsRepository } from '../repositories/SettingsRepository.js';
import { S } from '../../public/strings.js';
import { onlyKeys } from '../utils/validation.js';
import { fail } from '../utils/http.js';
import { CONFIG } from '../config/constants.js';
export class SettingsService {
    constructor(env) { this.settings = new SettingsRepository(env.DB); }
    async get() { return await this.settings.get() || { brand: S.brand, defaultTemplate: 'deviceInfo', defaultExpiryHours: 168, defaultMaxUses: null, timezone: 'UTC', retentionDays: 30, theme: 'system' }; }
    async update(body) {
        onlyKeys(body, ['brand', 'defaultTemplate', 'defaultExpiryHours', 'defaultMaxUses', 'timezone', 'retentionDays', 'theme']);
        if (!Object.keys(body).length) fail(400, 'BadRequest');
        const data = { ...body };
        if ('brand' in data) {
            if (typeof data.brand !== 'string' || !data.brand.trim() || data.brand.trim().length > 80) fail(400, 'BadRequest');
            data.brand = data.brand.trim();
        }
        if ('defaultTemplate' in data && !CONFIG.templates.includes(data.defaultTemplate)) fail(400, 'BadRequest');
        if ('theme' in data && !['system', 'light', 'dark'].includes(data.theme)) fail(400, 'BadRequest');
        for (const [key, max] of [['defaultExpiryHours', 2160], ['retentionDays', 30], ['defaultMaxUses', 1000000]]) {
            if (!(key in data) || (key === 'defaultMaxUses' && data[key] === null)) continue;
            if (!Number.isInteger(data[key]) || data[key] < 1 || data[key] > max) fail(400, 'BadRequest');
        }
        if ('timezone' in data) {
            if (typeof data.timezone !== 'string' || !data.timezone || data.timezone.length > 100) fail(400, 'BadRequest');
            try { new Intl.DateTimeFormat('en', { timeZone: data.timezone }).format(); } catch { fail(400, 'BadRequest'); }
        }
        await this.settings.set(data, S.brand);
        return this.get();
    }
}
