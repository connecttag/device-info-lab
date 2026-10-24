import { CONFIG } from '../config/constants.js';
import { fail } from './http.js';

export function onlyKeys(body, allowed) {
    if (Object.keys(body).some(key => !allowed.includes(key))) fail(400, 'BadRequest');
}
export function validateLink(body, patch = false) {
    onlyKeys(body, patch ? ['title', 'isActive'] : ['title', 'expiresInDays', 'template', 'pageTitle', 'pageMessage', 'companyName', 'companyWebsite']);
    const result = {};
    if (!patch || 'title' in body) {
        if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 120) fail(400, 'BadRequest');
        result.title = body.title.trim();
    }
    if (!patch) {
        const days = body.expiresInDays ?? 7;
        if (!Number.isInteger(days) || days < 1 || days > 90) fail(400, 'BadRequest');
        result.expiresInDays = days;
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
    if ('isActive' in body) {
        if (typeof body.isActive !== 'boolean') fail(400, 'BadRequest');
        result.isActive = body.isActive;
    }
    if (!Object.keys(result).length) fail(400, 'BadRequest');
    return result;
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
    if (q.length > 120 || linkId.length > 100) fail(400, 'BadRequest');
    return { page: exportMode ? 1 : integer('page', 1, 10000), pageSize: exportMode ? CONFIG.maxExport : integer('pageSize', CONFIG.defaultPageSize, CONFIG.maxPageSize), q, linkId };
}
