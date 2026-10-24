import { BaseService } from '../core/base/BaseService.js';
import { LinkRepository } from '../repositories/LinkRepository.js';
import { randomToken } from '../utils/crypto.js';
import { fail } from '../utils/http.js';
import { CONFIG } from '../config/constants.js';

export class LinkService extends BaseService {
    constructor(env) { super(env); this.links = new LinkRepository(env.DB); }
    present(link, publicOrigin) {
        return { ...link, isActive: Boolean(link.isActive), url: `${publicOrigin}/v/${link.token}`, status: link.expiresAt <= Date.now() ? 'expired' : link.isActive ? 'active' : 'disabled' };
    }
    async create(data, publicOrigin) {
        if (await this.links.count() >= CONFIG.maxLinks) fail(400, 'TooManyLinks');
        const now = Date.now();
        const { expiresInDays, ...content } = data;
        const link = { ...content, id: crypto.randomUUID(), token: randomToken(), createdAt: now, expiresAt: now + expiresInDays * 86400000 };
        await this.links.create(link);
        return this.present({ ...link, isActive: 1, visitCount: 0 }, publicOrigin);
    }
    async list(query, publicOrigin) {
        const page = await this.links.list(query, Date.now());
        return { ...page, items: page.items.map(link => this.present(link, publicOrigin)) };
    }
    async update(id, data, publicOrigin) {
        if (!await this.links.findById(id)) fail(404, 'NotFound');
        await this.links.update(id, data);
        return this.present(await this.links.findById(id), publicOrigin);
    }
    async remove(id) {
        if (!await this.links.findById(id)) fail(404, 'NotFound');
        await this.links.remove(id);
    }
}
