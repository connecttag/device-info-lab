import { BaseRepository } from '../core/base/BaseRepository.js';

function hydrate(row) {
    if (!row) return null;
    const { edgeJson, browserJson, trainingJson, ...rest } = row;
    return { ...rest, isBot: Boolean(rest.isBot), edge: JSON.parse(edgeJson), browser: browserJson ? JSON.parse(browserJson) : null, training: trainingJson ? JSON.parse(trainingJson) : null };
}
export class VisitRepository extends BaseRepository {
    async record({ id, linkId, now, retainUntil, edge }) {
        const result = await this.run(`INSERT INTO visits (id, linkId, createdAt, retainUntil, ip, country, browserName, osName, isBot, edgeJson)
            SELECT ?, id, ?, ?, ?, ?, ?, ?, ?, ? FROM links WHERE id = ? AND isActive = 1 AND expiresAt > ?`,
        [id, now, retainUntil, edge.ip ?? null, edge.country ?? null, edge.browserName ?? null, edge.osName ?? null, Number(edge.isBot), JSON.stringify(edge), linkId, now]);
        return result.meta.changes === 1;
    }
    async enrich(id, linkId, browser, now) {
        const result = await this.run(`UPDATE visits SET browserJson = ?, enrichedAt = ?
            WHERE id = ? AND linkId = ? AND enrichedAt IS NULL AND retainUntil > ?
            AND EXISTS (SELECT 1 FROM links WHERE id = ? AND isActive = 1 AND expiresAt > ?)`,
        [JSON.stringify(browser), now, id, linkId, now, linkId, now]);
        return result.meta.changes === 1;
    }
    async saveTraining(id, linkId, training, now) {
        const result = await this.run(`UPDATE visits SET trainingJson = ?, trainingAt = ?
            WHERE id = ? AND linkId = ? AND trainingAt IS NULL AND retainUntil > ?
            AND EXISTS (SELECT 1 FROM links WHERE id = ? AND template = 'training' AND isActive = 1 AND expiresAt > ?)`,
        [JSON.stringify(training), now, id, linkId, now, linkId, now]);
        return result.meta.changes === 1;
    }
    async findById(id, now) { return hydrate(await this.first('SELECT v.*, l.title AS linkTitle FROM visits v JOIN links l ON l.id = v.linkId WHERE v.id = ? AND v.retainUntil > ?', [id, now])); }
    async list({ page, pageSize, q = '', linkId = '' }, now) {
        const terms = ['v.retainUntil > ?'], params = [now];
        if (linkId) { terms.push('v.linkId = ?'); params.push(linkId); }
        if (q) {
            const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
            terms.push("(v.ip LIKE ? ESCAPE '\\' OR v.country LIKE ? ESCAPE '\\' OR v.browserName LIKE ? ESCAPE '\\' OR v.osName LIKE ? ESCAPE '\\' OR l.title LIKE ? ESCAPE '\\')");
            params.push(pattern, pattern, pattern, pattern, pattern);
        }
        const where = terms.join(' AND ');
        const count = await this.first(`SELECT COUNT(*) AS total FROM visits v JOIN links l ON l.id = v.linkId WHERE ${where}`, params);
        const items = await this.all(`SELECT v.*, l.title AS linkTitle FROM visits v JOIN links l ON l.id = v.linkId WHERE ${where} ORDER BY v.createdAt DESC, v.id LIMIT ? OFFSET ?`, [...params, pageSize, (page - 1) * pageSize]);
        return { items: items.map(hydrate), total: count.total, page, pageSize };
    }
    async stats(now) {
        const today = Math.floor(now / 86400000) * 86400000;
        return this.first(`SELECT (SELECT COUNT(*) FROM links) AS totalLinks,
            COUNT(*) AS totalVisits, COALESCE(SUM(CASE WHEN createdAt >= ? THEN 1 ELSE 0 END), 0) AS todayVisits
            FROM visits WHERE retainUntil > ?`, [today, now]);
    }
}
