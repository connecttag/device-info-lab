import { BaseRepository } from '../core/base/BaseRepository.js';

export class LinkRepository extends BaseRepository {
    async create({ id, token, title, template = 'welcome', pageTitle = null, pageMessage = null, companyName = null, companyWebsite = null, createdAt, expiresAt }) {
        await this.run('INSERT INTO links (id, token, title, template, pageTitle, pageMessage, companyName, companyWebsite, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, token, title, template, pageTitle, pageMessage, companyName, companyWebsite, createdAt, expiresAt]);
    }
    findByToken(token) { return this.first('SELECT * FROM links WHERE token = ?', [token]); }
    findById(id) { return this.first('SELECT * FROM links WHERE id = ?', [id]); }
    async list({ page, pageSize, q = '' }, now) {
        const term = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
        const where = "l.title LIKE ? ESCAPE '\\'";
        const count = await this.first(`SELECT COUNT(*) AS total FROM links l WHERE ${where}`, [term]);
        const items = await this.all(`SELECT l.*, (SELECT COUNT(*) FROM visits v WHERE v.linkId = l.id AND v.retainUntil > ?) AS visitCount FROM links l WHERE ${where} ORDER BY l.createdAt DESC, l.id LIMIT ? OFFSET ?`, [now, term, pageSize, (page - 1) * pageSize]);
        return { items, total: count.total, page, pageSize };
    }
    async count() { return (await this.first('SELECT COUNT(*) AS total FROM links')).total; }
    async update(id, data) {
        const keys = Object.keys(data).filter(key => ['title', 'isActive'].includes(key));
        if (!keys.length) return;
        const values = keys.map(key => key === 'isActive' ? Number(data[key]) : data[key]);
        await this.run(`UPDATE links SET ${keys.map(key => `${key} = ?`).join(', ')} WHERE id = ?`, [...values, id]);
    }
    async remove(id) { await this.run('DELETE FROM links WHERE id = ?', [id]); }
}
