import { BaseController } from '../core/base/BaseController.js';
import { SettingsService } from '../services/SettingsService.js';
export class SettingsController extends BaseController {
    constructor(env) { super(); this.settings = new SettingsService(env); }
    async get() { return this.ok(await this.settings.get()); }
    async update(req) { return this.ok(await this.settings.update(await this.body(req))); }
}
