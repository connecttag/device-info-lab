import { BaseRepository } from '../core/base/BaseRepository.js';
export class MaintenanceRepository extends BaseRepository {
    async clean(now) {
        // Each delete is constrained to expired records; no global resets.
        return this.db.batch([
            this.statement('DELETE FROM visits WHERE retainUntil <= ?', [now]),
            this.statement('DELETE FROM adminSessions WHERE expiresAt <= ?', [now]),
            this.statement('DELETE FROM rateLimits WHERE expiresAt <= ?', [now])
        ]);
    }
}
