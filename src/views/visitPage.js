import { S } from '../../public/strings.js';
import { CONFIG } from '../config/constants.js';
import { escapeHtml as e } from '../utils/http.js';

function shell(content, { capability = '', trainingCapability = '', template = 'welcome', title = S.brand } = {}) {
    return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${e(title)} | ${e(S.brand)}</title><link rel="stylesheet" href="/visit.css"><script type="module" src="/visit.js"></script></head><body><main class="visitor-page template-${e(template)}" data-capability="${e(capability)}" data-training-capability="${e(trainingCapability)}"><header class="brand">${e(S.brand)}</header>${content}<footer>${e(S.visitorFooter)}</footer></main></body></html>`;
}
function details(edge) {
    return `<section class="device-data"><h2>${e(S.edgeSource)}</h2><dl>${Object.entries(edge).filter(([key]) => key in S.fields).map(([key, value]) => `<div><dt>${e(S.fields[key])}</dt><dd dir="auto">${e(value === null ? S.unavailable : typeof value === 'boolean' ? (value ? S.yes : S.no) : typeof value === 'object' ? JSON.stringify(value, null, 2) : value)}</dd></div>`).join('')}</dl><h2>${e(S.browserSource)}</h2><dl id="browser-info"></dl><p class="small">${e(S.detailNote)}</p></section>`;
}
function trainingForm() {
    return `<section class="training-box"><p>${e(S.trainingHelp)}</p><aside class="demo-account"><strong>${e(S.demoAccount)}</strong><code id="demo-user">${e(CONFIG.demoUsername)}</code><code id="demo-pass">${e(CONFIG.demoPassword)}</code></aside><form id="training-form" method="post" action="/api/training/submit" autocomplete="off"><label>${e(S.username)}<input name="username" type="text" required maxlength="60" autocomplete="off" autocapitalize="off" spellcheck="false" dir="ltr" disabled></label><label>${e(S.password)}<input name="password" type="text" required maxlength="60" autocomplete="off" autocapitalize="off" spellcheck="false" dir="ltr" disabled></label><button type="submit" disabled>${e(S.submitDemo)}</button></form><p id="training-status" role="status" aria-live="polite"></p></section>`;
}
export function visitPage(link, edge, capability, trainingCapability) {
    const template = link.template;
    const defaults = {
        welcome: [S.visitTitle, S.visitMessage], deviceInfo: [S.deviceInfoTitle, S.deviceInfoMessage],
        promotional: [link.companyName || S.promoTitle, S.promoMessage], notFound: [S.notFoundTitle, S.notFoundMessage],
        training: [S.trainingTitle, S.noVisitorPanel], custom: [S.visitTitle, S.visitMessage]
    };
    const [heading, message] = defaults[template] ?? defaults.welcome;
    const title = link.pageTitle || heading;
    const content = `<h1>${e(title)}</h1><p class="lead">${e(link.pageMessage || message)}</p>${template === 'deviceInfo' ? details(edge) : ''}${template === 'training' ? trainingForm() : ''}${template === 'promotional' && link.companyWebsite ? `<a class="cta" href="${e(link.companyWebsite)}" rel="noopener noreferrer">${e(S.visitCompany)}</a>` : ''}`;
    return new Response(shell(content, { capability, trainingCapability, template, title }), { status: template === 'notFound' ? 404 : 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
export function unavailablePage(status = 410) {
    return new Response(shell(`<h1>${e(S.unavailableLinkTitle)}</h1><p class="lead">${e(S.unavailableLinkMessage)}</p>`), { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
export function landingPage() {
    return new Response(shell(`<h1>${e(S.visitTitle)}</h1><p class="lead">${e(S.visitMessage)}</p>`), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
