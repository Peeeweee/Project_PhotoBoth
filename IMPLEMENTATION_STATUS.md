# Audit remediation status

Completed implementation pass 2026-10-17. This file records remediation against `AUDIT_REPORT.md`; the original report remains the baseline. “Addressed” means code/configuration was changed and reviewed; device, hosting, and browser download limits are listed below.

## Workstreams

- Backend: private room session credentials, REST/socket authorization, validation and exception handling, migrated capture rounds, persistence/retention, authoritative snapshots, regression tests.
- Frontend: authenticated requests, reconnect hydration, capture composition, shared editing/navigation, invitations, lifecycle cleanup, bounded persistence, recovery states.
- UI: component build errors, custom image rendering, camera readiness/cancellation, keyboard interactions, pointer handling, responsive styling.
- Integration: production build/lint gates, same-origin development proxy, configuration examples, deployment and operating instructions, final regression verification.

## Verification

| Check | Result |
| --- | --- |
| Server typecheck and production build | Pass |
| Server regression tests | 4 passing tests covering lifecycle/security, legacy migration/backup, pattern CSS, custom upload serialization |
| Client production build | Pass; routes split into asynchronous chunks; no oversized-chunk warning |
| Client strict source lint | Pass, warnings fail the command |
| npm audit, both complete dependency trees | Zero advisories at verification time |
| Browser: create, canonical invite prefill, two-user lobby, host setup | Pass |
| Browser: synthetic captures → slot assignment → filter → decoration → export → completion | Pass |
| Browser: PNG/JPEG raster generation | Valid generated images; JPEG verified at 1379 × 3200 pixels for classic strip |
| Browser: PDF generation | Generated application/pdf download link |
| Existing database | Not opened or modified by remediation tests |

Backend regression coverage includes missing credentials, host impersonation, malformed socket payloads with and without callbacks, readiness barriers, two participants uploading the same frame index, retries, cross-participant attribution, shared editor authorization, reconnect snapshots, retakes, stale rounds, explicit leave/revocation across sockets, foreign keys, SQLite online backup restoration, legacy slot migration, and unsafe design CSS rejection. Those cases are assertions within four tests, not four individual assertions.

## Findings addressed

| Audit # | Implementation |
| --- | --- |
| 1 | Random private session tokens stored hashed server-side; bound socket identity and host checks; shared IDs grant no authority. |
| 2 | Room/photo reads require bearer membership; expired/closed rooms reject access. |
| 3 | Runtime payload validation, safe optional acknowledgements, caught handler failures, connection/event limits. |
| 4 | All frontend compiler failures repaired; actual layout picker exercised in browser. |
| 5 | Broken bot mutation removed; demo bots disabled and controls removed. |
| 6 | Sample remote footage removed; each participant contributes their own real captures; group frames compose from uploaded participant images. |
| 7 | Capture uniqueness includes room, round, participant, and frame; retries upsert the same identity. |
| 8 | New rounds clear old captures and rotate round identity; stale uploads reject; reshoot first reopens camera readiness. |
| 9 | Upload identity derives from credential; matching room/participant foreign key and attribution validation. |
| 10 | Validated authoritative editor document and shared stage snapshots synchronize guests; guest controls are read-only. |
| 11 | Join/reconnect restores snapshots, editor, selections, timer, and captured frame progress. |
| 12 | Camera readiness, server deadlines adjusted to local clock, acknowledged uploads, completion barrier, visible retries. |
| 13 | Explicit leave revokes membership; online presence is separate; bounded reconnect grace removes guests/closes departed-host rooms. |
| 14 | HTTP/socket limits, quotas, image bounds, room cap, and automatic expiry. SQLite remains intentional for the bounded single-process deployment. |
| 15 | Validated durable inline PNG custom assets, shared design snapshot, overlay rendering; no unrecoverable object URLs. |
| 16 | Canonical /?join=CODE invitations; initial query preserved; completion invitation copy explains next-round use. |
| 17 | Compact persisted preferences/identity; large image/editor data restored from server; browser storage failures caught. |
| 18 | Central leave/reset/disconnect with authenticated REST leave; old room events ignored; fresh round editor cleanup. |
| 19 | Boundary validation for IDs, images, frames, timers, editor fields and CSS; meaningful 400/401/403/409/413/429 responses. |
| 20 | Bundled schema; database/schema resolved independently of working directory. |
| 21 | Versioned transactional migration, legacy two-slot migration test, safe readonly online backup command and restore instructions. |
| 22 | Room/participant creation and joining use transactions; relational capture integrity enforced. |
| 23 | Image readiness before export, visible export errors, generated-file feedback/download fallback, one strip renderer, bounded raster dimensions and PDF compression. |
| 24 | Camera cancellation stops late streams; timers cleaned up; pointer capture handles drawing/gesture cancellation. |
| 25 | Associated/named fields, semantic palette/design/filter controls, keyboard slots/stickers, focus/reduced-motion improvements, host-only editing. |
| 26 | Same-origin Vite API/socket proxy, environment examples, HTTPS/reverse-proxy/SPA deployment instructions. |
| 27 | Shared wire contracts, consolidated editor state, obsolete render/store/socket contracts removed, repaired source formatted. |
| 28 | Assertion-based bounded integration tests and CI build/lint/test gates; compatible dependency patches; vulnerable watcher replaced with native Node watch. |

## Verification limits and deployment decisions

- Real two-device camera permissions, hardware interruption, mobile browsers, clock skew/network delay, and large real-photo exports still need a manual device acceptance check. The browser editor/export check used disposable synthetic photos; the server test separately exercised the real two-client upload barrier.
- PNG/JPEG generation and a PDF payload were verified in the browser. The in-app browser did not emit a download event for the automatic save; a visible generated-file link now provides a user-driven fallback. File saving through a normal browser/device still needs its own check.
- A requested mobile viewport override did not change the in-app browser's measured viewport. Responsive styles were reviewed, but this is not evidence of successful mobile visual testing.
- A completion-screen screenshot is saved as `ui-verification.png`; white frames are the intentionally plain synthetic test images.
- Camera media is captured independently and combined after upload; this implementation does not offer live WebRTC video calls. Deadlines coordinate best-effort capture timing, not hardware-synchronized photography.
- Production hosting, HTTPS certificates, backups at the deployment destination, load testing, and multi-replica scaling were not executed. The supplied reverse-proxy configuration is a deployment example, not an installed service.
- Use one backend process. Presence, rate limits, timers, and room broadcasts are process-local. Image storage is bounded SQLite text for this deployment; object storage can be introduced if capacity demands it.
- The first startup on an existing database runs the tested migration and retention cleanup. Back up the existing database before upgrading; legacy records older than the configured retention will expire. Existing legacy memberships have no private session token and cannot be resumed as authenticated sessions.
