# Implementation ledger

Plan: docs/superpowers/plans/2026-10-24-device-info-lab.md

Ruling: Continue implementation inline after the user's explicit instruction قم بالتنفيذ; do not request another planning approval.
Ruling: Retain device-info-lab and device-info-lab-db; use مريم لينك only as visible page branding, per the user's correction.
Ruling: Do not run application code, tests, package installation, builds or deployment; the user's execution restriction takes precedence over skill execution and browser verification steps.
Ruling: Deliver a standalone directory, not a worktree/branch, because the user explicitly requested a new independent project directory.

Progress: tests and implementation pending.

Update: User explicitly authorized deployment, git push and D1 migrations after implementation. Necessary builds/tests, dependency installation and local/remote deployment verification are now authorized. Earlier deferred execution steps can proceed.
Update: Public origin https://info.aslyemen.com; admin origin https://devics-panel.aslyemen.com (preserve the exact spelling requested).
Update: No visitor dashboard. Training template uses a fictional service and fixed public demo credentials only; submission is saved for viewing by the administrator later.

Task 1: Implemented and exercised with real SQLite; basic security/repository tests pass.
Task 2: Implemented six templates, host isolation, automatic save, signed one-time enrichment, private administration, and header allowlist.
Task 3: Dashboard implemented; browser validation in progress.
Final review: Fresh reviewer found native no-JS form submission, insufficient header name redaction, and table placeholder artifacts. Header/form regression tests reproduced failures before fixes; fixed both and all 18 tests passed. Empty table containers no longer insert a missing-value placeholder.
Ruling: Export capped at 250 records because each visit now has significantly more header/browser metadata; this keeps D1 response and Worker memory bounded.
Ruling: Use only ordinary metadata headers on a positive list, and retain only the referrer origin. Unknown headers can carry arbitrary application secrets.
Ruling: Update Wrangler from the reference project's 4.129.0 to current 4.152.0 because its bundled local runtime rejected the requested 2026-10-24 compatibility date.

Validation: 18/18 Node/SQLite tests passed; source syntax/import/config checks passed for 38 JavaScript files. Production smoke script passed 80 checks against both live custom domains, and deleted its own six temporary links and visits.
Validation: Browser flow covered admin login → create link → public device information → persisted edge/browser details in admin. Fictional training rejected incorrect dummy data locally, accepted the fixed demo account, and showed success. No relevant console errors.
Validation: Responsive proof used IAB; confirmed 390×844 with no document overflow and a deliberate horizontal table scroller. Desktop evidence captured at 1536×1024. Viewport overrides apply to the browser's active tab, so dimensions were read from the target tab to confirm each proof. Temporary viewport overrides reset after QA.
Visual ledger: Preserved right navigation rail, header/create action, three stat blocks, link/visit tables, white surfaces, violet accent, restrained borders and RTL spacing from docs/design/dashboard-concept.png. Intentional departures: no fabricated metrics/percentage trends, no shortening/redirect target column, and no external browser/company logos. Actual controls and missing states use shared Arabic resources. Mobile table rows were corrected from narrow character wrapping to readable horizontal tables.
Secrets: Production administrator/signing secrets generated outside the repository and uploaded through Wrangler secret bulk. Secret values were not printed and the tracked source scan found no production secret. .dev.vars is ignored.
Cloudflare: Independent D1 6b82e6c9-eaac-418a-9939-5372ab4a2989; 0001_initial.sql applied locally and remotely. Initial published Worker version 10a25a6b-5528-4f89-a895-83dba4f8dfd4. Both requested custom domains bound successfully.

User-requested visual refinement: Added native emoji to navigation, stat summaries, primary actions, table actions, visitor templates and empty states; embedded Tajawal Regular/Medium/Bold locally with the original SIL OFL license. Refined panel contrast, type hierarchy, button spacing and mobile stat cards. Shared text resources and one local font stylesheet remain authoritative. Rechecked all 18 tests and source/resource integrity after these changes; no relevant browser console errors.
GitHub: Public repository https://github.com/connecttag/device-info-lab created and initial commit d56dbe7 pushed on codex/initial-release. No SoorNet or soor-api files changed.

## Link tools and settings release (2026-10-24)

Supersedes the earlier emoji direction: all dashboard and visitor icons are locally bundled Lucide SVG (ISC), with no emoji characters in UI resources. Added shared-renderer desktop/mobile preview; promotional raster logo/colors/title; date, group and dimension filters; four distributions and training counts; QR SVG download; duplicate prefill; hours expiry; atomic lifetime usage caps; group management/move/purge; configurable brand/defaults/timezone/retention/appearance; session revoke and current-key-protected key rotation. Public training still accepts only the fixed public dummy account.

Fresh review: three Important concurrency findings, all fixed with failing regressions before changes: retention is clamped from persisted settings inside atomic admission; partial settings changes update only submitted columns; stale settings/groups/link-options responses cannot overwrite newer UI state. No Critical findings, declined judgments or code minors remain.

Validation: 32/32 Node real-SQLite, security, route and timing regression tests passed. Syntax/import/config/resource check passed for 59 JS files. npm audit: 0 vulnerabilities after pinning the development undici override to 7.30.1. Local smoke passed 99 checks before five additional production checks were added.

Production: migrations 0002_link_tools.sql, 0003_site_settings.sql and 0004_preferences_security.sql applied successfully to the independent D1; remote migration list confirms no pending migrations. Worker version 8cd6a463-e073-45b6-acc1-aee068310d9c deployed to both custom domains. Production smoke passed 106 checks across all six templates and the new APIs, including eight simultaneous GETs on a two-use link, last-admitted enrichment/training, filtered analytics/export, group move/rename/purge/unassignment and retained quota. Temporary test links/groups/visits removed; final authenticated dashboard confirmed zero test records.

Browser: production IAB at 1536x1024 and 390x844, with four stat cards and actual SVG icons, no horizontal document overflow and no relevant console warnings/errors. Verified promotional title/colors and PNG upload in production preview (no link/visit created). Local UI verified saved brand/theme/timezone/defaults, logo persistence, QR image, and desktop/mobile preview toggling. Authentication key rotation and end-all-sessions were tested only in isolated local test databases; production credentials and active user sessions were not deliberately changed. The new credential digest scheme requires reauthentication for sessions issued by the previous release.

Evidence (outside repository): link-tools-production-desktop.png, link-tools-production-preview.png and link-tools-production-mobile.png under the session visualizations directory. Viewport override reset and local fixture/preferences cleaned up after testing.
