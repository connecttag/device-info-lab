import test from 'node:test';
import assert from 'node:assert/strict';
import { latestLoader } from '../public/latest.js';
test('older dashboard responses cannot overwrite a newer snapshot or raise stale authentication errors', async () => {
    const pending = [], committed = [];
    const refresh = latestLoader(() => new Promise((resolve, reject) => pending.push({ resolve, reject })), data => committed.push(data));
    const old = refresh(), current = refresh();
    pending[1].resolve({ brand: 'new', timezone: 'Asia/Riyadh' }); await current;
    pending[0].resolve({ brand: 'old', timezone: 'UTC' }); await old;
    assert.deepEqual(committed, [{ brand: 'new', timezone: 'Asia/Riyadh' }]);
    const expired = refresh(), newer = refresh(); pending[3].resolve('newer'); await newer;
    pending[2].reject(new Error('stale 401')); await expired;
    assert.deepEqual(committed.at(-1), 'newer');
});
