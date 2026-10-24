export function calendarDate(time, timezone) {
    const parts = new Intl.DateTimeFormat('en-US-u-nu-latn', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(time);
    const get = type => parts.find(part => part.type === type).value;
    return `${get('year').padStart(4, '0')}-${get('month')}-${get('day')}`;
}
export function nextDate(date) { return new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10); }
export function dayStart(date, timezone = 'UTC') {
    const utc = Date.parse(`${date}T00:00:00Z`);
    if (timezone === 'UTC') return utc;
    // Find the first instant of a local calendar day, including 23/25h DST days.
    let low = utc - 2 * 86400000, high = utc + 2 * 86400000;
    while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (calendarDate(middle, timezone) < date) low = middle + 1;
        else high = middle;
    }
    return low;
}
