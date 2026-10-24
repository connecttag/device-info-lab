import { BaseRepository } from '../core/base/BaseRepository.js';
export class GroupRepository extends BaseRepository {
    list() { return this.all('SELECT g.*, (SELECT COUNT(*) FROM links l WHERE l.groupId = g.id) AS linkCount FROM linkGroups g ORDER BY g.createdAt DESC, g.id'); }
    find(id) { return this.first('SELECT * FROM linkGroups WHERE id = ?', [id]); }
    create(id, name, now) { return this.first('INSERT OR IGNORE INTO linkGroups (id, name, createdAt) SELECT ?, ?, ? WHERE (SELECT COUNT(*) FROM linkGroups) < 100 RETURNING *', [id, name, now]); }
    rename(id, name) { return this.first('UPDATE OR IGNORE linkGroups SET name = ? WHERE id = ? RETURNING *', [name, id]); }
    remove(id) { return this.run('DELETE FROM linkGroups WHERE id = ?', [id]); }
}
