import { BaseRepository } from '../core/base/BaseRepository.js';
import { visitFilters } from '../utils/visitFilters.js';
import { dayStart, nextDate, calendarDate } from '../utils/timezone.js';

function hydrate(row) {
    if (!row) return null;
    const { edgeJson, browserJson, trainingJson, ...rest } = row;
    return { ...rest, isBot: Boolean(rest.isBot), edge: JSON.parse(edgeJson), browser: browserJson ? JSON.parse(browserJson) : null, training: trainingJson ? JSON.parse(trainingJson) : null };
}
export class VisitRepository extends BaseRepository {
    async record({ id, linkId, now, retainUntil, edge }) {
        const result = await this.first(`INSERT INTO visits (id, linkId, createdAt, retainUntil, ip, country, browserName, osName, isBot, edgeJson, template)
            SELECT ?, id, ?, ?, ?, ?, ?, ?, ?, ?, template FROM links WHERE id = ? AND isActive = 1 AND expiresAt > ? AND (maxUses IS NULL OR useCount < maxUses) RETURNING id`,
        [id, now, retainUntil, edge.ip ?? null, edge.country ?? null, edge.browserName ?? null, edge.osName ?? null, Number(edge.isBot), JSON.stringify(edge), linkId, now]);
        return Boolean(result);
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
    async list(query, now) {
        const { page, pageSize } = query;
        const { where, params } = visitFilters(query, now);
        const count = await this.first(`SELECT COUNT(*) AS total FROM visits v JOIN links l ON l.id = v.linkId WHERE ${where}`, params);
        const items = await this.all(`SELECT v.*, l.title AS linkTitle FROM visits v JOIN links l ON l.id = v.linkId WHERE ${where} ORDER BY v.createdAt DESC, v.id LIMIT ? OFFSET ?`, [...params, pageSize, (page - 1) * pageSize]);
        return { items: items.map(hydrate), total: count.total, page, pageSize };
    }
    async stats(now, query = {}) {
        const timezone = query.timezone || 'UTC', date = calendarDate(now, timezone);
        const today = dayStart(date, timezone), tomorrow = dayStart(nextDate(date), timezone);
        const { where, params } = visitFilters(query, now);
        const totals = await this.first(`SELECT (SELECT COUNT(*) FROM links) AS totalLinks,
            COUNT(*) AS totalVisits, COALESCE(SUM(CASE WHEN v.createdAt >= ? AND v.createdAt < ? THEN 1 ELSE 0 END), 0) AS todayVisits,
            COALESCE(SUM(CASE WHEN v.trainingAt IS NOT NULL THEN 1 ELSE 0 END), 0) AS trainingSubmissions
            FROM visits v JOIN links l ON l.id = v.linkId WHERE ${where}`, [today, tomorrow, ...params]);
        const distributions = {};
        for (const [key, column] of Object.entries({ template: 'v.template', browser: 'v.browserName', os: 'v.osName', country: 'v.country' })) {
            distributions[key] = await this.all(`SELECT COALESCE(NULLIF(${column}, ''), 'unknown') AS label, COUNT(*) AS count FROM visits v JOIN links l ON l.id = v.linkId WHERE ${where} GROUP BY label ORDER BY count DESC, label`, params);
        }
        return { ...totals, distributions };
    }
}
