import { S } from './strings.js';
import { api, query } from './api.js';
import { el, button, number, linkTable, visitTable, pagination, detailSection } from './ui.js';

const $ = selector => document.querySelector(selector);
document.title = S.brand;
$('#navigation').setAttribute('aria-label', S.navigation);
$('#visit-link-filter').setAttribute('aria-label', S.link);
document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = S[node.dataset.i18n]; });
document.querySelectorAll('[data-placeholder]').forEach(node => { node.placeholder = S[node.dataset.placeholder]; if (!node.closest('label')) node.setAttribute('aria-label', node.placeholder); });
const templates = ['deviceInfo', 'welcome', 'promotional', 'notFound', 'training', 'custom'];
for (const template of templates) { const option = el('option', '', S[template]); option.value = template; $('#template-select').append(option); }

const state = { view: 'overview', linksPage: 1, visitsPage: 1, linkQ: '', visitQ: '', linkId: '', load: 0, deleteId: null };
let toastTimeout;
function toast(text, error = false) {
    clearTimeout(toastTimeout); const node = $('#toast'); node.textContent = text; node.classList.toggle('error-toast', error); node.hidden = false;
    toastTimeout = setTimeout(() => { node.hidden = true; }, 5000);
}
function showLogin() {
    $('#app-view').hidden = true; $('#login-view').hidden = false; $('#boot-status').hidden = true;
    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
    $('#login-form').elements.adminKey.focus();
}
function onError(error) {
    if (error.status === 401) { state.load++; showLogin(); toast(S.sessionExpired, true); }
    else toast(error.message || S.genericError, true);
}
const handlers = {
    async copy(url) { try { await navigator.clipboard.writeText(url); toast(S.copied); } catch { toast(S.noClipboard, true); } },
    async toggle(link) { try { await api(`/api/links/${link.id}`, { method: 'PATCH', body: { isActive: !link.isActive } }); await loadView(); } catch (error) { onError(error); } },
    remove(link) { state.deleteId = link.id; $('#delete-dialog').showModal(); }
};
async function openDetails(id) {
    $('#detail-title').textContent = S.visitDetails;
    const target = $('#detail-content'); target.replaceChildren(el('p', 'muted', S.loading)); $('#details-dialog').showModal();
    try {
        const visit = await api(`/api/visits/${id}`);
        target.replaceChildren(el('p', 'muted', visit.linkTitle), detailSection(S.edgeSource, visit.edge), detailSection(S.browserSource, visit.browser), detailSection(S.trainingSource, visit.training), el('p', 'caption', S.detailNote));
    } catch (error) { target.replaceChildren(el('p', 'error', error.message)); if (error.status === 401) onError(error); }
}
function chooseView(view) {
    state.view = ['overview', 'links', 'visits'].includes(view) ? view : 'overview';
    for (const item of ['overview', 'links', 'visits']) $(`#${item}-view`).hidden = item !== state.view;
    document.querySelectorAll('.sidebar [data-nav]').forEach(node => { node.classList.toggle('selected', node.dataset.nav === state.view); if (node.dataset.nav === state.view) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current'); });
    $('#view-title').textContent = S[state.view];
    loadView().catch(onError);
}
async function refreshStats() {
    const data = await api('/api/stats');
    $('#stats').replaceChildren(...['totalLinks', 'totalVisits', 'todayVisits'].map(key => {
        const block = el('div', 'stat'); block.append(el('span', '', S[key]), el('strong', '', number(data[key]))); return block;
    }));
}
async function loadView() {
    const generation = ++state.load, view = state.view;
    $('#boot-status').hidden = false;
    try {
        await refreshStats();
        if (view === 'overview') {
            const [links, visits] = await Promise.all([api('/api/links?pageSize=5'), api('/api/visits?pageSize=5')]);
            if (generation !== state.load) return;
            $('#recent-links').replaceChildren(linkTable(links.items, handlers)); $('#recent-visits').replaceChildren(visitTable(visits.items, openDetails));
        } else if (view === 'links') {
            const links = await api(`/api/links?${query({ page: state.linksPage, q: state.linkQ })}`);
            if (generation !== state.load) return;
            $('#links-table').replaceChildren(linkTable(links.items, handlers)); pagination($('#links-pagination'), links, page => { state.linksPage = page; loadView().catch(onError); });
        } else {
            const visits = await api(`/api/visits?${query({ page: state.visitsPage, q: state.visitQ, linkId: state.linkId })}`);
            if (generation !== state.load) return;
            $('#visits-table').replaceChildren(visitTable(visits.items, openDetails)); pagination($('#visits-pagination'), visits, page => { state.visitsPage = page; loadView().catch(onError); });
            await populateFilter();
        }
    } finally { if (generation === state.load) $('#boot-status').hidden = true; }
}
async function populateFilter() {
    const options = [Object.assign(el('option', '', S.all), { value: '' })];
    let page = 1, data;
    do {
        data = await api(`/api/links?pageSize=100&page=${page++}`);
        for (const link of data.items) options.push(Object.assign(el('option', '', link.title), { value: link.id }));
    } while (options.length - 1 < data.total && data.items.length && page <= 10);
    $('#visit-link-filter').replaceChildren(...options); $('#visit-link-filter').value = state.linkId;
}
async function enterApp() { $('#login-view').hidden = true; $('#app-view').hidden = false; chooseView(location.hash.slice(1)); }
$('#login-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget, submit = form.querySelector('button'); submit.disabled = true; $('#login-error').textContent = '';
    try { await api('/api/auth/login', { method: 'POST', body: { adminKey: form.elements.adminKey.value } }); form.reset(); await enterApp(); }
    catch (error) { $('#login-error').textContent = error.message; }
    finally { submit.disabled = false; }
});
$('#logout').addEventListener('click', async () => { try { await api('/api/auth/logout', { method: 'POST' }); state.load++; showLogin(); } catch (error) { onError(error); } });
document.querySelectorAll('[data-nav]').forEach(node => node.addEventListener('click', () => { if (location.hash === `#${node.dataset.nav}`) chooseView(node.dataset.nav); else location.hash = node.dataset.nav; }));
addEventListener('hashchange', () => { if (!$('#app-view').hidden) chooseView(location.hash.slice(1)); });
document.querySelectorAll('.create-link').forEach(node => node.addEventListener('click', () => { $('#create-error').textContent = ''; $('#create-dialog').showModal(); }));
document.querySelectorAll('.close-dialog').forEach(node => node.addEventListener('click', () => node.closest('dialog').close()));
$('#template-select').addEventListener('change', () => { $('#company-fields').hidden = $('#template-select').value !== 'promotional'; });
$('#create-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget, submit = form.querySelector('button[type="submit"], footer .primary'); submit.disabled = true; $('#create-error').textContent = '';
    const body = Object.fromEntries(new FormData(form)); body.expiresInDays = Number(body.expiresInDays);
    try {
        const link = await api('/api/links', { method: 'POST', body }); $('#create-dialog').close(); form.reset(); $('#company-fields').hidden = true; state.linksPage = 1;
        toast(S.saved); await loadView();
        // Keep the new URL available even when clipboard permission is absent.
        const notice = el('div', 'new-link'); notice.append(el('strong', '', S.saved));
        const value = el('input'); value.value = link.url; value.readOnly = true; value.dir = 'ltr'; value.addEventListener('focus', () => value.select());
        notice.append(value, button(S.copy, () => handlers.copy(link.url))); $('#detail-title').textContent = S.newLink; $('#detail-content').replaceChildren(notice); $('#details-dialog').showModal();
    } catch (error) { $('#create-error').textContent = error.message; if (error.status === 401) onError(error); }
    finally { submit.disabled = false; }
});
$('#delete-form').addEventListener('submit', async event => {
    event.preventDefault(); const submit = event.currentTarget.querySelector('.danger'); submit.disabled = true;
    try { await api(`/api/links/${state.deleteId}`, { method: 'DELETE' }); $('#delete-dialog').close(); state.linksPage = 1; state.visitsPage = 1; if (state.linkId === state.deleteId) state.linkId = ''; toast(S.deleted); await loadView(); }
    catch (error) { onError(error); } finally { submit.disabled = false; }
});
$('#link-filter').addEventListener('submit', event => { event.preventDefault(); state.linkQ = event.currentTarget.elements.q.value; state.linksPage = 1; loadView().catch(onError); });
$('#visit-filter').addEventListener('submit', event => { event.preventDefault(); const form = event.currentTarget; state.visitQ = form.elements.q.value; state.linkId = form.elements.linkId.value; state.visitsPage = 1; loadView().catch(onError); });
$('#export').addEventListener('click', async () => {
    const control = $('#export'); control.disabled = true;
    try {
        const data = await api(`/api/export?${query({ q: state.visitQ, linkId: state.linkId })}`);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), link = el('a');
        link.href = url; link.download = 'device-info-visits.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { onError(error); } finally { control.disabled = false; }
});
try { await api('/api/auth/session'); await enterApp(); }
catch (error) { showLogin(); if (error.status !== 401) $('#login-error').textContent = error.message; }
