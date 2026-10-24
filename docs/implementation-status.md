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
Validation: Chrome viewport override did not change its DOM dimensions, so IAB was used for responsive proof; confirmed 390×844 with no document overflow and a deliberate horizontal table scroller. Desktop evidence captured at 1536×1024. Temporary viewport overrides reset after QA.
Visual ledger: Preserved right navigation rail, header/create action, three stat blocks, link/visit tables, white surfaces, violet accent, restrained borders and RTL spacing from docs/design/dashboard-concept.png. Intentional departures: no fabricated metrics/percentage trends, no shortening/redirect target column, and no external browser/company logos. Actual controls and missing states use shared Arabic resources. Mobile table rows were corrected from narrow character wrapping to readable horizontal tables.
Secrets: Production administrator/signing secrets generated outside the repository and uploaded through Wrangler secret bulk. Secret values were not printed and the tracked source scan found no production secret. .dev.vars is ignored.
Cloudflare: Independent D1 6b82e6c9-eaac-418a-9939-5372ab4a2989; 0001_initial.sql applied locally and remotely. Initial published Worker version 10a25a6b-5528-4f89-a895-83dba4f8dfd4. Both requested custom domains bound successfully.
