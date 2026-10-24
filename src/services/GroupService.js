import { GroupRepository } from '../repositories/GroupRepository.js';
import { fail } from '../utils/http.js';
export class GroupService {
    constructor(env) { this.groups = new GroupRepository(env.DB); }
    list() { return this.groups.list(); }
    async require(id) { if (id && !await this.groups.find(id)) fail(400, 'InvalidGroup'); }
    async create(name) {
        const group = await this.groups.create(crypto.randomUUID(), name, Date.now());
        if (!group) fail(409, 'GroupConflict');
        return group;
    }
    async rename(id, name) {
        if (!await this.groups.find(id)) fail(404, 'NotFound');
        const group = await this.groups.rename(id, name);
        if (!group) fail(409, 'GroupConflict');
        return group;
    }
    async remove(id) { if (!await this.groups.find(id)) fail(404, 'NotFound'); await this.groups.remove(id); }
}
