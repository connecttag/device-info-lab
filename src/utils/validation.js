import { CONFIG } from '../config/constants.js';
import { fail } from './http.js';

export function onlyKeys(body, allowed) {
    if (Object.keys(body).some(key => !allowed.includes(key))) fail(400, 'BadRequest');
}
export function validateLink(body, patch = false) {
    onlyKeys(body, patch ? ['title', 'isActive', 'groupId'] : ['title', 'expiresInDays', 'expiresInHours', 'maxUses', 'groupId', 'template', 'pageTitle', 'pageMessage', 'companyName', 'companyWebsite', 'accentColor', 'backgroundColor', 'logoData']);
    const result = {};
    if (!patch || 'title' in body) {
        if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 120) fail(400, 'BadRequest');
        result.title = body.title.trim();
    }
    if (!patch) {
        if ('expiresInHours' in body && 'expiresInDays' in body) fail(400, 'BadRequest');
        const hours = body.expiresInHours ?? (body.expiresInDays ?? 7) * 24;
        if (!Number.isInteger(hours) || hours < 1 || hours > 2160 || ('expiresInDays' in body && (!Number.isInteger(body.expiresInDays) || body.expiresInDays < 1))) fail(400, 'BadRequest');
        result.expiresInHours = hours;
        result.maxUses = body.maxUses ?? null;
        if (result.maxUses !== null && (!Number.isInteger(result.maxUses) || result.maxUses < 1 || result.maxUses > 1000000)) fail(400, 'BadRequest');
        result.accentColor = validateColor(body.accentColor ?? '#6956d8');
        result.backgroundColor = validateColor(body.backgroundColor ?? '#f5f6fa');
        result.logoData = validateLogo(body.logoData);
        result.template = body.template ?? 'welcome';
        if (!CONFIG.templates.includes(result.template)) fail(400, 'BadRequest');
        for (const [field, max] of Object.entries({ pageTitle: 120, pageMessage: 1000, companyName: 120, companyWebsite: 2000 })) {
            if (body[field] !== undefined && (typeof body[field] !== 'string' || body[field].length > max)) fail(400, 'BadRequest');
            result[field] = body[field]?.trim() || null;
        }
        if (result.companyWebsite) {
            let url;
            try { url = new URL(result.companyWebsite); } catch { fail(400, 'BadRequest'); }
            if (url.protocol !== 'https:' || url.username || url.password) fail(400, 'BadRequest');
            result.companyWebsite = url.href;
        }
    }
    if (!patch || 'groupId' in body) {
        if (body.groupId != null && (typeof body.groupId !== 'string' || body.groupId.length > 100 || !/^[A-Za-z0-9-]*$/.test(body.groupId))) fail(400, 'BadRequest');
        result.groupId = body.groupId || null;
    }
    if ('isActive' in body) {
        if (typeof body.isActive !== 'boolean') fail(400, 'BadRequest');
        result.isActive = body.isActive;
    }
    if (!Object.keys(result).length) fail(400, 'BadRequest');
    return result;
}
export function validateColor(value) {
    if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) fail(400, 'BadRequest');
    return value.toLowerCase();
}
export function validateLogo(value) {
    if (value == null || value === '') return null;
    if (typeof value !== 'string' || value.length > 32800) fail(400, 'BadRequest');
    const match = value.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match || match[2].length % 4) fail(400, 'BadRequest');
    let raw; try { raw = atob(match[2]); } catch { fail(400, 'BadRequest'); }
    if (raw.length > 24576 || raw.length < 12) fail(400, 'BadRequest');
    const valid = match[1] === 'png' ? raw.startsWith('\x89PNG\r\n\x1a\n') : match[1] === 'jpeg' ? raw.startsWith('\xff\xd8\xff') : raw.startsWith('RIFF') && raw.slice(8, 12) === 'WEBP';
    if (!valid) fail(400, 'BadRequest');
    return value;
}
export function validateGroup(body) {
    onlyKeys(body, ['name']);
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 80) fail(400, 'BadRequest');
    return body.name.trim();
}
export function parseBrowser(body) {
    if (!body || Array.isArray(body) || typeof body !== 'object') fail(400, 'BadRequest');
    const ranges = { screenWidth: [0, 32768], screenHeight: [0, 32768], availableWidth: [0, 32768], availableHeight: [0, 32768], viewportWidth: [0, 32768], viewportHeight: [0, 32768], pixelRatio: [0.1, 20], touchPoints: [0, 100], colorDepth: [0, 128], pixelDepth: [0, 128], orientationAngle: [0, 360], hardwareConcurrency: [1, 1024], deviceMemory: [0.1, 1024], connectionDownlink: [0, 100000], connectionRtt: [0, 600000], timezoneOffset: [-1440, 1440] };
    const bools = ['online', 'cookieEnabled', 'pdfViewerEnabled', 'saveData', 'mobileHint', 'webdriver'];
    const texts = ['language', 'timezone', 'orientation', 'connectionType', 'effectiveType', 'uaPlatform', 'colorScheme', 'browserUserAgent'];
    const decimals = ['pixelRatio', 'deviceMemory', 'connectionDownlink'];
    onlyKeys(body, [...Object.keys(ranges), ...bools, ...texts, 'languages', 'browserBrands']);
    const result = {};
    for (const [field, value] of Object.entries(body)) {
        if (value === null) continue;
        if (field in ranges) {
            const [min, max] = ranges[field];
            if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (!decimals.includes(field) && !Number.isInteger(value))) fail(400, 'BadRequest');
        } else if (bools.includes(field)) {
            if (typeof value !== 'boolean') fail(400, 'BadRequest');
        } else if (field === 'languages') {
            if (!Array.isArray(value) || value.length > 16 || value.some(item => typeof item !== 'string' || item.length > 50)) fail(400, 'BadRequest');
        } else if (field === 'browserBrands') {
            if (!Array.isArray(value) || value.length > 10 || value.some(item => !item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).some(key => !['brand', 'version'].includes(key)) || typeof item.brand !== 'string' || item.brand.length > 100 || typeof item.version !== 'string' || item.version.length > 50)) fail(400, 'BadRequest');
        } else if (typeof value !== 'string' || value.length > (field === 'browserUserAgent' ? 1024 : 100)) fail(400, 'BadRequest');
        result[field] = value;
    }
    return result;
}
export function pageQuery(url, exportMode = false) {
    const integer = (name, fallback, max) => {
        const raw = url.searchParams.get(name);
        if (raw === null) return fallback;
        if (!/^\d+$/.test(raw)) fail(400, 'BadRequest');
        const value = Number(raw);
        if (!Number.isSafeInteger(value) || value < 1 || value > max) fail(400, 'BadRequest');
        return value;
    };
    const q = (url.searchParams.get('q') ?? '').trim();
    const linkId = url.searchParams.get('linkId') ?? '';
    const groupId = url.searchParams.get('groupId') ?? '';
    if (q.length > 120 || linkId.length > 100 || groupId.length > 100) fail(400, 'BadRequest');
    const result = { page: exportMode ? 1 : integer('page', 1, 10000), pageSize: exportMode ? CONFIG.maxExport : integer('pageSize', CONFIG.defaultPageSize, CONFIG.maxPageSize), q, linkId, groupId };
    for (const name of ['template', 'browser', 'os', 'country']) {
        const value = url.searchParams.get(name) || '';
        if (value.length > 100 || (name === 'template' && value && !CONFIG.templates.includes(value)) || (name === 'country' && value && value !== 'unknown' && !/^[A-Z]{2}$/.test(value))) fail(400, 'BadRequest');
        result[name] = value;
    }
    for (const name of ['from', 'to']) {
        const value = url.searchParams.get(name);
        if (!value) continue;
        const date = new Date(`${value}T00:00:00.000Z`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) fail(400, 'BadRequest');
        result[name === 'from' ? 'fromAt' : 'toAt'] = date.getTime() + (name === 'to' ? 86400000 : 0);
    }
    if (result.fromAt !== undefined && result.toAt !== undefined && result.fromAt >= result.toAt) fail(400, 'BadRequest');
    return result;
}
