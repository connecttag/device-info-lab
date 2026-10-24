import { BaseRepository } from '../core/base/BaseRepository.js';
export class RateLimitRepository extends BaseRepository {
    async admit(key, limit, windowMs, now = Date.now()) {
        const start = Math.floor(now / windowMs) * windowMs;
        const row = await this.first(`INSERT INTO rateLimits (bucketKey, count, expiresAt) VALUES (?, 1, ?)
            ON CONFLICT(bucketKey) DO UPDATE SET count = count + 1 RETURNING count`, [`${key}:${start}`, start + windowMs]);
        return row.count <= limit;
    }
}
