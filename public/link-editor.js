import { S } from './strings.js';
import { api } from './api.js';

export function initEditor({ getSettings, onSaved, onError }) {
    const $ = selector => document.querySelector(selector), form = $('#create-form'), dialog = $('#create-dialog'), frame = $('#template-preview');
    let logoData = null, viewport = 390, timer, generation = 0, controller;
    frame.title = S.preview;
    function syncFields() { $('#company-fields').hidden = form.elements.template.value !== 'promotional'; }
    function body(preview = false) {
        const value = Object.fromEntries(new FormData(form));
        value.expiresInHours = Number(value.expiresInHours); value.maxUses = value.maxUses ? Number(value.maxUses) : null;
        value.groupId ||= null; value.logoData = logoData;
        if (preview && !value.title.trim()) value.title = S.preview;
        return value;
    }
    function fit() {
        const width = $('#preview-stage').clientWidth;
        if (!width) return;
        const scale = Math.min(1, width / viewport);
        frame.style.insetInlineStart = `${Math.max(0, (width - viewport * scale) / 2)}px`;
        frame.style.width = `${viewport}px`; frame.style.height = `${Math.round(560 / scale)}px`; frame.style.transform = `scale(${scale})`;
    }
    new ResizeObserver(fit).observe($('#preview-stage'));
    function updateLogo(text = '') {
        $('#logo-status').textContent = text; $('#remove-logo').hidden = !logoData;
    }
    async function preview() {
        const current = ++generation; controller?.abort(); controller = new AbortController();
        if (!dialog.open) return;
        $('#preview-status').textContent = S.previewLoading;
        try {
            const data = await api('/api/preview', { method: 'POST', body: body(true), signal: controller.signal });
            if (current !== generation || !dialog.open) return;
            frame.srcdoc = data.html; $('#preview-status').textContent = ''; fit();
        } catch (error) {
            if (error.name === 'AbortError' || current !== generation) return;
            frame.removeAttribute('srcdoc'); $('#preview-status').textContent = error.message;
            if (error.status === 401) onError(error);
        }
    }
    function schedule() { clearTimeout(timer); generation++; controller?.abort(); timer = setTimeout(preview, 300); }
    const onInput = event => { if (event.target.id !== 'company-logo') { syncFields(); schedule(); } };
    form.addEventListener('input', onInput);
    form.addEventListener('change', onInput);
    $('#company-logo').addEventListener('change', async event => {
        const file = event.target.files[0];
        if (!file) return;
        if (file.size > 24576 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { $('#create-error').textContent = S.logoTooLarge; event.target.value = ''; return; }
        const current = generation;
        try {
            const result = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
            if (!dialog.open || generation !== current) return;
            logoData = result; updateLogo(file.name); $('#create-error').textContent = ''; schedule();
        } catch { $('#create-error').textContent = S.genericError; }
    });
    $('#remove-logo').addEventListener('click', () => { logoData = null; $('#company-logo').value = ''; updateLogo(); schedule(); });
    document.querySelectorAll('[data-viewport]').forEach(node => node.addEventListener('click', () => {
        viewport = Number(node.dataset.viewport);
        document.querySelectorAll('[data-viewport]').forEach(control => control.setAttribute('aria-pressed', String(control === node))); fit();
    }));
    dialog.addEventListener('close', () => { generation++; controller?.abort(); clearTimeout(timer); frame.removeAttribute('srcdoc'); });
    form.addEventListener('submit', async event => {
        event.preventDefault(); const submit = form.querySelector('[type="submit"]'); submit.disabled = true; $('#create-error').textContent = '';
        try { const link = await api('/api/links', { method: 'POST', body: body() }); dialog.close(); await onSaved(link); }
        catch (error) { $('#create-error').textContent = error.message; if (error.status === 401) onError(error); }
        finally { submit.disabled = false; }
    });
    return { open(source) {
        form.reset(); const settings = getSettings();
        const fields = { expiresInHours: settings.defaultExpiryHours, maxUses: settings.defaultMaxUses ?? '', template: settings.defaultTemplate, ...source };
        if (source) { fields.title = `${source.title}${S.duplicateSuffix}`.slice(0, 120); fields.expiresInHours = Math.max(1, Math.min(2160, Math.round((source.expiresAt - source.createdAt) / 3600000))); }
        for (const [name, value] of Object.entries(fields)) if (form.elements.namedItem(name)) form.elements.namedItem(name).value = value ?? '';
        logoData = source?.logoData || null; updateLogo(logoData ? S.logo : '');
        $('#editor-heading').textContent = source ? S.duplicate : S.create; $('#create-error').textContent = '';
        syncFields(); dialog.showModal(); fit(); preview();
    } };
}
