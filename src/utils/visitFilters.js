// One predicate shared by pagination, export and every aggregate.
export function visitFilters(query, now) {
    const terms = ['v.retainUntil > ?'], params = [now];
    for (const [key, column] of Object.entries({ linkId: 'v.linkId', groupId: 'l.groupId', template: 'v.template', browser: 'v.browserName', os: 'v.osName', country: 'v.country' })) {
        if (!query[key]) continue;
        if (query[key] === 'unknown' && ['browser', 'os', 'country'].includes(key)) terms.push(`(${column} IS NULL OR ${column} = '')`);
        else { terms.push(`${column} = ?`); params.push(query[key]); }
    }
    if (query.fromAt !== undefined) { terms.push('v.createdAt >= ?'); params.push(query.fromAt); }
    if (query.toAt !== undefined) { terms.push('v.createdAt < ?'); params.push(query.toAt); }
    if (query.q) {
        const pattern = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`;
        terms.push("(v.ip LIKE ? ESCAPE '\\' OR v.country LIKE ? ESCAPE '\\' OR v.browserName LIKE ? ESCAPE '\\' OR v.osName LIKE ? ESCAPE '\\' OR l.title LIKE ? ESCAPE '\\')");
        params.push(pattern, pattern, pattern, pattern, pattern);
    }
    return { where: terms.join(' AND '), params };
}
