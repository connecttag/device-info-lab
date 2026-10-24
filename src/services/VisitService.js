import { BaseService } from '../core/base/BaseService.js';
import { LinkRepository } from '../repositories/LinkRepository.js';
import { VisitRepository } from '../repositories/VisitRepository.js';
import { RateLimitService } from './RateLimitService.js';
import { CONFIG } from '../config/constants.js';
import { collectEdgeMetadata, shouldSkipVisit } from '../utils/metadata.js';
import { signCapability, verifyCapability } from '../utils/crypto.js';
import { parseBrowser, onlyKeys } from '../utils/validation.js';
import { fail } from '../utils/http.js';
import { visitPage, unavailablePage } from '../views/visitPage.js';

export class VisitService extends BaseService {
    constructor(env) { super(env); this.links = new LinkRepository(env.DB); this.visits = new VisitRepository(env.DB); }
    async open(request, token) {
        if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return unavailablePage(404);
        const link = await this.links.findByToken(token), now = Date.now();
        if (!link) return unavailablePage(404);
        if (!link.isActive || link.expiresAt <= now) return unavailablePage();
        if (shouldSkipVisit(request)) return new Response(null, { status: 204 });
        await new RateLimitService(this.env).check(request, 'visit', CONFIG.visitLimit, CONFIG.visitWindowMs);
        const edge = collectEdgeMetadata(request);
        // Known previews are deliberately excluded, even when they do not send Purpose.
        if (edge.isBot) return visitPage(link, edge, '', '');
        const visitId = crypto.randomUUID();
        if (!await this.visits.record({ id: visitId, linkId: link.id, now, retainUntil: now + CONFIG.retentionMs, edge })) return unavailablePage();
        const payload = { visitId, linkId: link.id, expiresAt: Math.min(now + CONFIG.capabilityMs, link.expiresAt) };
        const capability = await signCapability(this.env.TOKEN_SECRET, payload);
        const trainingCapability = link.template === 'training' ? await signCapability(this.env.TOKEN_SECRET, payload, 'training') : '';
        return visitPage(link, edge, capability, trainingCapability);
    }
    async enrich(body) {
        onlyKeys(body, ['capability', 'browser']);
        const payload = await verifyCapability(this.env.TOKEN_SECRET, body.capability);
        const browser = parseBrowser(body.browser);
        if (!await this.visits.enrich(payload.visitId, payload.linkId, browser, Date.now())) fail(409, 'AlreadySubmitted');
    }
    list(query) { return this.visits.list(query, Date.now()); }
    async details(id) {
        const row = await this.visits.findById(id, Date.now());
        if (!row) fail(404, 'NotFound');
        return row;
    }
    stats() { return this.visits.stats(Date.now()); }
}
