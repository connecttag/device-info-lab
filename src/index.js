import { route } from './routes.js';
import { secure, errorResponse } from './utils/http.js';
import { MaintenanceRepository } from './repositories/MaintenanceRepository.js';

export default {
    async fetch(request, env) {
        let response;
        try { response = await route(request, env); }
        catch (error) { response = errorResponse(error); }
        return secure(response, request);
    },
    async scheduled(event, env, ctx) {
        // No visitor information, credentials or raw request URLs are logged.
        const cleanup = new MaintenanceRepository(env.DB).clean(Date.now());
        ctx.waitUntil(cleanup);
    }
};
