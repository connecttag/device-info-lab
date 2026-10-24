import { BaseRepository } from '../core/base/BaseRepository.js';
export class SessionRepository extends BaseRepository {
    async create(tokenHash, expiresAt) { await this.run('INSERT INTO adminSessions (tokenHash, expiresAt) VALUES (?, ?)', [tokenHash, expiresAt]); }
    find(tokenHash, now) { return this.first('SELECT expiresAt FROM adminSessions WHERE tokenHash = ? AND expiresAt > ?', [tokenHash, now]); }
    async remove(tokenHash) { await this.run('DELETE FROM adminSessions WHERE tokenHash = ?', [tokenHash]); }
    credential() { return this.first('SELECT keyDigest FROM adminCredentials WHERE id = 1'); }
    async revokeAll() { await this.run('DELETE FROM adminSessions'); }
    async rotate(expected, next) {
        const results = await this.db.batch([
            this.statement('INSERT INTO adminCredentials (id, keyDigest) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET keyDigest = excluded.keyDigest WHERE keyDigest = ?', [next, expected]),
            this.statement('DELETE FROM adminSessions')
        ]);
        return results[0].meta.changes === 1;
    }
}
