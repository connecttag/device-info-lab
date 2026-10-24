import { BaseRepository } from '../core/base/BaseRepository.js';
export class SettingsRepository extends BaseRepository {
    get() { return this.first('SELECT brand FROM siteSettings WHERE id = 1'); }
    set(brand) { return this.run('INSERT INTO siteSettings (id, brand) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET brand = excluded.brand', [brand]); }
}
