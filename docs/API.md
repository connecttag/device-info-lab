# REST API

JSON keys use camelCase. Responses are `{ "success": true, "data": ... }` or `{ "success": false, "error": { "code": ..., "message": ... } }`.

## Origins and authentication

- Administration: `https://panel.connecttg.net`.
- Public visits: `https://connecttg.net`.
- Local development: both use `http://127.0.0.1:8787`.
- Administrative writes require `Origin` exactly equal to the administration origin. Login returns a host-only HttpOnly session cookie. Send subsequent requests with that cookie. No API key in query strings and no CORS wildcard.
- JSON body maximum: 8192 bytes; authenticated link creation and preview allow 49152 bytes to accommodate an embedded raster logo. Both declared and actual streamed sizes are bounded.

| Method | Administration path | Request / result |
| --- | --- | --- |
| GET | `/api/health` | Liveness and configuration presence only; also on public origin |
| POST | `/api/auth/login` | `{adminKey}` → cookie, `{authenticated:true}` |
| GET | `/api/auth/session` | `{authenticated:true,expiresAt}` |
| POST | `/api/auth/logout` | Deletes session and clears cookie |
| GET | `/api/links` | `?page=1&pageSize=20&q=...` → `{items,total,page,pageSize}` |
| POST | `/api/links` | Create a link; schema below. HTTP 201 |
| PATCH | `/api/links/:id` | `{title? , isActive?, groupId?}`; at least one field |
| DELETE | `/api/links/:id` | Deletes this link and its visit rows through FK cascade |
| GET | `/api/visits` | `?page=1&pageSize=20&q=...&linkId=...` |
| GET | `/api/visits/:id` | Visit metadata, browser fields and submitted lab data |
| GET | `/api/stats` | `{totalLinks,totalVisits,todayVisits,trainingSubmissions,distributions}`; today uses configured timezone |
| GET | `/api/export` | Same visit filters, max 250 records, JSON attachment, `truncated` flag |

All except health/login/branding require an unexpired session. Page sizes are 1–100, search is ≤120 characters, links are capped at 1000.

### Creating a link

```json
{
  "title": "التجربة الأولى",
  "expiresInHours": 168,
  "maxUses": null,
  "groupId": null,
  "accentColor": "#6956d8",
  "backgroundColor": "#f5f6fa",
  "logoData": null,
  "template": "deviceInfo",
  "pageTitle": "",
  "pageMessage": "",
  "companyName": "",
  "companyWebsite": ""
}
```

`title` is 1–120 characters, `expiresInHours` is an integer 1–2160 (default from settings); legacy `expiresInDays` 1–90 remains accepted, but cannot be combined with hours, and `template` is one of `welcome`, `deviceInfo`, `promotional`, `notFound`, `training`, `custom` (default from settings, initially `deviceInfo`). Optional title/company name ≤120, message ≤1000, and website ≤2000; website must be HTTPS with no embedded username/password. Plain text only. Unknown fields are rejected.

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


## Link tools, groups and settings

| Method | Admin path | Contract |
| --- | --- | --- |
| GET | `/api/links/:id` | Full existing link configuration including embedded logo, for duplicate prefill |
| GET | `/api/links/:id/qr` | Private generated SVG attachment containing the stored public URL |
| POST | `/api/preview` | Same schema as creation -> `{html}`; no scripts/capabilities/records; dashboard renders in sandboxed srcdoc |
| GET/POST | `/api/groups` | List groups with linkCount / create `{name}` (1–80, unique case-insensitive, max 100 groups) |
| PATCH/DELETE | `/api/groups/:id` | Rename `{name}` / delete group and unassign links |
| DELETE | `/api/groups/:id/visits` | Delete only group's visit rows; preserve links and lifetime quotas |
| GET/PATCH | `/api/settings` | Authenticated site preferences below; PATCH accepts any nonempty subset |
| POST | `/api/auth/rotate-key` | `{currentKey,newKey}`; new key 32–512 chars, HMAC digest stored, invalidate all sessions and clear cookie |
| POST | `/api/auth/revoke-sessions` | End all sessions and clear cookie |

`GET /api/branding` is public on both configured hosts and returns only `{brand,theme}`.
`GET /theme.css?accent=%236956d8&background=%23f5f6fa` emits bounded validated CSS. No arbitrary CSS accepted.

Settings: `brand` trimmed 1–80, `defaultTemplate` enum, `defaultExpiryHours` 1–2160, `defaultMaxUses` null or 1–1000000, `timezone` valid IANA identifier (initial UTC), `retentionDays` 1–30 (initial 30), `theme` system/light/dark (initial system). Shortening retention clamps existing rows and takes effect immediately for reads; increasing never resurrects old data. Key rotation does not echo or log credentials. Operational recovery is documented in README.

Creation `maxUses` null means unlimited; `groupId` must exist or be null. `accentColor` and `backgroundColor` are #RRGGBB. `logoData` is null or a validated PNG/JPEG/WebP base64 data URL, max 24 KiB decoded. Logo bytes are omitted from list results (`hasLogo` is supplied), available in link details. Duplicate is an ordinary create after prefilling these fields; no visit or quota state is copied. `useCount` is lifetime admitted GETs; retained visitCount can be smaller. Status may be `exhausted`; further opens return 410. HEAD/prefetch/known bots do not consume quota. Concurrency admission is enforced by one conditional SQL INSERT and a trigger in that same atomic statement.

Shared visit/stats/export filters: `from` and `to` YYYY-MM-DD inclusive in configured timezone (DST-aware), `groupId`, `linkId`, `template`, `browser`, `os`, `country` (two uppercase letters or unknown), `q`. Browser/OS/country unknown matches missing values. `totalLinks` remains global; every other count and distribution follows all filters and excludes retention-expired records. Distributions are arrays `{label,count}` under template/browser/os/country. Training count is successful fixed-demo submissions among the filtered visits, one per visit. Link list supports `q` and `groupId`.
