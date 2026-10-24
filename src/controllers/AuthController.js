import { BaseController } from '../core/base/BaseController.js';
import { AuthService } from '../services/AuthService.js';
import { onlyKeys } from '../utils/validation.js';
export class AuthController extends BaseController {
    constructor(env) { super(); this.auth = new AuthService(env); }
    async login(request) {
        const body = await this.body(request);
        onlyKeys(body, ['adminKey']);
        const cookie = await this.auth.login(request, body.adminKey);
        return this.ok({ authenticated: true }, 200, { 'Set-Cookie': cookie });
    }
    async session(request) {
        const session = await this.auth.require(request);
        return this.ok({ authenticated: true, expiresAt: session.expiresAt });
    }
    async logout(request) {
        return this.ok({ authenticated: false }, 200, { 'Set-Cookie': await this.auth.logout(request) });
    }
}
