import test from 'node:test';
import assert from 'node:assert/strict';
import { TrainingService } from '../src/services/TrainingService.js';
import { createEnv, request } from './helpers.js';
import { LinkRepository } from '../src/repositories/LinkRepository.js';
import { VisitRepository } from '../src/repositories/VisitRepository.js';
import { signCapability } from '../src/utils/crypto.js';
import { CONFIG } from '../src/config/constants.js';

test('training stores only fixed public demo credentials; real credentials are rejected', async () => {
    const env = createEnv(), now = Date.now();
    try {
        await new LinkRepository(env.DB).create({ id: 'l1', token: 'token', title: 'Demo', template: 'training', createdAt: now, expiresAt: now + 100000 });
        await new VisitRepository(env.DB).record({ id: 'v1', linkId: 'l1', now, retainUntil: now + 100000, edge: { isBot: false } });
        const capability = await signCapability(env.TOKEN_SECRET, { visitId: 'v1', linkId: 'l1', expiresAt: now + 100000 }, 'training');
        const service = new TrainingService(env);
        await assert.rejects(service.submit(request('/api/training/submit'), { capability, username: 'real-person', password: 'not-a-demo-password' }), { status: 400 });
        assert.equal((await new VisitRepository(env.DB).findById('v1', now)).training, null);
        await service.submit(request('/api/training/submit'), { capability, username: CONFIG.demoUsername, password: CONFIG.demoPassword });
        const visit = await new VisitRepository(env.DB).findById('v1', now);
        assert.equal(visit.training.password, CONFIG.demoPassword);
        await assert.rejects(service.submit(request('/api/training/submit'), { capability, username: CONFIG.demoUsername, password: CONFIG.demoPassword }), { status: 409 });
    } finally { env.DB.close(); }
});
