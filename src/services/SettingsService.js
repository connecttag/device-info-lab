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
        const data = { ...await this.get(), ...body };
        if (typeof data.brand !== 'string' || !data.brand.trim() || data.brand.trim().length > 80) fail(400, 'BadRequest');
        data.brand = data.brand.trim();
        if (!CONFIG.templates.includes(data.defaultTemplate) || !Number.isInteger(data.defaultExpiryHours) || data.defaultExpiryHours < 1 || data.defaultExpiryHours > 2160 || !Number.isInteger(data.retentionDays) || data.retentionDays < 1 || data.retentionDays > 30 || !['system', 'light', 'dark'].includes(data.theme)) fail(400, 'BadRequest');
        if (data.defaultMaxUses !== null && (!Number.isInteger(data.defaultMaxUses) || data.defaultMaxUses < 1 || data.defaultMaxUses > 1000000)) fail(400, 'BadRequest');
        if (typeof data.timezone !== 'string' || data.timezone.length > 100) fail(400, 'BadRequest');
        try { new Intl.DateTimeFormat('en', { timeZone: data.timezone }).format(); } catch { fail(400, 'BadRequest'); }
        await this.settings.set(data);
        return data;
    }
}
