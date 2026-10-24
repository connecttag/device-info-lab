import { readFileSync, writeFileSync } from 'node:fs';
const names = {
    brand: 'link', overview: 'chart-column', links: 'link', visits: 'users', create: 'plus', logout: 'log-out', copy: 'copy', enable: 'play', disable: 'pause', remove: 'trash-2', details: 'search', export: 'download', filter: 'sliders-horizontal', totalLinks: 'link', totalVisits: 'footprints', todayVisits: 'calendar-days', trainingSubmissions: 'flask-conical', emptyLinks: 'link', emptyVisits: 'scan-eye', login: 'key-round', qr: 'qr-code', duplicate: 'files', group: 'folder', settings: 'settings', welcome: 'hand', deviceInfo: 'monitor-smartphone', promotional: 'building-2', notFound: 'file-question-mark', training: 'flask-conical', custom: 'file-text'
};
const nodes = {};
for (const [name, file] of Object.entries(names)) {
    const svg = readFileSync(new URL(`../node_modules/lucide-static/icons/${file}.svg`, import.meta.url), 'utf8');
    nodes[name] = [...svg.matchAll(/<(path|circle|rect|line|polyline|polygon|ellipse)\b([^>]*?)\/>/g)].map(([, tag, attrs]) => [tag, Object.fromEntries([...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]))]);
    if (!nodes[name].length) throw new Error(`Icon not parsed: ${name}`);
}
const source = `// Generated from lucide-static 1.61.0 (ISC). See icons-LICENSE.txt.\nexport const ICON_NODES = Object.freeze(${JSON.stringify(nodes, null, 2)});\n\nexport function iconMarkup(name) {\n    const nodes = ICON_NODES[name] || ICON_NODES.brand;\n    const content = nodes.map(([tag, attrs]) => '<' + tag + ' ' + Object.entries(attrs).map(([key, value]) => key + '="' + value + '"').join(' ') + '/>').join('');\n    return '<svg class="ui-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + content + '</svg>';\n}\n`;
writeFileSync(new URL('../public/icons.js', import.meta.url), source);
writeFileSync(new URL('../public/icons-LICENSE.txt', import.meta.url), readFileSync(new URL('../node_modules/lucide-static/LICENSE', import.meta.url)));
console.log(`Vendored ${Object.keys(nodes).length} SVG icons.`);
