import test from 'node:test';
import assert from 'node:assert/strict';
import { S } from '../public/strings.js';
import { visitPage } from '../src/views/visitPage.js';
test('dashboard copy and template icons use actual SVG assets without emoji characters', async () => {
    assert.equal(/\p{Extended_Pictographic}/u.test(JSON.stringify(S)), false);
    const html = await visitPage({ template: 'promotional' }, {}, '', '').text();
    assert.match(html, /<svg[^>]+viewBox="0 0 24 24"/);
    assert.match(html, /stroke="currentColor"/);
});
