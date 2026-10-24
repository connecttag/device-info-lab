import { BaseRepository } from '../core/base/BaseRepository.js';
export class SessionRepository extends BaseRepository {
    async create(tokenHash, expiresAt) { await this.run('INSERT INTO adminSessions (tokenHash, expiresAt) VALUES (?, ?)', [tokenHash, expiresAt]); }
    find(tokenHash, now) { return this.first('SELECT expiresAt FROM adminSessions WHERE tokenHash = ? AND expiresAt > ?', [tokenHash, now]); }
    async remove(tokenHash) { await this.run('DELETE FROM adminSessions WHERE tokenHash = ?', [tokenHash]); }
}
