import { S } from './strings.js';

const page = document.querySelector('[data-capability]');
const browser = {
    language: navigator.language ?? null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
    screenWidth: screen.width, screenHeight: screen.height,
    viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
    pixelRatio: window.devicePixelRatio, touchPoints: navigator.maxTouchPoints ?? 0
};
Object.assign(browser, {
    availableWidth: screen.availWidth, availableHeight: screen.availHeight,
    colorDepth: screen.colorDepth, pixelDepth: screen.pixelDepth,
    orientation: screen.orientation?.type ?? null, orientationAngle: screen.orientation?.angle ?? null,
    languages: [...(navigator.languages ?? [])].slice(0, 16), timezoneOffset: new Date().getTimezoneOffset(),
    online: navigator.onLine, cookieEnabled: navigator.cookieEnabled,
    pdfViewerEnabled: navigator.pdfViewerEnabled ?? null, webdriver: navigator.webdriver ?? null,
    hardwareConcurrency: navigator.hardwareConcurrency ?? null, deviceMemory: navigator.deviceMemory ?? null,
    connectionType: navigator.connection?.type ?? null, effectiveType: navigator.connection?.effectiveType ?? null,
    connectionDownlink: Number.isFinite(navigator.connection?.downlink) ? navigator.connection.downlink : null,
    connectionRtt: Number.isFinite(navigator.connection?.rtt) ? navigator.connection.rtt : null,
    saveData: navigator.connection?.saveData ?? null,
    uaPlatform: navigator.userAgentData?.platform ?? null, mobileHint: navigator.userAgentData?.mobile ?? null,
    browserBrands: navigator.userAgentData?.brands?.map(({ brand, version }) => ({ brand, version })) ?? null,
    browserUserAgent: navigator.userAgent,
    colorScheme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
});
const info = document.getElementById('browser-info');
if (info) {
    for (const [key, value] of Object.entries(browser)) {
        const row = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
        dt.textContent = S.fields[key]; dd.textContent = value === null ? S.unavailable : typeof value === 'object' ? JSON.stringify(value) : typeof value === 'boolean' ? (value ? S.yes : S.no) : String(value); dd.dir = 'auto';
        row.append(dt, dd); info.append(row);
    }
}
if (page?.dataset.capability) {
    // Keep the base visit when JavaScript is blocked or enrichment fails; never retry writes.
    fetch('/api/visits/enrich', { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ capability: page.dataset.capability, browser }), keepalive: true }).catch(() => {});
}
const form = document.getElementById('training-form');
if (form) {
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const status = document.getElementById('training-status');
        const data = new FormData(form);
        const username = data.get('username'), password = data.get('password');
        if (username !== document.getElementById('demo-user').textContent || password !== document.getElementById('demo-pass').textContent) {
            status.textContent = S.demoOnly;
            form.elements.password.value = '';
            return;
        }
        const button = form.querySelector('button');
        button.disabled = true;
        try {
            const response = await fetch('/api/training/submit', { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ capability: page.dataset.trainingCapability, username, password }) });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error?.message || S.genericError);
            status.textContent = S.trainingSaved;
            form.hidden = true;
        } catch (error) { status.textContent = error.message || S.connectionError; button.disabled = false; }
    });
    if (page.dataset.trainingCapability) form.querySelectorAll('input, button').forEach(control => { control.disabled = false; });
}
