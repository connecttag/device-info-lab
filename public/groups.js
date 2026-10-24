import { S } from './strings.js';
import { api } from './api.js';
import { el, button, number } from './ui.js';
export function initGroups({ onChanged, onError }) {
    const $ = selector => document.querySelector(selector); let groups = [], action;
    function render() {
        document.querySelectorAll('[data-group-select]').forEach(select => {
            const value = select.value;
            select.replaceChildren(Object.assign(el('option', '', select.dataset.groupMode === 'all' ? S.allGroups : S.noGroup), { value: '' }), ...groups.map(group => Object.assign(el('option', '', group.name), { value: group.id })));
            select.value = groups.some(group => group.id === value) ? value : '';
            if (!select.closest('label')) select.setAttribute('aria-label', S.group);
        });
        $('#groups-list').replaceChildren(...groups.map(group => {
            const row = el('div', 'group-row'), copy = el('div'); copy.append(el('strong', '', group.name), el('small', 'subtle', `${S.links}: ${number(group.linkCount)}`));
            const actions = el('div', 'row-actions');
            actions.append(button(S.rename, () => openAction('rename', group)), button(S.purgeGroup, () => openAction('purge', group)), button(S.remove, () => openAction('remove', group), 'small-button danger-text')); row.append(copy, actions); return row;
        }));
    }
    async function refresh() { groups = await api('/api/groups'); render(); return groups; }
    function openAction(mode, item) {
        action = { mode, item }; $('#group-action-error').textContent = '';
        $('#group-action-title').textContent = { rename: S.rename, remove: S.remove, purge: S.purgeGroup, move: S.moveGroup }[mode];
        $('#group-action-help').textContent = mode === 'purge' ? S.purgeHelp : mode === 'remove' ? S.groupHelp : item.name || item.title;
        $('#group-name-field').hidden = mode !== 'rename'; $('#group-move-field').hidden = mode !== 'move';
        $('#group-action-form').elements.name.required = mode === 'rename'; $('#group-action-form').elements.name.value = item.name || '';
        $('#group-action-form').elements.groupId.value = item.groupId || '';
        $('#group-action-dialog').showModal();
    }
    $('#groups-open').addEventListener('click', async () => {
        try { await refresh(); $('#groups-error').textContent = ''; $('#groups-dialog').showModal(); } catch (error) { onError(error); }
    });
    $('#group-form').addEventListener('submit', async event => {
        event.preventDefault(); const form = event.currentTarget, submit = form.querySelector('button'); submit.disabled = true;
        try { await api('/api/groups', { method: 'POST', body: { name: form.elements.name.value } }); form.reset(); await refresh(); await onChanged(); }
        catch (error) { $('#groups-error').textContent = error.message; if (error.status === 401) onError(error); }
        finally { submit.disabled = false; }
    });
    $('#group-action-form').addEventListener('submit', async event => {
        event.preventDefault(); const form = event.currentTarget, submit = form.querySelector('.primary'); submit.disabled = true;
        const { mode, item } = action;
        try {
            if (mode === 'move') await api(`/api/links/${item.id}`, { method: 'PATCH', body: { groupId: form.elements.groupId.value || null } });
            else await api(`/api/groups/${item.id}${mode === 'purge' ? '/visits' : ''}`, { method: mode === 'rename' ? 'PATCH' : 'DELETE', ...(mode === 'rename' ? { body: { name: form.elements.name.value } } : {}) });
            $('#group-action-dialog').close(); await refresh(); await onChanged();
        } catch (error) { $('#group-action-error').textContent = error.message; if (error.status === 401) onError(error); }
        finally { submit.disabled = false; }
    });
    return { refresh, move: link => openAction('move', link), has: id => !id || groups.some(group => group.id === id) };
}
