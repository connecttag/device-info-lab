import { validateColor } from '../utils/validation.js';
export function themeStyles(url) {
    const accent = validateColor(url.searchParams.get('accent') || '#6956d8');
    const background = validateColor(url.searchParams.get('background') || '#f5f6fa');
    const channels = accent.slice(1).match(/../g).map(hex => parseInt(hex, 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    return new Response(`body{--accent:${accent};--bg:${background};--on-accent:${luminance > 0.179 ? '#000000' : '#ffffff'}}`, { headers: { 'Content-Type': 'text/css; charset=utf-8' } });
}
