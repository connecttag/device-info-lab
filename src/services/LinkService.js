import { BaseService } from '../core/base/BaseService.js';
import { LinkRepository } from '../repositories/LinkRepository.js';
import { randomToken } from '../utils/crypto.js';
import { fail } from '../utils/http.js';
import { CONFIG } from '../config/constants.js';
import { GroupService } from './GroupService.js';

export class LinkService extends BaseService {
    constructor(env) { super(env); this.links = new LinkRepository(env.DB); }
    present(link, publicOrigin) {
        return { ...link, isActive: Boolean(link.isActive), url: `${publicOrigin}/v/${link.token}`, status: link.expiresAt <= Date.now() ? 'expired' : !link.isActive ? 'disabled' : link.maxUses !== null && link.useCount >= link.maxUses ? 'exhausted' : 'active' };
    }
    async create(data, publicOrigin) {
        if (await this.links.count() >= CONFIG.maxLinks) fail(400, 'TooManyLinks');
        await new GroupService(this.env).require(data.groupId);
        const now = Date.now();
        const { expiresInHours, ...content } = data;
        const link = { ...content, id: crypto.randomUUID(), token: randomToken(), createdAt: now, expiresAt: now + expiresInHours * 3600000 };
        await this.links.create(link);
        return this.present({ ...link, isActive: 1, visitCount: 0, useCount: 0 }, publicOrigin);
    }
    async list(query, publicOrigin) {
        const page = await this.links.list(query, Date.now());
        return { ...page, items: page.items.map(({ logoData, ...link }) => this.present({ ...link, hasLogo: Boolean(logoData) }, publicOrigin)) };
    }
    async details(id, publicOrigin) {
        const link = await this.links.findById(id);
        if (!link) fail(404, 'NotFound');
        return this.present(link, publicOrigin);
    }
    async update(id, data, publicOrigin) {
        if (!await this.links.findById(id)) fail(404, 'NotFound');
        if ('groupId' in data) await new GroupService(this.env).require(data.groupId);
        await this.links.update(id, data);
        return this.present(await this.links.findById(id), publicOrigin);
    }
    async remove(id) {
        if (!await this.links.findById(id)) fail(404, 'NotFound');
        await this.links.remove(id);
    }
}
