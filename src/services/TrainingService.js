import { BaseService } from '../core/base/BaseService.js';
import { VisitRepository } from '../repositories/VisitRepository.js';
import { RateLimitService } from './RateLimitService.js';
import { CONFIG } from '../config/constants.js';
import { onlyKeys } from '../utils/validation.js';
import { verifyCapability } from '../utils/crypto.js';
import { fail } from '../utils/http.js';

export class TrainingService extends BaseService {
    async submit(request, body) {
        onlyKeys(body, ['capability', 'username', 'password']);
        const payload = await verifyCapability(this.env.TOKEN_SECRET, body.capability, 'training');
        await new RateLimitService(this.env).check(request, `training:${payload.visitId}`, 5, 60000);
        // Only these deliberately public lab credentials can ever be persisted.
        if (body.username !== CONFIG.demoUsername || body.password !== CONFIG.demoPassword) fail(400, 'DemoOnly');
        const now = Date.now();
        const training = { username: CONFIG.demoUsername, password: CONFIG.demoPassword, submittedAt: now };
        if (!await new VisitRepository(this.env.DB).saveTraining(payload.visitId, payload.linkId, training, now)) fail(409, 'AlreadySubmitted');
    }
}
