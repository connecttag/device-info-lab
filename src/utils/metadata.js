function text(value, limit = 200) { return typeof value === 'string' ? value.slice(0, limit) : null; }
export function parseUserAgent(ua) {
    const browserName = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\/|FxiOS\//.test(ua) ? 'Firefox' : /Chrome\/|CriOS\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : null;
    const osName = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS / iPadOS' : /Windows/i.test(ua) ? 'Windows' : /Macintosh|Mac OS/i.test(ua) ? 'macOS' : /CrOS/i.test(ua) ? 'ChromeOS' : /Linux/i.test(ua) ? 'Linux' : null;
    const deviceType = /iPad|Tablet/i.test(ua) ? 'tablet' : /Mobile|iPhone|Android/i.test(ua) ? 'mobile' : ua ? 'desktopOrOther' : null;
    const browserVersion = ua.match(/(?:Edg|OPR|Firefox|FxiOS|Chrome|CriOS)\/([\d.]+)/)?.[1] ?? ua.match(/Version\/([\d.]+)/)?.[1] ?? null;
    const osVersion = ua.match(/Android\s([\d.]+)/)?.[1] ?? ua.match(/(?:iPhone OS|CPU OS)\s([\d_]+)/)?.[1]?.replace(/_/g, '.') ?? ua.match(/Windows NT\s([\d.]+)/)?.[1] ?? ua.match(/Mac OS X\s([\d_]+)/)?.[1]?.replace(/_/g, '.') ?? null;
    return { browserName, browserVersion, osName, osVersion, deviceType };
}
export function safeHeaders(headers) {
    const result = {};
    let count = 0;
    for (const [name, raw] of headers) {
        if (count >= 50) break;
        // A positive list prevents unknown application-specific credentials from being stored.
        if (!/^(?:accept(?:-language|-encoding)?|user-agent|host|origin|referer|dnt|sec-gpc|sec-fetch-(?:site|mode|dest|user)|sec-ch-ua(?:-mobile|-platform|-platform-version|-model|-arch|-bitness|-full-version|-full-version-list|-wow64|-form-factors)?|upgrade-insecure-requests|cache-control|pragma|connection|priority|save-data|device-memory|dpr|width|viewport-width|rtt|downlink|ect|cf-ray|cf-connecting-ip|cf-ipcountry|cf-visitor|x-forwarded-proto)$/.test(name)) continue;
        let value = raw;
        if (name === 'referer') {
            try { const url = new URL(raw); value = url.origin; } catch { continue; }
        }
        result[name] = value.slice(0, 512);
        count++;
    }
    return result;
}
export function shouldSkipVisit(request) {
    return request.method === 'HEAD' || /prefetch|prerender/i.test(`${request.headers.get('purpose') ?? ''} ${request.headers.get('sec-purpose') ?? ''}`);
}
export function collectEdgeMetadata(request) {
    const cf = request.cf ?? {};
    const userAgent = text(request.headers.get('user-agent'), 1024);
    const rawIp = request.headers.get('cf-connecting-ip');
    const ip = rawIp && rawIp.length <= 45 && /^[0-9a-f:.]+$/i.test(rawIp) ? rawIp : null;
    return {
        ip, ipVersion: ip ? (ip.includes(':') ? 'IPv6' : 'IPv4') : null,
        userAgent, ...parseUserAgent(userAgent ?? ''), acceptLanguage: text(request.headers.get('accept-language')),
        country: text(cf.country, 2), city: text(cf.city), region: text(cf.region),
        asn: Number.isSafeInteger(cf.asn) ? cf.asn : null, asOrganization: text(cf.asOrganization),
        edgeTimezone: text(cf.timezone), edgeColo: text(cf.colo, 10), httpProtocol: text(cf.httpProtocol, 30), tlsVersion: text(cf.tlsVersion, 30), tlsCipher: text(cf.tlsCipher, 100),
        continent: text(cf.continent, 5), postalCode: text(cf.postalCode, 30), regionCode: text(cf.regionCode, 30),
        approximateLatitude: text(cf.latitude, 30), approximateLongitude: text(cf.longitude, 30),
        clientTcpRtt: typeof cf.clientTcpRtt === 'number' ? cf.clientTcpRtt : null,
        clientQuicRtt: typeof cf.clientQuicRtt === 'number' ? cf.clientQuicRtt : null,
        requestHeaders: safeHeaders(request.headers),
        isBot: /bot|crawler|spider|facebookexternalhit|WhatsApp|TelegramBot|Slackbot|Discordbot/i.test(userAgent ?? '')
    };
}
