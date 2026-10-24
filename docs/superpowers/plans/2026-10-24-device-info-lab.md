# Device Info Lab Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan inline.

**Goal:** Deliver an independent Worker REST API and Arabic dashboard titled مريم لينك that records ordinary visit and browser information automatically.

**Architecture:** One ES-module Worker serves same-origin static assets and authenticated administration endpoints. Controllers validate input, services own behavior, and repositories own prepared D1 statements. Public visits create a record before HTML is returned; a short-lived signed capability enriches that same record once.

**Tech Stack:** JavaScript, Cloudflare Workers Static Assets, D1, Web Crypto, Wrangler, Node built-in test runner and SQLite for authored integration tests.

**Spec:** docs/superpowers/specs/2026-10-24-device-info-lab-design.md (approved in chat).

## Global Constraints

- Folder `device-info-lab`; D1 `device-info-lab-db`; only the page title/brand is مريم لينك.
- Record automatically without a visitor consent button. Public page states its educational purpose.
- The user explicitly authorized testing, deployment, git push and remote D1 migration during implementation; proceed through those steps.
- No changes to SoorNet or soor-api, their databases, secrets or domains.
- camelCase wire keys; central strings/constants; no raw browser data inserted as HTML.
- Author tests before implementation, but do not claim RED/GREEN proof without execution.
- New standalone directory is already isolated from existing repositories; no worktree or commits needed.

## Review Focus

1. Expired/disabled links cannot record or enrich; test these predicates in SQLite integration.
2. Public endpoints never expose visit rows; test unauthenticated API access and capability tampering.
3. Concurrent enrichment and duplicate requests update at most once; test conditional UPDATE and replay.
4. Session cookies require trusted origin on writes; test origin rejection and local/production cookie policy.
5. HTML/SQL injection, oversized requests, bot previews and absent edge metadata; test bounded parsing, bound SQL and preview behavior.

## Task 1: Persistence and security foundation

Files: package.json, wrangler.jsonc, migrations/0001_initial.sql, src/config/constants.js, src/core/base/*.js, src/utils/*.js, src/repositories/*.js, tests/security.test.js, tests/repository.test.js.

Interfaces: randomToken(), sha256(value), signCapability(secret,payload), verifyCapability(secret,token), parseJson(request), validateLink(body), parseBrowser(body), BaseRepository(db), repositories operating on links/visits/adminSessions/rateLimits.

- [x] Author focused security, parser and SQLite repository tests first.
- [x] Implement schema, bounded HTTP helpers, cryptography, validation and repositories.
- [x] Inspect source/config references; execute `npm test` and `npm run check` after permission.

## Task 2: Worker API and visit lifecycle

Files: src/index.js, src/routes.js, src/controllers/*.js, src/services/*.js, src/views/visitPage.js, tests/worker.test.js.

Interfaces: Worker.fetch(request,env,ctx), scheduled(event,env,ctx); GET /v/:token; POST /api/visits/enrich; administrative auth/link/visit/stats/export routes.

- [x] Author route contracts covering missing auth, automatic recording, disabled links, oversized bodies and enrichment replay.
- [x] Implement origin-checked cookie sessions, D1-backed rate limiting, edge metadata collection, visit rendering, token verification, and retention cleanup.
- [x] Inspect routing and every database mutation; exercise actual local and production requests after permission.

## Task 3: Arabic dashboard and handoff

Files: public/index.html, public/app.js, public/api.js, public/ui.js, public/strings.js, public/styles.css, public/visit.js, public/visit.css, README.md, docs/API.md, .dev.vars.example, .gitignore.

- [x] Generate a dashboard concept and extract tokens/layout before writing interface code.
- [x] Implement login, links, visitor list/detail, pagination/filter, JSON export, accessible confirmation dialogs and session-expiry handling.
- [x] Write setup and endpoint documentation with exact separate local/remote migration commands and no live credentials.
- [x] Perform a fresh read-only review and inspect file/import/resource integrity; fix confirmed findings. Complete Chrome/IAB desktop and 390px mobile checks.

## Verification status

18 unit/integration tests passed. Real local browser flow passed. 80 production smoke checks across all six templates passed, with test links and visits cleaned up. Final deployment/push metadata is recorded in the implementation ledger.
