# Link Tools Implementation Plan

> For agentic workers: use superpowers:executing-plans, inline execution authorized.

**Goal:** Complete the three user-selected enhancements and deploy them.
**Architecture:** Existing controller/service/repository Worker, additive SQLite migration, shared renderer and query predicate, static ES module dashboard.
**Tech Stack:** Workers, D1, vanilla JS/CSS, qrcode 1.5.4, Node SQLite tests.
**Spec:** ../specs/2026-10-24-link-tools.md

## Global constraints
- Preserve host isolation, admin sessions, bounded requests, fixed public demo-only training and 30-day visit retention.
- No actual visitor visits, writes or capabilities from previews. No remote QR/logo service.
- Arabic strings centralized; match the established RTL design.

## Review focus
- Final admitted visit can enrich/submit after cap is reached; concurrent GETs cannot overrun cap.
- UTC date boundaries, empty distributions, filtered export and stale UI requests agree.
- Preview layout fits narrow screens and matches actual public promotional styling.
- Logo type/size, hostile text/colors and preview framing cannot introduce scripts.
- Duplicate/group deletion never copy visits, reset source quota or delete unrelated links.

### Task 1: Backend contracts
Files: migrations/0002_link_tools.sql; validation, Link/Visit/Group repositories and services, controllers, routes; tests/link-tools.test.js and helpers.
Interfaces: creation returns group/theme/quota, duplicate source GET, authenticated QR/preview/group endpoints; pageQuery shared filters.
- [ ] Write failing real SQLite and route tests for all new contracts; run node --experimental-sqlite --test tests/link-tools.test.js (expected failures).
- [ ] Implement migration, bounded validation, atomic quota, groups and shared analytics filtering, preview/QR endpoints.
- [ ] Run npm test and npm run check (expected all pass); commit backend.

### Task 2: Dashboard
Files: public/index.html, app.js, strings.js, ui.js, styles.css; new public/link-editor.js and analytics.js; visitor renderer/theme route.
Interfaces: consume Task 1 canonical fields and filter contract; iframe sandbox source from authenticated preview JSON.
- [ ] Add shared renderer theme/preview tests first, run (expected failing before feature).
- [ ] Implement editor, desktop/mobile preview, logo upload, group management and move, duplicate, QR download, filters and distributions.
- [ ] Run suite/check and browser desktop/mobile interactions (expected matching spec); commit dashboard.

### Task 3: Delivery
Files: scripts/smoke-check.js, README.md, docs/API.md, docs/implementation-status.md.
Interfaces: deployed migration matches Worker; smoke uses isolated temporary records only.
- [ ] Extend smoke for groups, quota, clone settings, preview, analytics and QR.
- [ ] Fresh code review, fix important findings with regression tests, run complete checks.
- [ ] Apply migration locally/remotely, deploy, production smoke, push and verify remote head (expected all pass).

## Ledger
Task 2: complete (d1b75ba; 28/28 suite, source check; 99 local smoke checks; Chrome/IAB preview/logo/QR/brand/defaults/theme and 390x844 layout verified).
Final review: fresh read-only reviewer identified three Important races, no Critical findings, no declined judgments and no code minors. Fixed retention-at-admission and independent settings PATCH concurrency with failing SQLite regressions; fixed stale settings/groups/link-option responses with actual UI settings regression and shared latest-request loader. RED to GREEN, whole suite 32/32; local smoke 99/99. Development undici dependency pinned to patched 7.30.1; npm audit reports 0 vulnerabilities.
Pre-flight: Task 1 -> Task 2 share hours/group/theme/filter fields and route response shapes; spec is canonical. Task 1 -> Task 3 share migration and routes; preserve compatibility with existing records and days API. Task 2 -> Task 3 share isolated preview and local assets; verify in actual browser and Worker.

Task 1: complete (e3ee826; 24/24 Node SQLite tests and source check passed). User added settings defaults/timezone/retention/security/theme; implementation integrated with Task 2, additional tests RED then GREEN 27/27. User replaced emoji direction with local SVG; icon regression RED then GREEN, suite 28/28. Browser plugin is absent; existing authorized CUA browser APIs used for real Chrome/IAB QA.
