import { S } from './strings.js';
import { el, number, createIcon } from './ui.js';
export function renderAnalytics(data) {
    document.querySelector('#stats').replaceChildren(...['totalLinks', 'totalVisits', 'todayVisits', 'trainingSubmissions'].map(key => {
        const block = el('div', `stat stat-${key}`), copy = el('div', 'stat-copy'), icon = el('span', 'stat-icon'); icon.append(createIcon(key));
        icon.setAttribute('aria-hidden', 'true');
        copy.append(el('span', 'stat-label', key === 'todayVisits' ? S.todayLabel : S[key]), el('strong', '', number(data[key])), el('small', 'stat-hint', S.statsHints[key]));
        block.append(copy, icon); return block;
    }));
    document.querySelector('#analytics-panels').replaceChildren(...Object.entries({ template: 'byTemplate', browser: 'byBrowser', os: 'byOs', country: 'byCountry' }).map(([key, heading]) => {
        const panel = el('section', 'panel distribution'); panel.append(el('h2', '', S[heading]));
        const items = data.distributions[key];
        if (!items.length) panel.append(el('p', 'caption', S.noStats));
        const list = el('div', 'distribution-list');
        for (const item of items) {
            const row = el('div', 'distribution-row'), label = el('span', '', key === 'template' ? S[item.label] : item.label === 'unknown' ? S.unknown : item.label);
            const meter = el('meter'); meter.min = 0; meter.max = data.totalVisits || 1; meter.value = item.count; meter.setAttribute('aria-label', label.textContent);
            row.append(label, el('strong', '', number(item.count)), meter); list.append(row);
        }
        panel.append(list); return panel;
    }));
    for (const key of ['browser', 'os', 'country']) {
        const list = document.querySelector(`#${key}-options`);
        // Keep previously seen values available while the user narrows a filter.
        const labels = new Set([...Array.from(list.options, option => option.value), ...data.distributions[key].map(item => item.label)]);
        list.replaceChildren(...Array.from(labels).sort().map(label => Object.assign(el('option'), { value: label })));
    }
}
