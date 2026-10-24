import { S } from './strings.js';

export function el(tag, className = '', text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}
export function date(value) { return value ? new Intl.DateTimeFormat('ar', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : S.unavailable; }
export function number(value) { return new Intl.NumberFormat('ar').format(value); }
export function button(text, action, className = 'small-button') {
    const element = el('button', className, text);
    element.type = 'button';
    const iconName = ['copy', 'enable', 'disable', 'remove', 'details'].find(key => S[key] === text);
    if (iconName) decorate(element, iconName);
    element.addEventListener('click', action);
    return element;
}
export function decorate(element, iconName) {
    const icon = el('span', 'ui-icon', S.icons[iconName]);
    icon.setAttribute('aria-hidden', 'true'); element.prepend(icon);
}
export function empty(text, kind = 'emptyLinks') {
    const wrap = el('div', 'empty-state'), icon = el('span', 'empty-icon', S.icons[kind]);
    icon.setAttribute('aria-hidden', 'true');
    wrap.append(icon, el('strong', '', S[`${kind}Title`]), el('p', 'muted', text));
    return wrap;
}
function td(text = '', className = '') { return el('td', className, text ?? S.unavailable); }
function table(headers) {
    const wrap = el('div', 'table-wrap'), table = el('table'), head = el('thead'), tr = el('tr'), body = el('tbody');
    for (const label of headers) tr.append(el('th', '', label));
    head.append(tr); table.append(head, body); wrap.append(table);
    return { wrap, body };
}
export function linkTable(items, handlers) {
    if (!items.length) return empty(S.emptyLinks, 'emptyLinks');
    const { wrap, body } = table([S.title, S.link, S.visits, S.expiresAt, S.status, S.actions]);
    for (const item of items) {
        const row = el('tr'), name = td(item.title), urlCell = td(), statusCell = td(), actions = td();
        name.append(el('small', 'subtle', S[item.template]));
        const link = el('a', 'link-url', item.url); link.href = item.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.dir = 'ltr'; urlCell.append(link);
        statusCell.append(el('span', `status ${item.status}`, S[item.status]));
        const controls = el('div', 'row-actions');
        controls.append(button(S.copy, () => handlers.copy(item.url)), button(item.isActive ? S.disable : S.enable, () => handlers.toggle(item)), button(S.remove, () => handlers.remove(item), 'small-button danger-text'));
        actions.append(controls);
        row.append(name, urlCell, td(number(item.visitCount ?? 0)), td(date(item.expiresAt), 'nowrap'), statusCell, actions); body.append(row);
    }
    return wrap;
}
export function visitTable(items, open) {
    if (!items.length) return empty(S.emptyVisits, 'emptyVisits');
    const { wrap, body } = table([S.time, S.linkTitle, S.country, S.browser, S.os, S.ip, S.details]);
    for (const item of items) {
        const row = el('tr'), name = td(item.linkTitle), detail = td(), ip = td(item.ip, 'mono');
        if (item.training) name.append(el('small', 'training-note', S.trainingSubmitted));
        detail.append(button(S.details, () => open(item.id)));
        ip.dir = 'ltr';
        row.append(td(date(item.createdAt), 'nowrap'), name, td(item.country), td(item.browserName), td(item.osName), ip, detail); body.append(row);
    }
    return wrap;
}
export function pagination(target, data, change) {
    const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
    const previous = button(S.previous, () => change(data.page - 1), 'secondary'), next = button(S.next, () => change(data.page + 1), 'secondary');
    previous.disabled = data.page <= 1; next.disabled = data.page >= pages;
    target.replaceChildren(el('span', 'caption', `${S.page} ${number(data.page)} / ${number(pages)} · ${S.total}: ${number(data.total)}`), previous, next);
}
export function detailSection(title, data) {
    const section = el('section', 'detail-section'); section.append(el('h3', '', title));
    if (!data) { section.append(el('p', 'muted', S.notYet)); return section; }
    const dl = el('dl', 'detail-list');
    for (const [key, value] of Object.entries(data)) {
        const pair = el('div'), label = el('dt', '', S.fields[key] ?? key);
        const display = value === null ? S.unavailable : typeof value === 'boolean' ? (value ? S.yes : S.no) : key === 'submittedAt' ? date(value) : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
        const dd = el('dd', '', display); dd.dir = 'auto'; pair.append(label, dd); dl.append(pair);
    }
    section.append(dl); return section;
}
