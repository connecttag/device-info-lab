import { BaseController } from '../core/base/BaseController.js';
import { GroupService } from '../services/GroupService.js';
import { validateGroup } from '../utils/validation.js';
export class GroupController extends BaseController {
    constructor(env) { super(); this.groups = new GroupService(env); }
    async list() { return this.ok(await this.groups.list()); }
    async create(req) { return this.ok(await this.groups.create(validateGroup(await this.body(req))), 201); }
    async rename(req, id) { return this.ok(await this.groups.rename(id, validateGroup(await this.body(req)))); }
    async remove(id) { await this.groups.remove(id); return this.ok({ deleted: true }); }
    async purge(id) { await this.groups.purge(id); return this.ok({ deleted: true }); }
}
