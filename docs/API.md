# REST API

JSON keys use camelCase. Responses are `{ "success": true, "data": ... }` or `{ "success": false, "error": { "code": ..., "message": ... } }`.

## Origins and authentication

- Administration: `https://devics-panel.aslyemen.com`.
- Public visits: `https://info.aslyemen.com`.
- Local development: both use `http://127.0.0.1:8787`.
- Administrative writes require `Origin` exactly equal to the administration origin. Login returns a host-only HttpOnly session cookie. Send subsequent requests with that cookie. No API key in query strings and no CORS wildcard.
- JSON request body maximum: 8192 bytes, including bodies without Content-Length.

| Method | Administration path | Request / result |
| --- | --- | --- |
| GET | `/api/health` | Liveness and configuration presence only; also on public origin |
| POST | `/api/auth/login` | `{adminKey}` → cookie, `{authenticated:true}` |
| GET | `/api/auth/session` | `{authenticated:true,expiresAt}` |
| POST | `/api/auth/logout` | Deletes session and clears cookie |
| GET | `/api/links` | `?page=1&pageSize=20&q=...` → `{items,total,page,pageSize}` |
| POST | `/api/links` | Create a link; schema below. HTTP 201 |
| PATCH | `/api/links/:id` | `{title? , isActive?}`; at least one field |
| DELETE | `/api/links/:id` | Deletes this link and its visit rows through FK cascade |
| GET | `/api/visits` | `?page=1&pageSize=20&q=...&linkId=...` |
| GET | `/api/visits/:id` | Visit metadata, browser fields and submitted lab data |
| GET | `/api/stats` | `{totalLinks,totalVisits,todayVisits}`; today is UTC |
| GET | `/api/export` | Same visit filters, max 250 records, JSON attachment, `truncated` flag |

All except health/login require an unexpired session. Page sizes are 1–100, search is ≤120 characters, links are capped at 1000.

### Creating a link

```json
{
  "title": "التجربة الأولى",
  "expiresInDays": 7,
  "template": "deviceInfo",
  "pageTitle": "",
  "pageMessage": "",
  "companyName": "",
  "companyWebsite": ""
}
```

`title` is 1–120 characters, `expiresInDays` is an integer 1–90 (default 7), and `template` is one of `welcome`, `deviceInfo`, `promotional`, `notFound`, `training`, `custom` (default `welcome`). Optional title/company name ≤120, message ≤1000, and website ≤2000; website must be HTTPS with no embedded username/password. Plain text only. Unknown fields are rejected.

Returned link contains `id`, `token`, timestamps in Unix milliseconds, boolean `isActive`, derived `status`, and `url` using the public origin. Link tokens are 32 random bytes encoded as 43 URL-safe characters.

## Public endpoints

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/v/:token` | Saves a base visit before returning the chosen template. `notFound` still saves but returns HTTP 404 |
| HEAD | `/v/:token` | No visit, HTTP 204 on a valid active link |
| POST | `/api/visits/enrich` | `{capability,browser}`; adds validated browser metadata once |
| POST | `/api/training/submit` | `{capability,username,password}`; accepts only the fixed public lab account |

Public writes require the public Origin. Capabilities are HMAC-signed, visit/link/purpose-bound, expire after ten minutes or link expiration (whichever is sooner), and are never an administrative session. A disabled/expired/deleted link cannot record or enrich. Duplicate enrich/training writes return 409. No public endpoint reads stored visit records.

`browser` accepts the bounded fields documented in `src/utils/validation.js`; IP, location and request headers are server-owned and cannot be overwritten by enrichment.

Public rendering never redirects silently, injects custom scripts, or impersonates an existing service. Fixed lab credentials are not secrets. Arbitrary usernames/passwords are rejected and not stored.

## Status codes

400 invalid fields; 401 missing/expired admin session; 403 wrong Origin/capability; 404 unknown route/item; 409 replay or unusable visit; 410 unavailable public link; 413 body too large; 415 wrong content type; 429 rate limited; 503 missing secrets/database binding. Unexpected errors return a generic 500 without stack traces or input echoing.
