import { BaseRepository } from '../core/base/BaseRepository.js';
export class SettingsRepository extends BaseRepository {
    get() { return this.first('SELECT brand, defaultTemplate, defaultExpiryHours, defaultMaxUses, timezone, retentionDays, theme FROM siteSettings WHERE id = 1'); }
    async set(data) {
        const keys = ['brand', 'defaultTemplate', 'defaultExpiryHours', 'defaultMaxUses', 'timezone', 'retentionDays', 'theme'];
        await this.db.batch([
            this.statement(`INSERT INTO siteSettings (id, ${keys.join(', ')}) VALUES (1, ${keys.map(() => '?').join(', ')}) ON CONFLICT(id) DO UPDATE SET ${keys.map(k => `${k} = excluded.${k}`).join(', ')}`, keys.map(k => data[k])),
            this.statement('UPDATE visits SET retainUntil = MIN(retainUntil, createdAt + ?)', [data.retentionDays * 86400000])
        ]);
    }
}
