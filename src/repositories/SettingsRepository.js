import { BaseRepository } from '../core/base/BaseRepository.js';
export class SettingsRepository extends BaseRepository {
    get() { return this.first('SELECT brand, defaultTemplate, defaultExpiryHours, defaultMaxUses, timezone, retentionDays, theme FROM siteSettings WHERE id = 1'); }
    async set(data, defaultBrand) {
        const allowed = ['brand', 'defaultTemplate', 'defaultExpiryHours', 'defaultMaxUses', 'timezone', 'retentionDays', 'theme'];
        const keys = Object.keys(data).filter(key => allowed.includes(key));
        const insertKeys = keys.includes('brand') ? keys : ['brand', ...keys];
        const values = { brand: defaultBrand, ...data };
        const statements = [this.statement(`INSERT INTO siteSettings (id, ${insertKeys.join(', ')}) VALUES (1, ${insertKeys.map(() => '?').join(', ')}) ON CONFLICT(id) DO UPDATE SET ${keys.map(k => `${k} = excluded.${k}`).join(', ')}`, insertKeys.map(k => values[k]))];
        if ('retentionDays' in data) statements.push(this.statement('UPDATE visits SET retainUntil = createdAt + ? WHERE retainUntil > createdAt + ?', [data.retentionDays * 86400000, data.retentionDays * 86400000]));
        await this.db.batch(statements);
    }
}
