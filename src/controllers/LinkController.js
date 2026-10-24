import { BaseController } from '../core/base/BaseController.js';
import { LinkService } from '../services/LinkService.js';
import { pageQuery, validateLink } from '../utils/validation.js';
import { parseJson } from '../utils/http.js';
import { visitPage } from '../views/visitPage.js';
import QRCode from 'qrcode/lib/core/qrcode.js';
import Svg from 'qrcode/lib/renderer/svg-tag.js';
import { SettingsService } from '../services/SettingsService.js';
export class LinkController extends BaseController {
    constructor(env) { super(); this.links = new LinkService(env); this.settings = new SettingsService(env); }
    async list(request, publicOrigin) { return this.ok(await this.links.list(pageQuery(new URL(request.url)), publicOrigin)); }
    async create(request, publicOrigin) { return this.ok(await this.links.create(validateLink(await parseJson(request, 49152), false, await this.settings.get()), publicOrigin), 201); }
    async details(id, publicOrigin) { return this.ok(await this.links.details(id, publicOrigin)); }
    async preview(request) {
        const link = validateLink(await parseJson(request, 49152), false, await this.settings.get());
        return this.ok({ html: await visitPage(link, {}, '', '', { preview: true, brand: (await this.settings.get()).brand }).text() });
    }
    async qr(id, publicOrigin) {
        const link = await this.links.details(id, publicOrigin);
        const svg = Svg.render(QRCode.create(link.url, { errorCorrectionLevel: 'M' }), { margin: 4, width: 320 });
        return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Content-Disposition': 'attachment; filename="link-qr.svg"' } });
    }
    async update(request, id, publicOrigin) { return this.ok(await this.links.update(id, validateLink(await this.body(request), true), publicOrigin)); }
    async remove(id) { await this.links.remove(id); return this.ok({ deleted: true }); }
}
