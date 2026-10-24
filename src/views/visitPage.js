import { iconMarkup } from '../../public/icons.js';
import { S } from '../../public/strings.js';
import { CONFIG } from '../config/constants.js';
import { escapeHtml as e } from '../utils/http.js';

function shell(content, { capability = '', trainingCapability = '', template = 'welcome', title = null, preview = false, theme = '', logo = '', brand = S.brand } = {}) {
    return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${e(title || brand)} | ${e(brand)}</title><link rel="stylesheet" href="/fonts.css"><link rel="stylesheet" href="/visit.css">${theme}${preview ? '' : '<script type="module" src="/visit.js"></script>'}</head><body><main class="visitor-page template-${e(template)}" data-capability="${e(capability)}" data-training-capability="${e(trainingCapability)}"><header class="brand"><span aria-hidden="true">${iconMarkup('brand')}</span>${e(brand)}</header>${logo || `<div class="visit-symbol" aria-hidden="true">${iconMarkup(template)}</div>`}${content}<footer>${e(S.visitorFooter)}</footer></main></body></html>`;
}
function details(edge) {
    return `<section class="device-data"><h2>${e(S.edgeSource)}</h2><dl>${Object.entries(edge).filter(([key]) => key in S.fields).map(([key, value]) => `<div><dt>${e(S.fields[key])}</dt><dd dir="auto">${e(value === null ? S.unavailable : typeof value === 'boolean' ? (value ? S.yes : S.no) : typeof value === 'object' ? JSON.stringify(value, null, 2) : value)}</dd></div>`).join('')}</dl><h2>${e(S.browserSource)}</h2><dl id="browser-info"></dl><p class="small">${e(S.detailNote)}</p></section>`;
}
function trainingForm() {
    return `<section class="training-box"><p>${e(S.trainingHelp)}</p><aside class="demo-account"><strong>${e(S.demoAccount)}</strong><code id="demo-user">${e(CONFIG.demoUsername)}</code><code id="demo-pass">${e(CONFIG.demoPassword)}</code></aside><form id="training-form" method="post" action="/api/training/submit" autocomplete="off"><label>${e(S.username)}<input name="username" type="text" required maxlength="60" autocomplete="off" autocapitalize="off" spellcheck="false" dir="ltr" disabled></label><label>${e(S.password)}<input name="password" type="text" required maxlength="60" autocomplete="off" autocapitalize="off" spellcheck="false" dir="ltr" disabled></label><button type="submit" disabled>${e(S.submitDemo)}</button></form><p id="training-status" role="status" aria-live="polite"></p></section>`;
}
export function visitPage(link, edge, capability, trainingCapability, { preview = false, brand = S.brand } = {}) {
    const template = link.template;
    const defaults = {
        welcome: [S.visitTitle, S.visitMessage], deviceInfo: [S.deviceInfoTitle, S.deviceInfoMessage],
        promotional: [link.companyName || S.promoTitle, S.promoMessage], notFound: [S.notFoundTitle, S.notFoundMessage],
        training: [S.trainingTitle, S.noVisitorPanel], custom: [S.visitTitle, S.visitMessage]
    };
    const [heading, message] = defaults[template] ?? defaults.welcome;
    const title = link.pageTitle || heading;
    const content = `<h1>${e(title)}</h1><p class="lead">${e(link.pageMessage || message)}</p>${template === 'deviceInfo' ? details(edge) : ''}${template === 'training' ? trainingForm() : ''}${template === 'promotional' && link.companyWebsite ? `<a class="cta" href="${e(link.companyWebsite)}" rel="noopener noreferrer">${e(S.visitCompany)}</a>` : ''}`;
    const theme = template === 'promotional' ? `<link rel="stylesheet" href="/theme.css?${e(new URLSearchParams({ accent: link.accentColor || '#6956d8', background: link.backgroundColor || '#f5f6fa' }))}">` : '';
    const logo = template === 'promotional' && link.logoData ? `<img class="company-logo" src="${e(link.logoData)}" alt="${e(link.companyName || title)}" width="96" height="96">` : '';
    const safeContent = preview ? content.replace(/<a class="cta"[^>]*>(.*?)<\/a>/g, '<span class="cta">$1</span>') : content;
    return new Response(shell(safeContent, { capability, trainingCapability, template, title, preview, theme, logo, brand }), { status: template === 'notFound' ? 404 : 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
export function unavailablePage(status = 410, brand = S.brand) {
    return new Response(shell(`<h1>${e(S.unavailableLinkTitle)}</h1><p class="lead">${e(S.unavailableLinkMessage)}</p>`, { brand }), { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
export function landingPage(brand = S.brand) {
    return new Response(shell(`<h1>${e(S.visitTitle)}</h1><p class="lead">${e(S.visitMessage)}</p>`, { brand }), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
