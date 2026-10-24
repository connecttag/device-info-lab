import { json, parseJson } from '../../utils/http.js';
export class BaseController {
    body(request) { return parseJson(request); }
    ok(data, status = 200, headers = {}) { return json(data, status, headers); }
}
