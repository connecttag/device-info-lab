import { BaseController } from '../core/base/BaseController.js';
import { LinkService } from '../services/LinkService.js';
import { pageQuery, validateLink } from '../utils/validation.js';
export class LinkController extends BaseController {
    constructor(env) { super(); this.links = new LinkService(env); }
    async list(request, publicOrigin) { return this.ok(await this.links.list(pageQuery(new URL(request.url)), publicOrigin)); }
    async create(request, publicOrigin) { return this.ok(await this.links.create(validateLink(await this.body(request)), publicOrigin), 201); }
    async update(request, id, publicOrigin) { return this.ok(await this.links.update(id, validateLink(await this.body(request), true), publicOrigin)); }
    async remove(id) { await this.links.remove(id); return this.ok({ deleted: true }); }
}
