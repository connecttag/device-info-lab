import { S } from './strings.js';
import { api, query } from './api.js';
import { el, button, decorate, linkTable, visitTable, pagination, detailSection } from './ui.js';
import { renderAnalytics } from './analytics.js';
import { initEditor } from './link-editor.js';
import { initGroups } from './groups.js';
import { initSettings, applyBranding } from './settings.js';
import { latestLoader } from './latest.js';

const $ = selector => document.querySelector(selector);
document.title = S.brand;
$('#navigation').setAttribute('aria-label', S.navigation);
$('#visit-link-filter').setAttribute('aria-label', S.link);
document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = S[node.dataset.i18n]; });
document.querySelectorAll('.brand').forEach(node => decorate(node, 'brand'));
document.querySelectorAll('.sidebar [data-nav]').forEach(node => decorate(node, node.dataset.nav));
document.querySelectorAll('.create-link').forEach(node => decorate(node, 'create'));
for (const id of ['logout', 'export', 'settings-open']) decorate($(`#${id}`), id === 'settings-open' ? 'settings' : id);
decorate($('#login-form button'), 'login'); decorate($('#groups-open'), 'group');
document.querySelectorAll('[data-placeholder]').forEach(node => { node.placeholder = S[node.dataset.placeholder]; if (!node.closest('label')) node.setAttribute('aria-label', node.placeholder); });
for (const select of document.querySelectorAll('[data-template-select]')) {
    if (select.dataset.all) select.append(Object.assign(el('option', '', S.allTemplates), { value: '' }));
    for (const template of ['deviceInfo', 'welcome', 'promotional', 'notFound', 'training', 'custom']) select.append(Object.assign(el('option', '', S[template]), { value: template }));
}
const state = { view: 'overview', linksPage: 1, visitsPage: 1, linkQ: '', linkGroup: '', filters: {}, load: 0, deleteId: null };
let toastTimeout;
function toast(text, error = false) {
    clearTimeout(toastTimeout); $('#toast').textContent = text; $('#toast').classList.toggle('error-toast', error); $('#toast').hidden = false;
    toastTimeout = setTimeout(() => { $('#toast').hidden = true; }, 5000);
}
function showLogin() {
    state.load++; $('#app-view').hidden = true; $('#login-view').hidden = false; $('#boot-status').hidden = true;
    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close()); $('#login-form').elements.adminKey.focus();
}
function onError(error) { if (error.status === 401) { showLogin(); toast(S.sessionExpired, true); } else toast(error.message || S.genericError, true); }
const settings = initSettings({ onChanged: async () => { toast(S.saved); await loadView(); }, onLogout: message => { showLogin(); toast(message); }, onError });
const groups = initGroups({ onChanged: async () => {
    if (!groups.has(state.filters.groupId)) state.filters.groupId = '';
    if (!groups.has(state.linkGroup)) state.linkGroup = '';
    state.linksPage = state.visitsPage = 1; toast(S.saved); await loadView();
}, onError });
const editor = initEditor({ getSettings: settings.get, onSaved: async link => { state.linksPage = 1; toast(S.saved); await loadView(); showLink(link); }, onError });
function showLink(link, withQr = false) {
    const content = el('div', 'new-link'), value = el('input'); value.value = link.url; value.readOnly = true; value.dir = 'ltr'; value.setAttribute('aria-label', S.link); value.addEventListener('focus', () => value.select());
    content.append(value, button(S.copy, () => handlers.copy(link.url)));
    if (withQr) {
        const image = el('img', 'qr-image'); image.src = `/api/links/${link.id}/qr`; image.alt = S.qr; image.width = image.height = 320;
        const download = el('a', 'secondary download-link', S.downloadQr); download.href = image.src; download.download = 'link-qr.svg';
        content.append(image, el('p', 'caption', S.qrHelp), download);
    } else content.append(button(S.qr, () => showLink(link, true)));
    $('#detail-title').textContent = withQr ? S.qr : S.newLink; $('#detail-content').replaceChildren(content); if (!$('#details-dialog').open) $('#details-dialog').showModal();
}
const handlers = {
    async copy(url) { try { await navigator.clipboard.writeText(url); toast(S.copied); } catch { toast(S.noClipboard, true); } },
    async toggle(link) { try { await api(`/api/links/${link.id}`, { method: 'PATCH', body: { isActive: !link.isActive } }); await loadView(); } catch (error) { onError(error); } },
    remove(link) { state.deleteId = link.id; $('#delete-dialog').showModal(); },
    qr: link => showLink(link, true), move: link => groups.move(link),
    async duplicate(link) { try { await groups.refresh(); editor.open(await api(`/api/links/${link.id}`)); } catch (error) { onError(error); } }
};
async function openDetails(id) {
    $('#detail-title').textContent = S.visitDetails; const target = $('#detail-content'); target.replaceChildren(el('p', 'muted', S.loading)); $('#details-dialog').showModal();
    try { const visit = await api(`/api/visits/${id}`); if ($('#details-dialog').open) target.replaceChildren(el('p', 'muted', visit.linkTitle), detailSection(S.edgeSource, visit.edge), detailSection(S.browserSource, visit.browser), detailSection(S.trainingSource, visit.training), el('p', 'caption', S.detailNote)); }
    catch (error) { target.replaceChildren(el('p', 'error', error.message)); if (error.status === 401) onError(error); }
}
function chooseView(view) {
    state.view = ['overview', 'links', 'visits'].includes(view) ? view : 'overview';
    for (const item of ['overview', 'links', 'visits']) $(`#${item}-view`).hidden = item !== state.view;
    $('#analytics-panels').hidden = state.view !== 'overview';
    document.querySelectorAll('.sidebar [data-nav]').forEach(node => { node.classList.toggle('selected', node.dataset.nav === state.view); if (node.dataset.nav === state.view) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current'); });
    $('#view-title').textContent = S[state.view]; loadView().catch(onError);
}
const populateLinks = latestLoader(async () => {
    const options = [Object.assign(el('option', '', S.all), { value: '' })]; let page = 1, data;
    do { data = await api(`/api/links?pageSize=100&page=${page++}`); for (const link of data.items) options.push(Object.assign(el('option', '', link.title), { value: link.id })); } while (options.length - 1 < data.total && data.items.length && page <= 10);
    return options;
}, options => {
    if (!options.some(option => option.value === state.filters.linkId)) state.filters.linkId = '';
    $('#visit-link-filter').replaceChildren(...options); $('#visit-link-filter').value = state.filters.linkId || '';
});
async function loadView() {
    const generation = ++state.load, view = state.view; $('#boot-status').hidden = false;
    try {
        await Promise.all([settings.refresh(), groups.refresh(), populateLinks()]);
        if (generation !== state.load) return;
        const data = await api(`/api/stats?${query(state.filters)}`);
        if (generation !== state.load) return; renderAnalytics(data);
        if (view === 'overview') {
            const [links, visits] = await Promise.all([api('/api/links?pageSize=5'), api(`/api/visits?${query({ ...state.filters, pageSize: 5 })}`)]);
            if (generation !== state.load) return;
            $('#recent-links').replaceChildren(linkTable(links.items, handlers)); $('#recent-visits').replaceChildren(visitTable(visits.items, openDetails));
        } else if (view === 'links') {
            const links = await api(`/api/links?${query({ page: state.linksPage, q: state.linkQ, groupId: state.linkGroup })}`);
            if (generation !== state.load) return;
            $('#links-table').replaceChildren(linkTable(links.items, handlers)); pagination($('#links-pagination'), links, page => { state.linksPage = page; loadView().catch(onError); });
        } else {
            const visits = await api(`/api/visits?${query({ ...state.filters, page: state.visitsPage })}`);
            if (generation !== state.load) return;
            $('#visits-table').replaceChildren(visitTable(visits.items, openDetails)); pagination($('#visits-pagination'), visits, page => { state.visitsPage = page; loadView().catch(onError); });
        }
    } finally { if (generation === state.load) $('#boot-status').hidden = true; }
}
async function enterApp() { $('#login-view').hidden = true; $('#app-view').hidden = false; chooseView(location.hash.slice(1)); }
$('#login-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget, submit = form.querySelector('button'); submit.disabled = true; $('#login-error').textContent = '';
    try { await api('/api/auth/login', { method: 'POST', body: { adminKey: form.elements.adminKey.value } }); form.reset(); await enterApp(); }
    catch (error) { $('#login-error').textContent = error.message; } finally { submit.disabled = false; }
});
$('#logout').addEventListener('click', async () => { try { await api('/api/auth/logout', { method: 'POST' }); showLogin(); } catch (error) { onError(error); } });
document.querySelectorAll('[data-nav]').forEach(node => node.addEventListener('click', () => { if (location.hash === `#${node.dataset.nav}`) chooseView(node.dataset.nav); else location.hash = node.dataset.nav; }));
addEventListener('hashchange', () => { if (!$('#app-view').hidden) chooseView(location.hash.slice(1)); });
document.querySelectorAll('.create-link').forEach(node => node.addEventListener('click', async () => { try { await groups.refresh(); editor.open(); } catch (error) { onError(error); } }));
document.querySelectorAll('.close-dialog').forEach(node => node.addEventListener('click', () => node.closest('dialog').close()));
$('#delete-form').addEventListener('submit', async event => {
    event.preventDefault(); const submit = event.currentTarget.querySelector('.danger'); submit.disabled = true;
    try { await api(`/api/links/${state.deleteId}`, { method: 'DELETE' }); $('#delete-dialog').close(); state.linksPage = state.visitsPage = 1; if (state.filters.linkId === state.deleteId) state.filters.linkId = ''; toast(S.deleted); await loadView(); }
    catch (error) { onError(error); } finally { submit.disabled = false; }
});
$('#link-filter').addEventListener('submit', event => { event.preventDefault(); state.linkQ = event.currentTarget.elements.q.value; state.linkGroup = event.currentTarget.elements.groupId.value; state.linksPage = 1; loadView().catch(onError); });
$('#analytics-filter').addEventListener('submit', event => {
    event.preventDefault(); const form = event.currentTarget;
    state.filters = Object.fromEntries(new FormData(form)); if (state.filters.country !== 'unknown') state.filters.country = state.filters.country.toUpperCase().trim(); state.visitsPage = 1; loadView().catch(onError);
});
$('#analytics-filter').addEventListener('reset', () => { state.filters = {}; state.visitsPage = 1; queueMicrotask(() => loadView().catch(onError)); });
$('#export').addEventListener('click', async () => {
    const control = $('#export'); control.disabled = true;
    try { const data = await api(`/api/export?${query(state.filters)}`); const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })), link = el('a'); link.href = url; link.download = 'device-info-visits.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    catch (error) { onError(error); } finally { control.disabled = false; }
});
try { applyBranding(await api('/api/branding')); await api('/api/auth/session'); await enterApp(); }
catch (error) { showLogin(); if (error.status !== 401) $('#login-error').textContent = error.message; }
