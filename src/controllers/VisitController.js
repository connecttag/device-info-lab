import { BaseController } from '../core/base/BaseController.js';
import { VisitService } from '../services/VisitService.js';
import { TrainingService } from '../services/TrainingService.js';
import { pageQuery } from '../utils/validation.js';
import { CONFIG } from '../config/constants.js';
export class VisitController extends BaseController {
    constructor(env) { super(); this.env = env; this.visits = new VisitService(env); }
    open(request, token) { return this.visits.open(request, token); }
    async enrich(request) { await this.visits.enrich(await this.body(request)); return this.ok({ saved: true }); }
    async training(request) { await new TrainingService(this.env).submit(request, await this.body(request)); return this.ok({ saved: true }); }
    async list(request) { return this.ok(await this.visits.list(pageQuery(new URL(request.url)))); }
    async details(id) { return this.ok(await this.visits.details(id)); }
    async stats(request) { return this.ok(await this.visits.stats(pageQuery(new URL(request.url)))); }
    async export(request) {
        const result = await this.visits.list(pageQuery(new URL(request.url), true));
        return this.ok({ ...result, truncated: result.total > CONFIG.maxExport, generatedAt: new Date().toISOString() }, 200, { 'Content-Disposition': 'attachment; filename="device-info-visits.json"' });
    }
}
