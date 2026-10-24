import { S } from './strings.js';
import { api } from './api.js';
import { decorate, configureDates } from './ui.js';
export function applyBranding(settings) {
    document.title = settings.brand; document.documentElement.dataset.theme = settings.theme || 'system';
    document.querySelectorAll('.brand').forEach(node => { node.textContent = settings.brand; decorate(node, 'brand'); });
}
export function initSettings({ onChanged, onLogout, onError }) {
    const $ = selector => document.querySelector(selector); let settings;
    function apply(data) {
        settings = data; applyBranding(data); configureDates(data.timezone);
        $('#filter-context').textContent = `${S.dateHelp} (${data.timezone})`;
        document.querySelector('.footnote').textContent = `${S.retentionPrefix} ${data.retentionDays}. ${S.retentionNote.split('. ').slice(1).join('. ')}`;
    }
    async function refresh() { apply(await api('/api/settings')); return settings; }
    $('#settings-open').addEventListener('click', async () => {
        try { await refresh(); for (const [name, value] of Object.entries(settings)) $('#settings-form').elements.namedItem(name).value = value ?? ''; $('#settings-error').textContent = ''; $('#security-error').textContent = ''; $('#rotate-form').reset(); $('#settings-dialog').showModal(); }
        catch (error) { onError(error); }
    });
    $('#settings-form').addEventListener('submit', async event => {
        event.preventDefault(); const form = event.currentTarget, submit = form.querySelector('button'); submit.disabled = true;
        const body = Object.fromEntries(new FormData(form));
        body.defaultExpiryHours = Number(body.defaultExpiryHours); body.retentionDays = Number(body.retentionDays); body.defaultMaxUses = body.defaultMaxUses ? Number(body.defaultMaxUses) : null;
        try { apply(await api('/api/settings', { method: 'PATCH', body })); $('#settings-dialog').close(); await onChanged(); }
        catch (error) { $('#settings-error').textContent = error.message; if (error.status === 401) onError(error); }
        finally { submit.disabled = false; }
    });
    $('#rotate-form').addEventListener('submit', async event => {
        event.preventDefault(); const form = event.currentTarget, submit = form.querySelector('button'); submit.disabled = true;
        try { await api('/api/auth/rotate-key', { method: 'POST', body: Object.fromEntries(new FormData(form)) }); form.reset(); onLogout(S.keyChanged); }
        catch (error) { $('#security-error').textContent = error.message; }
        finally { submit.disabled = false; }
    });
    $('#revoke-sessions').addEventListener('click', async event => {
        event.currentTarget.disabled = true;
        try { await api('/api/auth/revoke-sessions', { method: 'POST' }); onLogout(S.sessionsRevoked); }
        catch (error) { onError(error); }
        finally { $('#revoke-sessions').disabled = false; }
    });
    return { refresh, get: () => settings };
}
